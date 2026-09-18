import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "./wcag";

const source = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

/** Every `--color-*` token, as the theme actually declares it. */
const colours = new Map(
  [...source.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(
    ([, name, value]) => [name!, value!.toLowerCase()],
  ),
);

function colour(name: string): string {
  const declared = colours.get(name);
  if (declared === undefined) throw new Error(`No --color-${name} in the theme`);
  return declared;
}

/** The four meanings colour is allowed to carry, and nothing else. */
const MEANINGS = ["changed", "verified", "open", "error"];

describe("the theme's colour tokens", () => {
  it("names the clay accent and the four meanings", () => {
    expect(colours.has("accent")).toBe(true);
    for (const meaning of MEANINGS) {
      expect(colours.has(meaning)).toBe(true);
      expect(colours.has(`${meaning}-tint`)).toBe(true);
    }
  });

  it("keeps body text well clear of the readability floor", () => {
    expect(contrastRatio(colour("ink"), colour("canvas"))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(colour("ink"), colour("surface"))).toBeGreaterThanOrEqual(7);
  });

  it("keeps quieter text readable rather than merely faint", () => {
    for (const name of ["ink-muted", "ink-subtle"]) {
      expect(contrastRatio(colour(name), colour("canvas"))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colour(name), colour("sunken"))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lets the accent be written on the page and written on", () => {
    expect(contrastRatio(colour("accent"), colour("canvas"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colour("accent"), colour("surface"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colour("accent-contrast"), colour("accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colour("accent-contrast"), colour("accent-strong"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colour("accent"), colour("accent-tint"))).toBeGreaterThanOrEqual(4.5);
  });

  it("lets each meaning be read on the page and on its own tint", () => {
    for (const meaning of MEANINGS) {
      expect(contrastRatio(colour(meaning), colour("canvas"))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colour(meaning), colour("surface"))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colour(meaning), colour(`${meaning}-tint`))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("makes every tint a wash you can actually see", () => {
    for (const meaning of [...MEANINGS, "accent"]) {
      expect(contrastRatio(colour(`${meaning}-tint`), colour("canvas"))).toBeGreaterThan(1.05);
    }
  });

  it("keeps the focus ring visible against everything it can land on", () => {
    for (const behind of ["canvas", "surface", "sunken"]) {
      expect(contrastRatio(colour("focus"), colour(behind))).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives the five meanings five different colours", () => {
    const meanings = [...MEANINGS, "accent"].map(colour);
    expect(new Set(meanings).size).toBe(meanings.length);
  });

  it("separates hairlines from what they divide without shouting", () => {
    expect(contrastRatio(colour("line"), colour("canvas"))).toBeGreaterThan(1.15);
    // A control's own boundary has to clear 3:1 wherever the control sits.
    for (const behind of ["canvas", "surface", "sunken"]) {
      expect(contrastRatio(colour("line-strong"), colour(behind))).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the theme's naming", () => {
  it("names roles, not colours or brightnesses, so a dark theme is one more block", () => {
    // A token called `--color-cream` or `--color-light-grey` cannot be
    // redefined for a dark theme without lying about its own name.
    const appearances = /\b(white|black|light|dark|cream|beige|grey|gray|sand|warm|pale)\b/;
    for (const name of colours.keys()) {
      expect(name, `--color-${name} names how it looks, not what it is for`).not.toMatch(
        appearances,
      );
    }
  });

  it("puts every colour value in one overridable block", () => {
    // Everything after the theme block is free of literal colour, so a dark
    // theme is a second block of the same names and nothing else.
    const afterTheme = source.slice(source.indexOf("}", source.indexOf("@theme")));
    expect(afterTheme).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
