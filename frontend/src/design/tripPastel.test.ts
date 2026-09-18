import { describe, expect, it } from "vitest";

import { tripPastel } from "./tripPastel";
import { contrastRatio, luminance } from "./wcag";

/** Identities shaped like the ones the application mints for a Trip. */
const identities = Array.from({ length: 60 }, (_, index) => `trip_${index}${"abc"[index % 3]}`);

describe("the pastel a Trip is known by", () => {
  it("is the same every time it is asked for", () => {
    for (const identity of identities) {
      expect(tripPastel(identity)).toEqual(tripPastel(identity));
    }
  });

  it("does not depend on anything but the identity", () => {
    expect(tripPastel("b0e8b1d0-0e1a-4d3f-9c2b-0a1b2c3d4e5f")).toEqual(
      tripPastel("b0e8b1d0-0e1a-4d3f-9c2b-0a1b2c3d4e5f"),
    );
  });

  it("gives neighbouring Trips visibly different colours", () => {
    const distinct = new Set(identities.map((identity) => tripPastel(identity).background));
    expect(distinct.size).toBeGreaterThan(6);
  });

  it("is pale enough to sit under text on a chip", () => {
    for (const identity of identities) {
      expect(luminance(tripPastel(identity).background)).toBeGreaterThan(0.6);
    }
  });

  it("carries ink that reads against it", () => {
    for (const identity of identities) {
      const { background, ink } = tripPastel(identity);
      expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("carries a border between its fill and its ink in weight", () => {
    for (const identity of identities) {
      const { background, border, ink } = tripPastel(identity);
      expect(luminance(background)).toBeGreaterThan(luminance(border));
      expect(luminance(border)).toBeGreaterThan(luminance(ink));
    }
  });
});
