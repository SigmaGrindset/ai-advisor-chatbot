import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { describe, expect, it } from "vitest";

import { directoryOf, filesUnder } from "./sources";

/** Everything the application ships, read as it is actually written. */
const SOURCE = directoryOf(new URL("..", import.meta.url));

/** The one file allowed to say what a colour is. */
const THEME = "tokens.css";

const files = filesUnder(SOURCE, /\.(ts|tsx|css)$/)
  .filter((path) => !path.endsWith(".test.ts"))
  .map((path) => ({
    name: relative(SOURCE, path).replaceAll("\\", "/"),
    text: readFileSync(path, "utf8"),
  }));

const components = files.filter((file) => file.name !== THEME);

describe("what a component is allowed to say about colour", () => {
  it("has no literal colour outside the theme", () => {
    const literal = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab|lch)\(/i;
    for (const file of components) {
      expect(file.text, `${file.name} states a colour of its own`).not.toMatch(literal);
    }
  });

  it("has no reach into the framework's own palette", () => {
    // `bg-neutral-100` and `text-white` are colours by another spelling, and a
    // dark theme can redefine neither of them.
    const palette =
      /\b(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|caret|accent|decoration|placeholder|shadow)-(white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;
    for (const file of components) {
      const reached = palette.exec(file.text);
      expect(reached?.[0], `${file.name} uses the framework's palette`).toBeUndefined();
    }
  });

  it("names only tokens the theme declares", () => {
    const theme = files.find((file) => file.name === THEME)!;
    const declared = new Set(
      [...theme.text.matchAll(/^\s*(--[a-z0-9-]+):/gim)].map(([, name]) => name!),
    );
    for (const file of components) {
      for (const [, read] of file.text.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
        expect(declared, `${file.name} reads ${read}, which the theme never sets`).toContain(
          read,
        );
      }
    }
  });
});

describe("what a component is allowed to say with an icon", () => {
  const icons = files.find((file) => file.name === "design/icons.ts")!.text;

  it("offers one stroke weight and exactly two sizes", () => {
    const sizes = [...icons.matchAll(/\bsize:\s*(\d+)/g)].map(([, value]) => value!);
    const weights = [...icons.matchAll(/\bstrokeWidth:\s*([\d.]+)/g)].map(([, value]) => value!);
    expect(new Set(sizes).size, "more than two icon sizes are on offer").toBe(2);
    expect(new Set(weights)).toEqual(new Set(["1.5"]));
  });

  it("takes every icon from Lucide rather than drawing its own", () => {
    for (const file of components) {
      expect(file.text, `${file.name} draws its own glyph`).not.toMatch(/<svg\b/);
    }
  });

  it("never reaches for the sparkle, bot, zap or wand", () => {
    // The glyphs that announce "there is an AI in here". The advisor is
    // established by how it writes, not by a star beside its name.
    const mascots = /\b(Sparkles?|Bot|Zap|Wand2?|BrainCircuit|BrainCog|Robot)\b/;
    for (const file of components) {
      expect(file.text, `${file.name} uses an AI-mascot glyph`).not.toMatch(mascots);
    }
  });

  it("draws every glyph at one of those two sizes and nothing else", () => {
    for (const file of components) {
      const glyphs = lucideGlyphsIn(file.text);
      for (const glyph of glyphs) {
        const drawn = new RegExp(String.raw`<${glyph}\b[^>]*>`, "g");
        const tags = [...file.text.matchAll(drawn)].map(([tag]) => tag);
        expect(tags.length, `${file.name} imports ${glyph} and never draws it`).toBeGreaterThan(0);
        for (const tag of tags) {
          expect(tag, `${file.name} draws ${glyph} off the scale`).toMatch(
            /\{\.\.\.(icon|smallIcon)\}/,
          );
        }
      }
    }
  });
});

/** The Lucide glyphs a file has brought in, by the names it gave them. */
function lucideGlyphsIn(text: string): string[] {
  const imported = /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(text);
  if (!imported) return [];
  return imported[1]!
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
