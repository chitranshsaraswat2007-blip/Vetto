import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { extractDominantColors } from "@/lib/extraction/palette";
import type {
  ExtractionData,
  OcrWord,
} from "@/lib/extraction/types";

const MAX_TEXT_CHARS = 100_000;

export type ExtractionResult = {
  text: string;
  data: ExtractionData;
};

function clampText(text: string) {
  return text.length > MAX_TEXT_CHARS
    ? `${text.slice(0, MAX_TEXT_CHARS)}\n[Extraction truncated]`
    : text;
}

async function extractImage(buffer: Buffer): Promise<ExtractionResult> {
  // Apply EXIF orientation first; reading metadata from the original would
  // report the pre-rotation width/height for portrait photos.
  const normalized = await sharp(buffer).rotate().toBuffer();
  const metadata = await sharp(normalized).metadata();

  const notes: string[] = [];
  const dominantColors = await extractDominantColors(normalized);
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width > 0 && Math.min(width, height) < 600) {
    notes.push(
      "Image resolution is below 600px on its shortest side; small text may be unreliable.",
    );
  }

  let text = "";
  let ocrConfidence: number | undefined;
  let words: OcrWord[] = [];
  let fontHints: string[] = [];

  try {
    const { createWorker } = await import("tesseract.js");
    const cachePath = path.join(process.cwd(), ".tesseract-cache");
    await mkdir(cachePath, { recursive: true });

    const worker = await createWorker("eng", 1, {
      cachePath,
      errorHandler: (error: unknown) => {
        console.error("Tesseract worker error", error);
      },
    });

    try {
      const result = await worker.recognize(normalized, {}, { blocks: true });
      const data = result.data;
      text = data.text.trim();
      ocrConfidence =
        typeof data.confidence === "number"
          ? Math.round(data.confidence * 10) / 10
          : undefined;

      const extractedWords =
        data.blocks?.flatMap((block) => block.paragraphs) ?? [];

      words = extractedWords
        .flatMap((paragraph) => paragraph.lines)
        .flatMap((line) => line.words)
        .filter((word) => word.text.trim().length > 0)
        .slice(0, 2000)
        .map((word) => ({
          text: word.text.trim(),
          confidence: Math.round(word.confidence * 10) / 10,
          bbox: {
            x0: Math.round(word.bbox.x0),
            y0: Math.round(word.bbox.y0),
            x1: Math.round(word.bbox.x1),
            y1: Math.round(word.bbox.y1),
          },
        }));

      fontHints = Array.from(
        new Set(
          extractedWords
            .flatMap((paragraph) => paragraph.lines)
            .flatMap((line) => line.words)
            .map((word) => word.font_name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).slice(0, 8);

      if (!text) {
        notes.push(
          "OCR did not find readable text. Text-based and disclaimer checks were not applied.",
        );
      }
    } finally {
      await worker.terminate().catch(() => {});
    }
  } catch (error) {
    console.error("OCR failed", error);
    notes.push(
      "OCR failed for this image. Visual checks completed, but text checks were not applied.",
    );
  }

  const data: ExtractionData = {
    kind: "IMAGE",
    width,
    height,
    format: metadata.format,
    textLength: text.length,
    ocrConfidence,
    words,
    dominantColors,
    fontHints,
    notes,
  };

  return { text: clampText(text), data };
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const { extractText, extractTextItems, renderPageAsImage } = await import("unpdf");
  const pdfBytes = new Uint8Array(buffer);
  const result = await extractText(pdfBytes, {
    mergePages: false,
  });
  const pageTexts = result.text.map((page) => page.trim());
  const hasTextLayer = pageTexts.some((page) => page.replace(/\s/g, "").length >= 25);
  const notes: string[] = [];
  let ocrConfidence: number | undefined;
  let ocrPages = 0;
  let fontHints: string[] = [];

  try {
    const itemResult = await extractTextItems(pdfBytes);
    fontHints = Array.from(new Set(itemResult.items.flatMap((page) => page.map((item) => item.fontFamily.trim()).filter(Boolean)))).slice(0, 16);
  } catch (error) {
    console.error("PDF font metadata extraction failed", error);
  }

  const pagesNeedingOcr = pageTexts
    .map((page, index) => ({ page, pageNumber: index + 1 }))
    .filter(({ page }) => page.replace(/\s/g, "").length < 25)
    .slice(0, 12);

  if (pagesNeedingOcr.length > 0) {
    if (result.totalPages > 12) {
      notes.push("PDF OCR is limited to the first 12 pages that need OCR.");
    }
    try {
      const { createWorker } = await import("tesseract.js");
      const cachePath = path.join(process.cwd(), ".tesseract-cache");
      await mkdir(cachePath, { recursive: true });
      const worker = await createWorker("eng", 1, { cachePath });
      const confidences: number[] = [];
      try {
        for (const { pageNumber } of pagesNeedingOcr) {
          const rendered = await renderPageAsImage(pdfBytes, pageNumber, {
            width: 1600,
            format: "png",
            canvasImport: () => import("@napi-rs/canvas"),
          });
          if (typeof rendered === "string") continue;
          const recognized = await worker.recognize(Buffer.from(rendered));
          const pageText = recognized.data.text.trim();
          if (pageText) {
            pageTexts[pageNumber - 1] = pageText;
            ocrPages += 1;
          }
          if (typeof recognized.data.confidence === "number") confidences.push(recognized.data.confidence);
        }
      } finally {
        await worker.terminate().catch(() => {});
      }
      if (confidences.length) {
        ocrConfidence = Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 10) / 10;
      }
    } catch (error) {
      console.error("Scanned PDF OCR failed", error);
      notes.push("OCR could not process one or more scanned PDF pages. Text checks may be incomplete.");
    }
  }

  const text = pageTexts.filter(Boolean).join("\n\n").trim();

  if (!text) {
    notes.push("No readable text was extracted from this PDF; text rules were not applied.");
  } else if (ocrPages > 0) {
    notes.push(`OCR extracted text from ${ocrPages} scanned PDF page${ocrPages === 1 ? "" : "s"}.`);
  }

  const data: ExtractionData = {
    kind: "PDF",
    pages: result.totalPages,
    pageTexts,
    textLength: text.length,
    hasTextLayer,
    ocrConfidence,
    ocrPages,
    fontHints,
    notes,
  };

  return { text: clampText(text), data };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const zip = await import("jszip");
  const archive = await zip.default.loadAsync(buffer);
  const documentXml = await archive.file("word/document.xml")?.async("string");
  const stylesXml = await archive.file("word/styles.xml")?.async("string");
  const fontHints = Array.from(new Set(
    [documentXml, stylesXml]
      .filter((xml): xml is string => Boolean(xml))
      .flatMap((xml) => Array.from(xml.matchAll(/<w:rFonts\b[^>]*\/?\s*>/g)).flatMap((tag) => Array.from(tag[0].matchAll(/w:(?:ascii|hAnsi|eastAsia|cs)="([^"]+)"/g), (match) => match[1].split(",")).flat()))
      .map((name) => name.trim())
      .filter(Boolean),
  )).slice(0, 16);
  const text = result.value.trim();
  const notes = result.messages
    .slice(0, 5)
    .map((message) => `DOCX parser: ${message.message}`);

  if (!text) {
    notes.push("No text was found in this DOCX file.");
  }

  const data: ExtractionData = {
    kind: "DOCX",
    textLength: text.length,
    fontHints,
    notes,
  };

  return { text: clampText(text), data };
}

export async function extractContentBuffer({
  buffer,
  kind,
}: {
  buffer: Buffer;
  kind: "IMAGE" | "PDF" | "DOCX" | "DOC";
}): Promise<ExtractionResult> {
  if (kind === "IMAGE") {
    return extractImage(buffer);
  }

  if (kind === "PDF") {
    return extractPdf(buffer);
  }

  if (kind === "DOCX") {
    return extractDocx(buffer);
  }

  throw new Error(
    "Legacy DOC files are not supported. Save the file as DOCX or PDF and upload again.",
  );
}
