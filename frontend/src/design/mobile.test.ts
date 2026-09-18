import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { directoryOf, filesUnder } from "./sources";

const ROOT = directoryOf(new URL("../..", import.meta.url));
const SOURCE = join(ROOT, "src");
const PUBLIC = join(ROOT, "public");

const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tokens = readFileSync(join(SOURCE, "tokens.css"), "utf8");
const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));

const components = filesUnder(SOURCE, /\.(ts|tsx|css)$/)
  .filter((path) => !path.endsWith(".test.ts"))
  .map((path) => {
    const text = readFileSync(path, "utf8");
    return { name: relative(SOURCE, path).replaceAll("\\", "/"), text, code: code(text) };
  });

/**
 * A file with its commentary taken out.
 *
 * This codebase explains itself at length, and several of the rules below are
 * about what the code *does* — the units it measures in, the classes it
 * spends. Run over the raw text they read the explanations too, and a comment
 * saying why `100dvh` is the wrong unit fails the rule against `100dvh`.
 *
 * The line-comment pattern keeps whatever character preceded the slashes, so
 * that the `//` in an address is not mistaken for the start of one.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The `content` of a `<meta>` by name, as the page actually declares it. */
function meta(name: string): string {
  const declared = new RegExp(
    String.raw`<meta\s+name="${name}"\s+content="([^"]*)"`,
    "s",
  ).exec(html.replace(/\s+/g, " "));
  if (declared === null) throw new Error(`No <meta name="${name}"> in the page`);
  return declared[1]!;
}

