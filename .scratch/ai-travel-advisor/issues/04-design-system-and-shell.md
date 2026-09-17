# 04: Design system and desktop shell

**What to build:** The application stops looking like scaffolding. A traveler on a laptop
sees the Conversation list, the chat, and a right-hand pane at the same time, rendered in a
deliberate visual system rather than browser defaults.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Colour, spacing, radius and type are defined once as semantically named tokens
      consumed through the Tailwind theme; no component references a raw colour value
- [ ] Archivo (display), Geist Sans (body and interface) and Geist Mono (metadata and
      figures) are self-hosted as woff2; the application makes no runtime request to a
      third-party font service
- [ ] Figures that change in place use tabular numerals
- [ ] Icons come from Lucide at a 1.5 stroke weight, restricted to two sizes, with no
      sparkle, bot, zap or wand glyph anywhere
- [ ] At 1100px and above the layout is three panes: Conversation list, chat, and a right
      pane carrying **Plan** and **Traveler** tabs (the tab contents may be placeholders)
- [ ] The clay accent and the four semantic tints — changed, verified, open, error — exist
      as tokens with verified contrast
- [ ] Each Trip has a deterministic pastel derived from its identity, available for use on
      chips
- [ ] Token naming is such that adding a dark theme later is one additional theme block;
      dark mode itself is not built
- [ ] Motion is limited to the streaming caret, field highlight, panel transitions and
      hover/focus transitions, and is suppressed under a reduced-motion preference
