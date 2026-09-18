import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SHEET, SHELL, layoutFor } from "./layout";

describe("which layout a width gets", () => {
  it("gives a laptop all three panes", () => {
    expect(layoutFor(1440)).toBe("desktop");
    expect(layoutFor(SHELL)).toBe("desktop");
  });

  it("gives a tablet the conversation and the record, and the list as a sheet", () => {
    expect(layoutFor(SHELL - 1)).toBe("tablet");
    expect(layoutFor(900)).toBe("tablet");
    expect(layoutFor(SHEET)).toBe("tablet");
  });

  it("gives a phone the conversation, and everything else as a sheet", () => {
    expect(layoutFor(SHEET - 1)).toBe("phone");
    expect(layoutFor(375)).toBe("phone");
    expect(layoutFor(320)).toBe("phone");
  });
});

describe("where the layout's widths are stated", () => {
  const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

  /** A `--breakpoint-*` token, in the pixels a media query would use. */
  function breakpoint(name: string): number {
    const declared = new RegExp(String.raw`--breakpoint-${name}:\s*([\d.]+)rem`).exec(tokens);
    if (declared === null) throw new Error(`No --breakpoint-${name} in the theme`);
    return Number(declared[1]) * 16;
  }

  it("agrees with the theme, so a stylesheet and the shell break together", () => {
    // Both exist: the structure is chosen in TypeScript because a pane and a
    // sheet cannot be the same element hidden twice, and presentation inside
    // each is chosen in CSS. They have to name the same two widths.
    expect(breakpoint("sheet")).toBe(SHEET);
    expect(breakpoint("shell")).toBe(SHELL);
  });
});
