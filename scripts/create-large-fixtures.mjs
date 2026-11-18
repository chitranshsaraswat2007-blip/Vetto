#!/usr/bin/env node
/** Generate large, valid image/PDF/DOCX fixtures for the HTTP E2E run. */
import { randomBytes } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Document, Packer, Paragraph, TextRun } from "docx";

const outputDir = path.resolve(process.argv[2] ?? ".vetto-qa/fixtures");
const maxFileBytes = 20 * 1024 * 1024;
await mkdir(outputDir, { recursive: true });

function makePdf(pageCount = 300) {
  const objects = [];
  const pageRefs = [];

  objects[1] = Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects[3] = Buffer.from(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );

  for (let page = 0; page < pageCount; page += 1) {
    const pageObject = 4 + page * 2;
    const streamObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);

    const lines = Array.from({ length: 60 }, (_, line) => {
      const evidence = randomBytes(84).toString("hex");
      const label = `Aurelia Coffee campaign record ${page + 1}-${line + 1}: ${evidence}`;
      return `(${label}) Tj T*`;
    }).join("\n");
    const stream = Buffer.from(`BT /F1 7 Tf 28 810 Td 9 TL\n${lines}\nET\n`, "ascii");

    objects[pageObject] = Buffer.from(
      `${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamObject} 0 R >>\nendobj\n`,
      "ascii",
    );
    objects[streamObject] = Buffer.concat([
      Buffer.from(`${streamObject} 0 obj\n<< /Length ${stream.byteLength} >>\nstream\n`, "ascii"),
      stream,
      Buffer.from("endstream\nendobj\n", "ascii"),
    ]);
  }

  objects[2] = Buffer.from(
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageCount} >>\nendobj\n`,
    "ascii",
  );

  const header = Buffer.from("%PDF-1.7\n% VETTO large-file QA fixture\n", "ascii");
  const chunks = [header];
  const offsets = [0];
  let length = header.byteLength;

  for (let number = 1; number < objects.length; number += 1) {
    if (!objects[number]) throw new Error(`Missing PDF object ${number}`);
    offsets[number] = length;
    chunks.push(objects[number]);
    length += objects[number].byteLength;
  }

  const xrefOffset = length;
  const xref = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let number = 1; number < objects.length; number += 1) {
    xref.push(`${String(offsets[number]).padStart(10, "0")} 00000 n `);
  }
  xref.push(
    "trailer",
    `<< /Size ${objects.length} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  );
  chunks.push(Buffer.from(xref.join("\n"), "ascii"));
  return Buffer.concat(chunks);
}

const imageWidth = 2400;
const imageHeight = 2400;
const pixels = randomBytes(imageWidth * imageHeight * 3);
for (let i = 0; i < pixels.length; i += 1) {
  pixels[i] = 214 + (pixels[i] % 26);
}

const posterSvg = Buffer.from(`
  <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="140" y="230" width="2120" height="1940" fill="#f6f1e7" fill-opacity="0.94"/>
    <text x="260" y="540" font-family="Arial" font-size="94" fill="#292722">AURELIA COFFEE ROASTERS</text>
    <text x="260" y="850" font-family="Arial" font-size="172" fill="#292722">A slower kind</text>
    <text x="260" y="1050" font-family="Arial" font-size="172" fill="#292722">of morning.</text>
    <text x="260" y="1370" font-family="Arial" font-size="76" fill="#5b5045">Small-batch coffee. Roasted with care.</text>
    <text x="260" y="1510" font-family="Arial" font-size="60" fill="#5b5045">Find your ritual at aurelia.example</text>
    <text x="260" y="2020" font-family="Arial" font-size="48" fill="#5b5045">QA content ${"AURELIA ".repeat(6)}</text>
  </svg>
`);

const baseImage = sharp(pixels, {
  raw: { width: imageWidth, height: imageHeight, channels: 3 },
}).composite([{ input: posterSvg }]);

const png = await baseImage.clone().png({ compressionLevel: 6 }).toBuffer();
const webp = await baseImage.clone().webp({ lossless: true, effort: 3 }).toBuffer();
const pdf = makePdf();

const randomText = randomBytes(6 * 1024 * 1024).toString("base64");
const paragraphSize = 128 * 1024;
const docxParagraphs = [
  new Paragraph({ text: "Aurelia Coffee Roasters - large extraction QA brief" }),
  ...Array.from({ length: Math.ceil(randomText.length / paragraphSize) }, (_, index) =>
    new Paragraph({
      children: [
        new TextRun(`Campaign section ${index + 1}: `),
        new TextRun(randomText.slice(index * paragraphSize, (index + 1) * paragraphSize)),
      ],
    }),
  ),
];
const docx = await Packer.toBuffer(
  new Document({ sections: [{ children: docxParagraphs }] }),
);

const fixtures = [
  ["large-poster.png", png],
  ["large-offer.pdf", pdf],
  ["large-brand-brief.docx", docx],
  ["large-poster.webp", webp],
];

for (const [filename, buffer] of fixtures) {
  if (buffer.byteLength < 3 * 1024 * 1024) {
    throw new Error(`${filename} is too small for the large-file QA run`);
  }
  if (buffer.byteLength > maxFileBytes) {
    throw new Error(`${filename} is ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MiB, over the 20 MiB app limit`);
  }
  await writeFile(path.join(outputDir, filename), buffer);
  const details = await stat(path.join(outputDir, filename));
  console.log(`${filename}: ${(details.size / 1024 / 1024).toFixed(2)} MiB`);
}
