import "server-only";

import sharp from "sharp";

import { chroma, deltaE } from "@/lib/analysis/colors";
import type { DominantColor } from "@/lib/extraction/types";

export type VisualIssue = {
  code: string;
  title: string;
  description: string;
  recommendation: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  evidence?: Record<string, unknown>;
};

export type VisualAnalysis = {
  width: number;
  height: number;
  aspectRatio: number;
  contrast: number;
  blurVariance: number;
  issues: VisualIssue[];
};

function computeBlurVariance(
  data: Buffer,
  width: number,
  height: number,
) {
  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const value =
        4 * data[index] -
        data[index - 1] -
        data[index + 1] -
        data[index - width] -
        data[index + width];

      sum += value;
      sumSquares += value * value;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  const mean = sum / count;
  return Math.max(0, sumSquares / count - mean * mean);
}

export async function analyzeVisualQuality(
  buffer: Buffer,
): Promise<VisualAnalysis> {
  const metadata = await sharp(buffer).metadata();
  const orientation = metadata.orientation ?? 1;
  const isRotated = orientation >= 5 && orientation <= 8;
  const width = (isRotated ? metadata.height : metadata.width) ?? 0;
  const height = (isRotated ? metadata.width : metadata.height) ?? 0;
  const issues: VisualIssue[] = [];

  const { data, info } = await sharp(buffer)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 512, withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let pixelSum = 0;
  let pixelSumSquares = 0;

  for (const value of data) {
    pixelSum += value;
    pixelSumSquares += value * value;
  }

  const mean = data.length > 0 ? pixelSum / data.length : 0;
  const contrast =
    data.length > 0
      ? Math.sqrt(Math.max(0, pixelSumSquares / data.length - mean * mean))
      : 0;
  const blurVariance = computeBlurVariance(data, info.width, info.height);
  const shortestSide = Math.min(width, height);
  const aspectRatio = height > 0 ? width / height : 0;

  if (shortestSide > 0 && shortestSide < 400) {
    issues.push({
      code: "resolution_critical",
      title: "Image resolution is very low",
      description: `The shortest side is ${shortestSide}px. At this size, text and logo detail will be unreliable on most channels.`,
      recommendation:
        "Upload a version at least 1080px on the shortest side where possible.",
      severity: "HIGH",
      evidence: { width, height },
    });
  } else if (shortestSide > 0 && shortestSide < 800) {
    issues.push({
      code: "resolution_low",
      title: "Image resolution is below recommended size",
      description: `The shortest side is ${shortestSide}px, which may soften detail in feeds and on retina displays.`,
      recommendation:
        "Upload a version at least 1080px on the shortest side.",
      severity: "MEDIUM",
      evidence: { width, height },
    });
  }

  if (contrast > 0 && contrast < 20) {
    issues.push({
      code: "contrast_low",
      title: "Low tonal contrast",
      description: `The image has a luminance spread of ${contrast.toFixed(
        1,
      )}, which can make text and subjects difficult to read.`,
      recommendation:
        "Increase separation between foreground and background tones.",
      severity: "LOW",
      evidence: { contrast: Math.round(contrast * 10) / 10 },
    });
  }

  if (blurVariance > 0 && blurVariance < 60) {
    issues.push({
      code: "sharpness_low",
      title: "Image appears soft or low-detail",
      description: `Edge variance is ${blurVariance.toFixed(
        1,
      )}, which suggests the image may be blurred or lacking sharp detail.`,
      recommendation:
        "Check the source file for focus and export sharpening before publishing.",
      severity: "MEDIUM",
      evidence: { blurVariance: Math.round(blurVariance * 10) / 10 },
    });
  }

  const supportedRatios = [1, 4 / 5, 5 / 4, 16 / 9, 9 / 16, 3 / 2, 2 / 3];

  if (
    aspectRatio > 0 &&
    !supportedRatios.some((ratio) => Math.abs(aspectRatio - ratio) < 0.04)
  ) {
    issues.push({
      code: "aspect_uncommon",
      title: "Uncommon aspect ratio",
      description: `The image is ${width}×${height} (${aspectRatio.toFixed(
        2,
      )}:1), which may crop awkwardly in standard placements.`,
      recommendation:
        "Export a version in a standard channel ratio such as 4:5, 1:1, or 9:16.",
      severity: "LOW",
      evidence: { width, height },
    });
  }

  return {
    width,
    height,
    aspectRatio: Math.round(aspectRatio * 100) / 100,
    contrast: Math.round(contrast * 10) / 10,
    blurVariance: Math.round(blurVariance * 10) / 10,
    issues,
  };
}

export type PaletteIssue = {
  hex: string;
  percentage: number;
  nearestHex: string;
  nearestDelta: number;
  severity: "MEDIUM" | "LOW";
};

