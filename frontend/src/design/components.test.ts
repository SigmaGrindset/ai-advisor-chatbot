import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { describe, expect, it } from "vitest";

import { directoryOf, filesUnder } from "./sources";

/**
 * Two things a component can do that the traveler would see, and no rules
 * about how a component ought to be written.
 *
 * Both of these are read off the source rather than off a rendered page,
 * because both are about the *absence* of something: there is no page state in
 * which you can observe that no component anywhere reaches for a token that
 * does not exist. Rendering proves the case in front of you and nothing about
 * the one nobody opened.
 */

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

describe("what a component draws with", () => {
  it("names only tokens the theme declares", () => {
    // A `var(--typo)` the theme never sets is not a style that looks slightly
    // wrong: the declaration is invalid at computed-value time and the element
    // falls back to whatever it inherited, so a chip loses its background and
    // a hairline disappears. Nothing warns, in the browser or at build time.
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

describe("what a component is allowed to put on the page", () => {
  it("never hands a string to the browser as markup", () => {
    // The advisor's replies are text from outside the application. Nothing is
    // sanitised on the way in because nothing is ever markup: the renderer
    // builds elements from a parsed tree that has no node for raw markup and
    // none for an image, so there is no path from a reply to an element the
    // reply chose. This holds the door shut.
    for (const file of files) {
      expect(file.text, `${file.name} sets markup from a string`).not.toMatch(
        /dangerouslySetInnerHTML|\binnerHTML\b|insertAdjacentHTML|document\.write/,
      );
    }
  });
});
