/**
 * WCAG relative luminance and contrast ratio.
 *
 * This exists so the design system's claims about contrast can be checked
 * mechanically rather than asserted in a comment: the guard tests read the
 * tokens as they are actually written and measure them here.
 */

/** Relative luminance of an `#rrggbb` colour, per WCAG 2.2. */
export function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map(toLinear);
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** Contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

function channels(hex: string): [number, number, number] {
  const digits = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!digits) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const value = parseInt(digits[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function toLinear(channel: number): number {
  const proportion = channel / 255;
  return proportion <= 0.04045
    ? proportion / 12.92
    : ((proportion + 0.055) / 1.055) ** 2.4;
}