describe("what the page tells the phone about itself", () => {
  const viewport = meta("viewport");

  it("takes the whole screen, notch and all", () => {
    // Without this `env(safe-area-inset-*)` is zero on every device that has
    // a safe area, and the composer's clearance quietly does nothing.
    expect(viewport).toContain("viewport-fit=cover");
  });

  it("asks the browser to give the keyboard room out of the layout", () => {
    expect(viewport).toContain("interactive-widget=resizes-content");
  });

  it("never stops the traveler magnifying the page", () => {
    // Capping the scale is the cheap way to stop iOS zooming a focused input,
    // and it takes zoom away from everyone who needs it to read. The 16px
    // field below is the fix; this is the thing it lets us not do.
    expect(viewport).not.toMatch(/maximum-scale|user-scalable/);
  });

  it("colours the browser's own chrome in the canvas the page is drawn on", () => {
    const canvas = /--color-canvas:\s*(#[0-9a-f]{6})/i.exec(tokens)![1]!;
    expect(meta("theme-color").toLowerCase()).toBe(canvas.toLowerCase());
    expect(String(manifest.theme_color).toLowerCase()).toBe(canvas.toLowerCase());
    expect(String(manifest.background_color).toLowerCase()).toBe(canvas.toLowerCase());
  });
});

describe("what the traveler pins to a home screen", () => {
  it("is offered a manifest and a touch icon from the page itself", () => {
    expect(html).toMatch(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/<link\s+rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"/);
  });

  it("opens as an application rather than in a tab", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.name).toBe("AI Travel Advisor");
    // Home screens give a name about twelve characters before they truncate.
    expect(manifest.short_name.length).toBeLessThanOrEqual(14);
  });

  it("offers an icon at the sizes an installer looks for, and one to crop", () => {
    const sizes = new Map<string, unknown>(
      manifest.icons.map((offered: { sizes: string; purpose?: string }) => [
        `${offered.sizes} ${offered.purpose ?? "any"}`,
        offered,
      ]),
    );
    expect([...sizes.keys()].sort()).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  it("ships every icon it offers, as a PNG of the size it claims", () => {
    const named = [
      ...manifest.icons.map((offered: { src: string; sizes: string }) => ({
        file: offered.src.replace(/^\//, ""),
        size: Number(offered.sizes.split("x")[0]),
      })),
      { file: "apple-touch-icon.png", size: 180 },
    ];
    for (const { file, size } of named) {
      const bytes = readFileSync(join(PUBLIC, file));
      expect(bytes.subarray(1, 4).toString("ascii"), `${file} is not a PNG`).toBe("PNG");
      // The width and the height, which a PNG puts first in its header.
      expect(bytes.readUInt32BE(16), `${file} is not ${size} wide`).toBe(size);
      expect(bytes.readUInt32BE(20), `${file} is not ${size} tall`).toBe(size);
    }
  });

  it("registers no service worker, and has nothing for one to be", () => {
    // The spec rules one out. An application that installs to a home screen
    // and then serves a stale shell from a cache nobody wrote a story for is
    // worse than one that simply needs the network it already needs.
    for (const file of components) {
      expect(file.text, `${file.name} reaches for a service worker`).not.toMatch(
        /serviceWorker|workbox/i,
      );
    }
    expect(html).not.toMatch(/serviceWorker|sw\.js/i);
    expect(manifest).not.toHaveProperty("serviceworker");
  });
});

describe("what a thumb can reach", () => {
  it("reveals nothing on hover that is only there on hover", () => {
    // A pointer is an affordance a touch screen has not got, so a control
    // that appears under one is a control a phone cannot reach (ADR-0007).
    // Hover may change a colour; it may not bring something into being.
    const reveals = /\b(group-)?hover:(opacity-|visible|flex\b|block\b|grid\b|inline)/;
    for (const file of components) {
      const found = reveals.exec(file.text);
      expect(found?.[0], `${file.name} hides a control behind a pointer`).toBeUndefined();
    }
  });

  it("types into nothing smaller than the size iOS zooms at", () => {
    // Under 16px, focusing a field magnifies the page and leaves the traveler
    // panning a layout that is now the wrong width.
    const smallest = /--text-input:\s*([\d.]+)rem/.exec(tokens);
    expect(Number(smallest![1]) * 16).toBeGreaterThanOrEqual(16);

    for (const file of components) {
      for (const [field] of file.code.matchAll(/<(?:input|textarea)\b[^>]*>/gs)) {
        expect(field, `${file.name} has a field off the input size`).toMatch(/text-input/);
      }
    }
  });

  it("keeps the composer clear of whatever the device puts at the bottom", () => {
    expect(tokens).toMatch(/--spacing-composer:[^;]*env\(safe-area-inset-bottom\)/);
    const composer = components.find((file) => file.name === "ConversationPane.tsx")!;
    expect(composer.text).toMatch(/pb-composer/);
  });
});

describe("what happens at the end of a scroll", () => {
  it("contains every scrolling area, so none of them chains into another", () => {
    // Two nested scrollers that chain mean flicking to the foot of the
    // transcript carries on into whatever is behind it, and flicking a sheet's
    // list drags the page. Every `overflow-y-auto` is contained.
    for (const file of components) {
      for (const [, quoted, templated] of file.code.matchAll(CLASSES)) {
        const written = quoted ?? templated!;
        if (!written.includes("overflow-y-auto")) continue;
        expect(written, `${file.name} scrolls without containing it`).toContain(
          "overscroll-contain",
        );
      }
    }
  });

  it("stops the page itself being dragged around", () => {
    const base = components.find((file) => file.name === "index.css")!;
    expect(base.text).toMatch(/html\s*\{[^}]*overscroll-behavior:\s*none/);
  });
});

/**
 * Every set of classes a component writes, however it writes them.
 *
 * Both spellings, and each closed by the quote it was opened with: a pattern
 * that opens on a backtick and closes on a double quote stops at the first
 * string inside an interpolation, which is where a conditional class list
 * keeps its `"left"`. It would then read half of every template literal in
 * the codebase and pass on the strength of it.
 */
const CLASSES = /class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\}|\{`((?:[^`])*)`)/gs;

describe("how the shell is sized", () => {
  it("is never measured against the window, in any spelling of it", () => {
    // `vh` is the window with the browser's chrome collapsed, which it is
    // not. `dvh` corrects for the chrome and still knows nothing about a
    // keyboard: a field capped at `40dvh` is free to grow to 40% of a screen
    // it is only being shown half of. Anything sized against the screen is
    // sized against `--spacing-viewport`, which is the only one of the three
    // that is true while somebody is typing — and the theme is the one file
    // allowed to state the `100dvh` it falls back to.
    for (const file of components) {
      if (file.name === "tokens.css") continue;
      const stated = /[\d.]+d?vh\b/.exec(file.code);
      expect(
        stated?.[0],
        `${file.name} measures the window rather than the shell`,
      ).toBeUndefined();
    }
  });

  it("falls back to the tallest thing a stylesheet can say, and no further", () => {
    expect(tokens).toMatch(/--spacing-viewport:\s*100dvh/);
  });
});
