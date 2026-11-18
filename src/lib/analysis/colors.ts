export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace(/^#/, "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function toLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function rgbToLab({ r, g, b }: Rgb) {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

  const f = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function deltaE(hexA: string, hexB: string) {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);

  if (!rgbA || !rgbB) {
    return Number.POSITIVE_INFINITY;
  }

  const labA = rgbToLab(rgbA);
  const labB = rgbToLab(rgbB);

  return Math.sqrt(
    Math.pow(labA.l - labB.l, 2) +
      Math.pow(labA.a - labB.a, 2) +
      Math.pow(labA.b - labB.b, 2),
  );
}

export function chroma(hex: string) {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return 0;
  }

  const lab = rgbToLab(rgb);
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}
