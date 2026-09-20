import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { THEME_ATTRIBUTE, THEME_KEY, preferenceFrom, schemeFor } from "./theme";

describe("what a preference works out to", () => {
  it("gives the traveler the theme they switched to, whatever the machine is on", () => {
    expect(schemeFor("light", true)).toBe("light");
    expect(schemeFor("dark", false)).toBe("dark");
  });

  it("follows the machine until they have switched at all", () => {
    expect(schemeFor("system", true)).toBe("dark");
    expect(schemeFor("system", false)).toBe("light");
  });
});

describe("what a stored value means", () => {
  it("takes the two themes", () => {
    expect(preferenceFrom("light")).toBe("light");
    expect(preferenceFrom("dark")).toBe("dark");
  });

  it("treats a traveler who has never switched, and one who stored something this version does not know, the same", () => {
    expect(preferenceFrom(null)).toBe("system");
    expect(preferenceFrom("")).toBe("system");
    expect(preferenceFrom("sepia")).toBe("system");
  });
});

describe("the theme settled before the first paint", () => {
  const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

  // The snippet in the head runs before this module exists and has to reach
  // the same two strings by writing them out again. They drift silently: a
  // renamed key leaves the snippet reading an entry nobody writes, and the
  // only symptom is a flash of the wrong theme on the way in.
  it("reads the entry this module writes, and sets the attribute it sets", () => {
    expect(markup).toContain(`"${THEME_KEY}"`);
    expect(markup).toContain(`"${THEME_ATTRIBUTE}"`);
  });
});
