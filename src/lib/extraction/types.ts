export type DominantColor = {
  hex: string;
  percentage: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type ExtractionData = {
  kind: "IMAGE" | "PDF" | "DOCX" | "DOC";
  width?: number;
  height?: number;
  format?: string;
  pages?: number;
  pageTexts?: string[];
  textLength?: number;
  hasTextLayer?: boolean;
  ocrConfidence?: number;
  ocrPages?: number;
  words?: OcrWord[];
  dominantColors?: DominantColor[];
  fontHints?: string[];
  notes?: string[];
};
