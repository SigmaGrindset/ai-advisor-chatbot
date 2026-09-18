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

Implemented. Verified on this machine, in the browser, against the running application and
its real data: at 1280px the three panes measure **240 / 640 / 400**, which is the geometry
ADR-0006 names; at 1100px the third pane appears and below it stands down. The page loads
with **zero cross-origin resource requests** and all three variable faces reporting
`loaded`. The streaming caret renders 2px wide by one line high in the accent, animating
`caret 1.1s infinite`. 29 frontend tests and 36 backend tests pass; `tsc --noEmit` and
`npm run build` are clean.

Shape of it:

- `src/tokens.css` is the whole system, and the only file in the project allowed to say
  what a colour is. It opens by turning the framework's own vocabulary **off** —
  `--color-*: initial`, `--text-*: initial`, `--radius-*: initial` — so "no component
  references a raw colour value" is not a rule anyone has to remember: `bg-neutral-900`
  and `text-white` simply do not compile to anything any more.
- The block is `@theme static`, so every token reaches the stylesheet rather than only the
  ones a component happens to spend yet. Tailwind prunes unused theme variables by default,
  which would have left `--color-changed`, `--color-verified` and `--color-open` defined in
  source and absent from the page — tokens 09 and 11 are meant to inherit, not rediscover.
- Token names say what a thing is **for**, never how it looks: `canvas`, `sunken`, `ink`,
  `ink-subtle`, `line-strong`, `accent`, `changed`, `verified`, `open`, `error`. A test
  rejects any name matching `white|black|light|dark|cream|grey|sand|warm|pale`, because a
  token called `--color-cream` cannot be redefined for a dark theme without lying about
  itself. Adding that theme is one more block of the same names.
- **This ticket added the project's first frontend test framework** (Vitest). 03 recorded
  that there was none and that choosing one was not its call; four of this ticket's criteria
  are mechanically checkable, so it became this one's. The seams were agreed before any test
  was written: the Trip pastel, token contrast, the component vocabulary, and the fonts.
- The contrast test parses `tokens.css` as written and measures real WCAG ratios: body text
  clears 7:1, the accent and all four tints clear 4.5:1 on canvas, on surface and on their
  own tint, and the focus ring clears 3:1 on everything it can land on. Two colours were
  changed *because* the test rejected them, which is the point of having it.
- The fonts test runs a real Vite build and asserts on the output — woff2 and nothing
  heavier, no `fonts.googleapis.com`-class origin anywhere, nothing in `index.html` loaded
  from another origin, and every face named actually declared over a file we serve.
- `tripPastel` derives hue from an FNV-1a hash of the Trip's identity and holds lightness
  and chroma **fixed**, converting Oklch to sRGB itself. Hue is the only thing identity
  chooses, which is what makes every Trip's chip equally pale and every Trip's label
  equally readable, rather than one Trip drawing a colour nobody can read. Twelve hues
  rather than a continuous wheel: an honest repeat beats two Trips landing three degrees
  apart and looking identical without being identical.
- Icons are two sizes and one stroke weight, spread from `design/icons.ts` onto every
  glyph. A test reads that module and fails if a third size appears, and scans every
  component for inline `<svg>` and for the sparkle/bot/zap/wand family.
- `env(safe-area-inset-bottom)` is on the composer and the composer's input is 16px, both
  named by ADR-0007 as structural commitments rather than a later pass. They cost nothing
  now and are expensive to retrofit, which is the ADR's whole argument.

Deliberate deviations, and what was left for later tickets:

- **Below 1100px it is the third pane that stands down, not the list — the reverse of
  ADR-0006.** The ADR has the list giving way first, and it will, but only once 06 has
  built the left sheet it gives way *to*. Dropping the list now would leave a narrow window
  with no way to reach any other Conversation. The interim keeps navigation and defers the
  pane whose contents are still placeholders; the comment in `App.tsx` says so.
- **The transcript's typography overlaps 05's first criterion.** 04 cannot make the
  application "stop looking like scaffolding" while leaving the messages at browser
  defaults, so the two voices are set in different faces — the traveler's words in Archivo,
  the advisor's in Geist — rather than boxed. That is arguably 05's "distinguished without
  chat bubbles" arriving early. Everything else 05 owns is untouched: no Markdown renderer,
  no retry, no stop control, no sticky-scroll rule, no first-run greeting, no starter
  prompts, and **no live region** — an earlier draft had one, and it was removed both
  because it is 05's and because a live region mounted already holding its text is commonly
  not announced at all.
- **An earlier draft put a relative timestamp beside each row in the list**, to give the
  tabular-figures criterion something to stand on. It was removed: 03 recorded that "the
  list shows titles and nothing else — no timestamps, no Trip grouping". Tabular figures
  are provided by the system instead, on `time`, `code`, `kbd` and `samp` in the base layer,
  ready for the first figure that actually changes in place.
- **`tripPastel` has no caller yet**, which reads as speculative generality until you notice
  the criterion says "available for use on chips" — there is no Trip in the application to
  put a chip on until 09 and 10. It is exercised by its tests and by nothing else.
- Dark mode is not built, only accommodated. The changed-field highlight is named in the
  ticket's list of *permitted* motion but belongs to 09, so neither the animation nor its
  keyframes ship; `--color-changed` and its tint do.
- The web application manifest and touch icon the spec mentions are 06's, with the rest of
  the mobile work.
