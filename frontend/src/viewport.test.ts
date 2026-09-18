import { describe, expect, it } from "vitest";

import { showing } from "./viewport";

describe("what the browser says it is showing", () => {
  it("is the whole window when nothing is in the way", () => {
    expect(showing({ height: 812, offsetTop: 0, scale: 1 })).toEqual({ height: 812, top: 0 });
  });

  it("is the part above the keyboard, and where that part starts", () => {
    // A phone opening its keyboard does two things at once: it shrinks what it
    // can show, and it scrolls the page up underneath. A shell that tracks
    // only the first is the right height in the wrong place.
    expect(showing({ height: 476, offsetTop: 84, scale: 1 })).toEqual({ height: 476, top: 84 });
  });

  it("never claims a pixel the phone has not got", () => {
    // Sub-pixel heights are ordinary. Rounding up leaves the composer's last
    // row a fraction under the keyboard, which is the whole failure this
    // exists to prevent.
    expect(showing({ height: 476.8, offsetTop: 84.4, scale: 1 })).toEqual({
      height: 476,
      top: 84,
    });
  });
});

describe("what the browser says while the traveler is pinching", () => {
  it("is left alone, because a zoomed viewport is not a smaller window", () => {
    // Pinching in reports a viewport a third of the size. Resizing the shell
    // to it would reflow the layout to a phone width under their fingers,
    // which is not what magnifying a page is for.
    expect(showing({ height: 270, offsetTop: 120, scale: 3 })).toBeNull();
  });

  it("tolerates the fractional scale a browser settles at", () => {
    expect(showing({ height: 812, offsetTop: 0, scale: 1.001 })).toEqual({
      height: 812,
      top: 0,
    });
  });
});

describe("a browser that reports nothing", () => {
  it("is left to the stylesheet's own answer", () => {
    expect(showing(null)).toBeNull();
  });
});
