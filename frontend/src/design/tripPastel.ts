/**
 * The colour a Trip is known by, wherever it is mentioned.
 *
 * Trips are not assigned colours; they are recognised by them. The colour is
 * derived from the Trip's identity, so the same Trip looks the same in the
 * conversation list, on a chip beside a Message and in the Trip Plan, with
 * nothing stored and nothing to keep in step.
 *
 * Hue is the only thing the identity chooses. Lightness and chroma are fixed,
 * which is what makes every Trip's chip equally pale and its label equally
 * readable, rather than one Trip happening to draw a colour nobody can read.
 */

/** The three colours a Trip chip is drawn with, as `#rrggbb`. */
export type TripPastel = {
  /** The chip's fill. */
  background: string;
  /** The hairline that separates the fill from whatever is behind it. */
  border: string;
  /** The label on the fill. */
  ink: string;
};

/**
 * Twelve hues, far enough apart to be told apart at chip size. A continuous
 * hue would let two Trips land three degrees from each other and look
 * identical without being identical, which is worse than an honest repeat.
 */
const HUES = 12;
const FIRST_HUE = 15;

/** Where on the wheel each of the three colours sits. Fixed for every Trip. */
const FILL = { lightness: 0.945, chroma: 0.048 };
const HAIRLINE = { lightness: 0.855, chroma: 0.065 };
const LABEL = { lightness: 0.425, chroma: 0.085 };

export function tripPastel(tripId: string): TripPastel {
  const hue = FIRST_HUE + (hash(tripId) % HUES) * (360 / HUES);
  return {
    background: oklchToHex(FILL.lightness, FILL.chroma, hue),
    border: oklchToHex(HAIRLINE.lightness, HAIRLINE.chroma, hue),
    ink: oklchToHex(LABEL.lightness, LABEL.chroma, hue),
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
 * still come out as a colour every browser and every test can read.
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
