/**
 * The colour a Trip is known by, wherever it is mentioned.
 *
 * Derived from the Trip's identity rather than assigned, so the same Trip
 * looks the same everywhere with nothing stored and nothing to keep in step.
 * Identity chooses the hue alone; lightness and chroma are fixed, so no Trip
 * draws a colour nobody can read.
 *
 * There are as many of these as the traveler has Trips, so no stylesheet can
 * hold them — which makes this the one place that has to be told which theme
 * is showing. A Trip keeps its hue across the move.
 */

import type { Scheme } from "./theme";

/** The three colours a Trip chip is drawn with, as `#rrggbb`. */
export type TripPastel = {
  background: string;
  border: string;
  ink: string;
};

/**
 * Twelve hues, far enough apart to tell apart at chip size. A continuous hue
 * would let two Trips land three degrees apart and look identical without
 * being identical, which is worse than an honest repeat.
 */
const HUES = 12;
const FIRST_HUE = 15;

/** How far from the ground each of the three colours sits, per theme. */
type Recipe = { lightness: number; chroma: number };

/**
 * On paper: a pale wash, a deeper hairline, a label dark enough to read on it.
 * In the dark the recipe turns over, but not by inverting the numbers — chroma
 * comes down on the fill, which would otherwise read as a colour sample on a
 * near-black rail, and on the label, which would otherwise vibrate.
 */
const RECIPES: Record<Scheme, { fill: Recipe; hairline: Recipe; label: Recipe }> = {
  light: {
    fill: { lightness: 0.945, chroma: 0.048 },
    hairline: { lightness: 0.855, chroma: 0.065 },
    label: { lightness: 0.425, chroma: 0.085 },
  },
  dark: {
    fill: { lightness: 0.295, chroma: 0.038 },
    hairline: { lightness: 0.415, chroma: 0.055 },
    label: { lightness: 0.845, chroma: 0.062 },
  },
};

export function tripPastel(tripId: string, scheme: Scheme): TripPastel {
  const hue = FIRST_HUE + (hash(tripId) % HUES) * (360 / HUES);
  const { fill, hairline, label } = RECIPES[scheme];
  return {
    background: oklchToHex(fill.lightness, fill.chroma, hue),
    border: oklchToHex(hairline.lightness, hairline.chroma, hue),
    ink: oklchToHex(label.lightness, label.chroma, hue),
  };
}

/** FNV-1a, for a spread that does not cluster on identifiers with a shared prefix. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    value ^= text.charCodeAt(at);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/**
 * Oklch to sRGB, so the recipe above can be stated in perceptual terms and
 * still come out as a colour every browser and test can read.
 */
function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return (
    "#" +
    [
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
    ]
      .map(encode)
      .join("")
  );
}

/** One linear-light channel as two hex digits, gamma encoded and kept in gamut. */
function encode(linear: number): string {
  const encoded =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  return byte.toString(16).padStart(2, "0");
}
