import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

import { directoryOf, filesUnder } from "./sources";

/**
 * What the browser is actually handed.
 *
 * The claim under test is about runtime behaviour — that opening the
 * application asks nobody but this server for a typeface — so the check runs
 * against a real build rather than against the sources that produce it.
 */
const root = directoryOf(new URL("../..", import.meta.url));

let served: { name: string; bytes: Buffer }[] = [];

beforeAll(async () => {
  const outDir = mkdtempSync(join(tmpdir(), "advisor-build-"));
  await build({
    root,
    configFile: join(root, "vite.config.ts"),
    logLevel: "silent",
    build: { outDir, emptyOutDir: true },
  });
  served = filesUnder(outDir).map((path) => ({
    name: relative(outDir, path).replaceAll("\\", "/"),
    bytes: readFileSync(path),
  }));
}, 180_000);

/** Everything the browser would read as text, whose name the pattern matches. */
function servedText(named: RegExp): string {
  return served
    .filter((file) => named.test(file.name))
    .map((file) => file.bytes.toString("utf8"))
    .join("\n");
}

describe("the typefaces the application ships", () => {
  it("serves Archivo, Geist Sans and Geist Mono from its own build", () => {
    for (const family of ["archivo", "geist", "geist-mono"]) {
      const faces = served.filter(
        (file) => file.name.endsWith(".woff2") && file.name.includes(family),
      );
      expect(faces.length, `no ${family} woff2 in the build`).toBeGreaterThan(0);
    }
  });

  it("ships them as woff2 and nothing heavier", () => {
    const fonts = served.filter((file) => /\.(woff2?|ttf|otf|eot)$/.test(file.name));
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font.name, "an older font format is being shipped too").toMatch(/\.woff2$/);
    }
  });

  it("asks no font service for anything", () => {
    // The application tells the traveler what leaves their machine. A typeface
    // fetched from someone else's CDN is a request no such notice mentions,
    // and an address handed over on every page load.
    const services =
      /fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.bunny\.net|use\.typekit|fast\.fonts|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i;
    expect(servedText(/\.(html|css|js)$/)).not.toMatch(services);
  });

  it("loads nothing at all from another origin", () => {
    const html = served.find((file) => file.name === "index.html")!.bytes.toString("utf8");
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      expect(url, "the page pulls in something it does not serve").not.toMatch(
        /^(https?:)?\/\//,
      );
    }
  });

  it("declares every face it names, over a file it serves", () => {
    const css = servedText(/\.css$/);
    for (const family of ["Archivo Variable", "Geist Variable", "Geist Mono Variable"]) {
      const declared = new RegExp(
        String.raw`@font-face\s*\{[^}]*font-family:\s*['"]?${family}['"]?[^}]*\.woff2`,
      );
      expect(css, `${family} is named but never declared over a woff2`).toMatch(declared);
    }
  });
});