export function analyzePalette({
  dominantColors,
  brandColors,
}: {
  dominantColors: DominantColor[];
  brandColors: string[];
}): PaletteIssue[] {
  if (brandColors.length === 0) {
    return [];
  }

  const issues: PaletteIssue[] = [];

  for (const color of dominantColors) {
    if (color.percentage < 2) {
      continue;
    }

    if (chroma(color.hex) < 8) {
      continue;
    }

    let nearestHex = brandColors[0];
    let nearestDelta = Number.POSITIVE_INFINITY;

    for (const brandHex of brandColors) {
      const distance = deltaE(color.hex, brandHex);

      if (distance < nearestDelta) {
        nearestDelta = distance;
        nearestHex = brandHex;
      }
    }

    if (nearestDelta > 18) {
      issues.push({
        hex: color.hex,
        percentage: color.percentage,
        nearestHex,
        nearestDelta: Math.round(nearestDelta * 10) / 10,
        severity: color.percentage >= 5 ? "MEDIUM" : "LOW",
      });
    }
  }

  return issues
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 4);
}

type LogoAsset = {
  id: string;
  name: string;
  buffer: Buffer;
};

type FlatImage = {
  data: Buffer;
  width: number;
  height: number;
};

async function toFlatGrey(buffer: Buffer, targetWidth: number) {
  // Flatten transparency first: greyscale keeps alpha, and the raw buffer is
  // indexed as a single channel below.
  const result = await sharp(buffer)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: targetWidth, withoutEnlargement: false })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

async function logoHash(buffer: Buffer) {
  const flat = await toFlatGrey(buffer, 128);
  return dHashFromRegion(flat, 0, 0, 1, 1);
}

function sample(
  flat: FlatImage,
  xFraction: number,
  yFraction: number,
) {
  const x = Math.max(
    0,
    Math.min(flat.width - 1, Math.floor(xFraction * flat.width)),
  );
  const y = Math.max(
    0,
    Math.min(flat.height - 1, Math.floor(yFraction * flat.height)),
  );

  return flat.data[y * flat.width + x];
}

function dHashFromRegion(
  flat: FlatImage,
  xFraction: number,
  yFraction: number,
  widthFraction: number,
  heightFraction: number,
) {
  let bits = "";

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const left = sample(
        flat,
        xFraction + (widthFraction * (column + 0.5)) / 9,
        yFraction + (heightFraction * (row + 0.5)) / 8,
      );
      const right = sample(
        flat,
        xFraction + (widthFraction * (column + 1.5)) / 9,
        yFraction + (heightFraction * (row + 0.5)) / 8,
      );

      bits += left > right ? "1" : "0";
    }
  }

  return bits;
}

function hammingDistance(a: string, b: string) {
  let count = 0;

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) {
      count += 1;
    }
  }

  return count + Math.abs(a.length - b.length);
}

export type LogoDetection =
  | { status: "not-applicable" }
  | { status: "no-approved-logo" }
  | {
      status: "detected";
      similarity: number;
      logoId: string;
      logoName: string;
      region: { x: number; y: number; width: number; height: number };
    }
  | { status: "not-detected"; bestSimilarity: number; logoName: string };

export async function detectApprovedLogo({
  contentBuffer,
  logos,
}: {
  contentBuffer: Buffer;
  logos: LogoAsset[];
}): Promise<LogoDetection> {
  if (logos.length === 0) {
    return { status: "no-approved-logo" };
  }

  const flat = await toFlatGrey(contentBuffer, 400);
  const contentAspect = flat.width / flat.height;
  let best: {
    similarity: number;
    logo: LogoAsset;
    region: { x: number; y: number; width: number; height: number };
  } | null = null;

  for (const logo of logos) {
    const metadata = await sharp(logo.buffer).metadata();
    const logoWidth = metadata.width ?? 0;
    const logoHeight = metadata.height ?? 0;

    if (logoWidth === 0 || logoHeight === 0) {
      continue;
    }

    const logoAspect = logoWidth / logoHeight;
    const hash = await logoHash(logo.buffer);
    const scales = [0.12, 0.18, 0.26, 0.36];

    for (const scale of scales) {
      const widthFraction = scale;
      const heightFraction = (scale * contentAspect) / logoAspect;

      if (widthFraction >= 1 || heightFraction >= 1) {
        continue;
      }

      const xPositions = [0, 0.25, 0.5, 1 - widthFraction];
      const yPositions = [0, 0.25, 0.5, 1 - heightFraction];

      for (const x of xPositions) {
        for (const y of yPositions) {
          const cropHash = dHashFromRegion(
            flat,
            x,
            y,
            widthFraction,
            heightFraction,
          );
          const similarity =
            1 - hammingDistance(hash, cropHash) / 64;

          if (!best || similarity > best.similarity) {
            best = {
              similarity,
              logo,
              region: {
                x: Math.round(x * 1000) / 10,
                y: Math.round(y * 1000) / 10,
                width: Math.round(widthFraction * 1000) / 10,
                height: Math.round(heightFraction * 1000) / 10,
              },
            };
          }
        }
      }
    }
  }

  if (!best) {
    return { status: "not-detected", bestSimilarity: 0, logoName: "" };
  }

  if (best.similarity >= 0.86) {
    return {
      status: "detected",
      similarity: Math.round(best.similarity * 100) / 100,
      logoId: best.logo.id,
      logoName: best.logo.name,
      region: best.region,
    };
  }

  return {
    status: "not-detected",
    bestSimilarity: Math.round(best.similarity * 100) / 100,
    logoName: best.logo.name,
  };
}
