import { describe, expect, it } from "vitest";

import { EASE, FLOOR, LAG, paced, settled } from "./writing";

const FRAME = 1 / 60;

/** The pace it settles at, given a backlog that is not going down. */
function heldAt(behind: number): number {
  let speed = 0;
  for (let frame = 0; frame < 60 * 3; frame += 1) speed = paced(speed, behind, FRAME);
  return speed;
}

describe("the pace a reply is drawn at", () => {
  it("does not jump when a burst lands", () => {
    // A burst of two hundred characters asks for a pace of nearly three
    // hundred a second. The frame it lands on must not draw at that pace, or
    // the burst is back — one frame of it, in one piece.
    const asked = 200 / LAG;
    expect(paced(0, 200, FRAME)).toBeLessThan(asked / 5);
  });

  it("gets there, over about the time it gives itself", () => {
    // Most of the way within one easing, and near enough all of it by two.
    const asked = 200 / LAG;
    expect(paced(0, 200, EASE)).toBeGreaterThan(asked * 0.6);
    expect(paced(0, 200, EASE * 3)).toBeGreaterThan(asked * 0.9);
  });

  it("settles at the pace the words are arriving at", () => {
    // Which is what keeps the page a fixed distance behind rather than
    // catching up and stalling, or falling further behind with every burst.
    expect(heldAt(140)).toBeCloseTo(140 / LAG, 0);
  });

  it("never falls below a speed somebody could read along with", () => {
    expect(heldAt(0)).toBeCloseTo(FLOOR, 0);
    expect(paced(FLOOR, 1, FRAME)).toBeGreaterThanOrEqual(FLOOR * 0.99);
  });
});

/** What the page would show of `text`, having got as far as `upto`. */
function shows(text: string, upto: number, more = true): string {
  return text.slice(0, settled(text, upto, more));
}

describe("where a reveal is allowed to stop", () => {
  it("stops between words rather than part way through one", () => {
    // A part-drawn word sits at the end of a line until the letter that no
    // longer fits arrives, and then the whole word drops to the next line.
    expect(shows("The quick brown fox", 13)).toBe("The quick ");
  });

  it("draws a word once the space after it says it is whole", () => {
    expect(shows("The quick brown fox", 16)).toBe("The quick brown ");
  });

  it("waits for an emphasis to close rather than drawing its markers", () => {
    // `**Hyde` is two asterisks and a word until `Park**` lands, and then the
    // asterisks vanish, the weight changes and the line reflows.
    expect(shows("Visit **Hyde Park** today", 13)).toBe("Visit ");
    // And draws the phrase whole, bold, in its final place, once it closes.
    expect(shows("Visit **Hyde Park** today", 20)).toBe("Visit **Hyde Park** ");
  });

  it("waits for a line that is still only its own markup", () => {
    expect(shows("Lisbon\n\n## ", 11)).toBe("Lisbon\n");
    expect(shows("Lisbon\n\n## Day one", 18)).toBe("Lisbon\n\n## Day ");
  });

  it("is not held up for ever by an asterisk nobody is going to close", () => {
    // A footnote marker or a multiplication is not an emphasis, and a reply
    // must not stop dead waiting for a partner that is never coming.
    const prose = `A note* and then ${"a good deal more prose ".repeat(4)}after it`;
    expect(shows(prose, 90).length).toBeGreaterThan(80);
  });

  it("waits for nothing once the last fragment has arrived", () => {
    // There is nothing left to come, so there is nothing left to wait for.
    expect(shows("Visit **Hyde Park", 17, false)).toBe("Visit **Hyde Park");
  });

  it("never asks for more than has arrived", () => {
    expect(settled("Lisbon", 99, true)).toBeLessThanOrEqual(6);
    expect(settled("Lisbon", 99, false)).toBe(6);
  });
});
