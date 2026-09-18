import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The design system's checkable claims are about source and build output,
    // not about a rendered page, so these run in plain Node.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // A date shown to the traveler is in their timezone, so the tests fix one
    // rather than reading the machine's.
    env: { TZ: "UTC" },
  },
});
