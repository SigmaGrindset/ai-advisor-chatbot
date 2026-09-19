import { describe, expect, it } from "vitest";

import { pathFor, routeFor } from "./routing";

describe("the address of a page", () => {
  it("is /trips for the Trips page", () => {
    // The literal, because this is the address a traveler bookmarks and the
    // one a reload has to arrive back at.
    expect(pathFor("trips")).toBe("/trips");
  });

  it("is /instructions for the Advisor Instructions page", () => {
    expect(pathFor("instructions")).toBe("/instructions");
  });

  it("is the root for the application itself", () => {
    expect(pathFor("conversations")).toBe("/");
  });
});

describe("which page an address names", () => {
  it("reads the Trips page back from /trips", () => {
    expect(routeFor("/trips")).toBe("trips");
  });

  it("reads the Advisor Instructions page back from /instructions", () => {
    expect(routeFor("/instructions")).toBe("instructions");
  });

  it("ignores a trailing slash, which browsers and people both add", () => {
    expect(routeFor("/trips/")).toBe("trips");
    expect(routeFor("/instructions/")).toBe("instructions");
  });

  it("lands a traveler on the application rather than nowhere", () => {
    // Any path resolves to the bundle, so an address nobody wrote a page for
    // still arrives here — it has to be somewhere usable.
    expect(routeFor("/trips/lisbon-in-april")).toBe("conversations");
    expect(routeFor("/somewhere-else")).toBe("conversations");
    expect(routeFor("/")).toBe("conversations");
  });
});
