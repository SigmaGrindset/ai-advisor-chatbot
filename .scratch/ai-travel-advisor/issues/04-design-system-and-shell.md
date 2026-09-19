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
- [x] The clay accent and the four semantic tints — changed, verified, open, error — exist
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
variable faces `loaded`. 29 frontend and 36 backend tests pass; `tsc --noEmit` and
`npm run build` clean.

- **`src/tokens.css` is the only file allowed to say what a colour is.** It opens by
  turning the framework's own vocabulary off — `--color-*: initial` and friends — so "no
  component references a raw colour value" is not a rule anyone has to remember:
  `bg-neutral-900` simply does not compile to anything any more.
- The block is `@theme static`, because Tailwind prunes unused theme variables and would
  otherwise leave `--color-changed`, `--color-verified` and `--color-open` defined in
  source and absent from the page — tokens 09 and 11 are meant to inherit, not rediscover.
- **Names say what a thing is for, never how it looks.** A test rejects any name matching
  `white|black|light|dark|cream|grey|sand|warm|pale`, because `--color-cream` cannot be
  redefined for a dark theme without lying about itself.
- **This ticket added the project's first frontend test framework** (Vitest). 03 recorded
  that there was none and that choosing one was not its call; four of these criteria are
  mechanically checkable, so it became this one's. The seams were agreed before any test
  was written. The contrast test measures real WCAG ratios against `tokens.css` as
  written, and two colours were changed *because* it rejected them.
- **`tripPastel` holds lightness and chroma fixed and lets identity choose only hue**,
  which is what makes every chip equally pale and every label equally readable. Twelve
  hues rather than a continuous wheel: an honest repeat beats two Trips three degrees
  apart looking identical without being identical.
- `env(safe-area-inset-bottom)` on the composer and a 16px input are ADR-0007's structural
  commitments — free now, expensive to retrofit.

Deviations, and what was left for later tickets:

- **Below 1100px the third pane stands down, not the list — the reverse of ADR-0006.** The
  list will give way first, but only once 06 has built the left sheet it gives way *to*;
  dropping it now leaves a narrow window with no way to reach another Conversation.
- **The transcript's typography is 05's, arriving early.** 04 cannot stop the application
  looking like scaffolding while leaving messages at browser defaults, so the two voices
  are set in different faces. Everything else 05 owns is untouched — including **no live
  region**, removed from a draft both because it is 05's and because one mounted already
  holding its text is commonly not announced at all.
- **A relative timestamp per row was removed**, because 03 recorded that the list shows
  titles and nothing else. Tabular figures are provided by the system instead, on `time`,
  `code`, `kbd` and `samp`.
- **`tripPastel` has no caller yet** — there is no Trip to put a chip on until 09 and 10.
  It is exercised by its tests and by nothing else.
- Dark mode is accommodated, not built. The changed-field highlight belongs to 09, so
  neither the animation nor its keyframes ship; `--color-changed` does. The manifest and
  touch icon are 06's.
