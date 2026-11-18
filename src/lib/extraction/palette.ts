import "server-only";

import sharp from "sharp";

import type { DominantColor } from "@/lib/extraction/types";

type Bucket = {
  r: number;
  g: number;
  b: number;
  count: number;
};

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

export async function extractDominantColors(
  buffer: Buffer,
  limit = 8,
): Promise<DominantColor[]> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: 200, withoutEnlargement: true })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    return [];
  }

  const buckets = new Map<string, Bucket>();
  let total = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];

    if (alpha < 128) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }

    total += 1;
  }

  if (total === 0 || info.width === 0) {
    return [];
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((bucket) => ({
      hex: toHex(
        bucket.r / bucket.count,
        bucket.g / bucket.count,
        bucket.b / bucket.count,
      ),
      percentage:
        Math.round((bucket.count / total) * 1000) / 10,
    }));
}
