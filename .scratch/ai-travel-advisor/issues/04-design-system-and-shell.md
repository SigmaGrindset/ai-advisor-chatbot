# 04: Design system and desktop shell

**What to build:** The application stops looking like scaffolding. A traveler on a laptop
sees the Conversation list, the chat, and a right-hand pane at the same time, rendered in a
deliberate visual system rather than browser defaults.

**Blocked by:** 03.

**Status:** ready-for-agent

- [x] Colour, spacing, radius and type are defined once as semantically named tokens
      consumed through the Tailwind theme; no component references a raw colour value
- [x] Archivo (display), Geist Sans (body and interface) and Geist Mono (metadata and
      figures) are self-hosted as woff2; the application makes no runtime request to a
      third-party font service
- [x] Figures that change in place use tabular numerals
- [x] Icons come from Lucide at a 1.5 stroke weight, restricted to two sizes, with no
      sparkle, bot, zap or wand glyph anywhere
- [x] At 1100px and above the layout is three panes: Conversation list, chat, and a right
      pane carrying **Plan** and **Traveler** tabs (the tab contents may be placeholders)
- [x] The accent and the four semantic tints — changed, verified, open, error — exist
      as tokens with verified contrast
- [x] Each Trip has a deterministic pastel derived from its identity, available for use on
      chips
- [x] Token naming is such that adding a dark theme later is one additional theme block;
      dark mode itself is not built
- [x] Motion is limited to the streaming caret, field highlight, panel transitions and
      hover/focus transitions, and is suppressed under a reduced-motion preference

## Comments

Implemented. Measured in the browser: at 1280px the three panes are **240 / 640 / 400**,
the geometry ADR-0006 names; the page loads with zero cross-origin requests and all three
variable faces `loaded`.

- **`design/tokens.css` is the only file allowed to say what a colour is.** It opens by
  turning the framework's own vocabulary off — `--color-*: initial` and friends — so "no
  component references a raw colour value" is not a rule anyone has to remember:
  `bg-neutral-900` simply does not compile to anything any more. The block is
  `@theme static`, because Tailwind prunes unused theme variables and would otherwise
  leave `--color-changed`, `--color-verified` and `--color-open` defined in source and
  absent from the page.
- **Names say what a thing is for, never how it looks** — `--color-cream` cannot be
  redefined for a dark theme without lying about itself.
- **`tripPastel` holds lightness and chroma fixed and lets identity choose only hue**,
  which is what makes every chip equally pale and every label equally readable. Twelve
  hues rather than a continuous wheel: an honest repeat beats two Trips three degrees
  apart looking identical without being identical.
- This ticket added the project's first frontend test framework (Vitest). Its token-name
  and WCAG guards were deleted later under the testing rule in `HANDOFF.md` §4 — they
  asserted the code was shaped as agreed rather than that anything worked — though two
  colours had been changed because the contrast one rejected them.

Deviations, and what was left for later tickets:

- **Below 1100px the third pane stands down, not the list — the reverse of ADR-0006.** The
  list will give way first, but only once 06 has built the left sheet it gives way *to*.
- **The transcript's typography is 05's, arriving early**, because 04 cannot stop the
  application looking like scaffolding while leaving messages at browser defaults.
  Everything else 05 owns is untouched, including the live region.
- **`tripPastel` has no caller yet** — there is no Trip to put a chip on until 09 and 10.
- Dark mode is accommodated, not built. The manifest and touch icon are 06's.
