import { describe, expect, it } from "vitest";

import { FLICK, resting } from "./snapping";

/** A left sheet: one place to rest, and closed. */
const DRAWER = [1];

/** A bottom sheet: a peek, half the height, and all of it. */
const SNAPS = [0.3, 0.6, 1];

describe("a sheet let go slowly", () => {
  it("settles on whichever place it was nearest", () => {
    expect(resting(0.32, 0, SNAPS)).toBe(0.3);
    expect(resting(0.62, 0, SNAPS)).toBe(0.6);
    expect(resting(0.95, 0, SNAPS)).toBe(1);
  });

  it("counts closed as a place it can settle", () => {
    expect(resting(0.1, 0, SNAPS)).toBe(0);
    expect(resting(0.4, 0, DRAWER)).toBe(0);
  });

  it("keeps what the traveler can see when two places are equally near", () => {
    // Half a drag is not a decision to close, and a sheet that closes on one
    // is a sheet that eats the thing they were reaching for.
    expect(resting(0.5, 0, DRAWER)).toBe(1);
    expect(resting(0.15, 0, SNAPS)).toBe(0.3);
    expect(resting(0.45, 0, SNAPS)).toBe(0.6);
  });
});

describe("a sheet flicked", () => {
  it("goes the way it was thrown rather than where it happened to be", () => {
    // Let go at 0.35 it would settle back to the peek. Thrown upward it is
    // being opened, and the next place up is where it was thrown to.
    expect(resting(0.35, FLICK, SNAPS)).toBe(0.6);
    expect(resting(0.95, -FLICK, SNAPS)).toBe(0.6);
  });

  it("moves one place at a time, however hard it was thrown", () => {
    // A hard throw is not a request to jump the middle state: the traveler
    // asked for the next one, and overshooting it loses their place.
    expect(resting(0.35, FLICK * 20, SNAPS)).toBe(0.6);
    expect(resting(0.95, -FLICK * 20, SNAPS)).toBe(0.6);
  });

  it("closes when it is thrown down off the last place", () => {
    expect(resting(0.3, -FLICK, SNAPS)).toBe(0);
    expect(resting(0.9, -FLICK, DRAWER)).toBe(0);
  });

  it("stays where it is when it is thrown at a wall", () => {
    expect(resting(1, FLICK, SNAPS)).toBe(1);
    expect(resting(1, FLICK, DRAWER)).toBe(1);
  });

  it("is a drag rather than a flick below the threshold", () => {
    expect(resting(0.35, FLICK * 0.9, SNAPS)).toBe(0.3);
    expect(resting(0.95, -FLICK * 0.9, SNAPS)).toBe(1);
  });
});

describe("the places a sheet is given", () => {
  it("does not care what order they arrive in", () => {
    expect(resting(0.35, FLICK, [1, 0.3, 0.6])).toBe(0.6);
    expect(resting(0.62, 0, [1, 0.3, 0.6])).toBe(0.6);
  });

  it("never rests anywhere it was not given", () => {
    for (const extent of [0, 0.07, 0.2, 0.44, 0.5, 0.71, 0.88, 1]) {
      for (const velocity of [-FLICK * 3, -FLICK, 0, FLICK, FLICK * 3]) {
        expect([0, ...SNAPS]).toContain(resting(extent, velocity, SNAPS));
      }
    }
  });
});
