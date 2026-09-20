# 06: Responsive and mobile

**What to build:** The application works properly in a hand, not just in a narrowed desktop
window. A traveler on a phone can hold a full conversation with the keyboard open, reach
every control with a thumb, and add the application to their home screen.

This ticket establishes the responsive primitives. Every UI ticket after it ships its own
mobile behaviour on top of them — 06 does not close mobile on its own.

**Blocked by:** 05.

**Status:** ready-for-human

- [x] At 1100px and above, three panes; between 768px and 1100px, chat and the right pane
      with the Conversation list as a sheet; below 768px, chat-first
- [x] A reusable sheet primitive with snap points exists and is applied to the Conversation
      list as a left sheet; later tickets reuse it rather than writing a second one
- [x] The composer stays visible and usable when the virtual keyboard opens, with viewport
      units that account for mobile browser chrome
- [x] The composer clears the device safe area
- [x] Focusing an input does not trigger zoom
- [x] No control's only affordance is hover; row actions use a visible overflow control
      rather than a swipe gesture
- [x] Nested scroll areas do not chain or rubber-band into one another
- [x] A web application manifest, theme colour and touch icon are present so the
      application installs to a home screen with a proper icon; no service worker is
      registered
- [ ] Verified at 375×812 with touch emulation and on a real phone

## Comments

Implemented, bar the last criterion. Eight of the nine were driven at 375×812 with touch
emulation; **the pass on a real phone cannot be done from this machine**, so the ticket is
`ready-for-human` rather than closed. 102 frontend and 37 backend tests pass;
`tsc --noEmit` and `npm run build` clean.

Measured against real data: 1280px gives the three panes **240 / 640 / 400**; 900px gives
**580 / 320** with the list as a left sheet; 375px gives the Conversation the screen and
makes the other two sheets. Every control is **44 × 44** under a coarse pointer and back
at its drawn 34px under a fine one.

- **The sheet is a modal `<dialog>`**, which is the whole reason it is worth having one
  primitive: the browser owns the focus trap, the inertness behind it and the return of
  focus to whatever opened it. A hand-written trap gets one of those subtly wrong, and the
  one it gets wrong is only ever found by the traveler who depends on it.
- **Snap points are a pure module** (`snapping.ts`), because where a sheet rests is the
  part with an opinion in it: a thumb never lets go on a snap point, a tie goes to the
  larger extent because a sheet that closes on a half-drag takes away what the traveler
  was reaching for, and a flick moves exactly one place because overshooting the middle
  state loses it.
- **`viewport.ts` is why the composer survives a keyboard.** `100dvh` is the tallest a
  stylesheet can be told the window is, and on a phone it is wrong: the keyboard takes
  half the screen without resizing anything CSS can see. The shell is sized from
  `window.visualViewport` instead, and left alone while the traveler is pinched in — a
  magnified page reports a third of the size, and a shell that believed it would reflow to
  a phone layout under their fingers.
- **The layout is chosen in TypeScript, not only in CSS.** Rendering the record into both
  a pane and a sheet and showing whichever the media query allows would give two tab
  strips disagreeing about which tab is open, and two of every identifier on the page.
  `layout.ts` answers it once and reads the theme's own `--breakpoint-*` back so the two
  cannot drift.
- **Row actions are behind one permanently visible overflow control.** No hover, no swipe:
  a pointer is an affordance a touch screen has not got, and a swipe would fight the sheet
  the list sits in on a phone. A guard test fails the build on any
  hover-reveals-visibility class.
- A backend test asserts the manifest is served as `application/manifest+json` — a browser
  offers to install nothing whose manifest arrives as a generic download, and that would
  have failed on the device rather than here. `scripts/icons.mjs` reads the accent out of
  `tokens.css` so a re-theme cannot leave an old accent on somebody's home screen.

Seven bugs found by driving the application, none of which a test would have caught.
Escape is a dialog's *default action*, which `stopPropagation` cannot stand in front of,
so it is taken on `keydown` and prevented: one press is one thing. Hidden overflow is
still *scrollable* overflow, so bringing a focused panel into view scrolled a part-open
sheet by exactly its remaining travel — `overflow: clip` and
`focus({ preventScroll: true })`. The opening transition depended on
`requestAnimationFrame`, which a page that is not being painted never delivers, leaving
the sheet invisible with the page already modal behind it; the starting position is read
off a layout value now. The close waited an assumed duration, holding the page inert for
400ms after the sheet had gone under reduced motion; it reads its own travel instead —
310ms and 70ms, measured. `transitionend` bubbles, so a close button finishing its hover
would have shut the sheet mid-flight; narrowed to the panel's own `transform`. From the
review: the composer was still capped at `40dvh`, which knows nothing about a keyboard and
so was free to take 40% of a screen it was being shown half of — capped against
`--spacing-viewport` now, 325px shut and 168px open. And two guards were partly vacuous —
one pattern opened on a backtick and closed on a double quote, so it never read a
template-literal class list, and the unit guard read comments as code. Both re-checked by
mutation.

Deviations, and what was left for later tickets:

- **The record pane is a bottom sheet on a phone, which this ticket did not ask for.** 06
  is what creates the band below 768px, and without this the Plan and Traveler panels are
  simply unreachable there. **ADR-0006's peek state is not built**: it is meant to hold
  the destination and dates in view while the traveler types, and there is no Trip Plan to
  put in it until 09. 09 adds a third number to `RECORD_SNAPS` and the sheet keeps
  working.
- **The left sheet uses the primitive's single-stop case.** That is what the criterion
  asks — one primitive, applied to the list — rather than a drawer pretending to have
  states it has no use for.
- **A 44px minimum under `(pointer: coarse)` is not one of the criteria**, but "reach
  every control with a thumb" is, and 34px icon buttons side by side are two guesses. It
  asks about the pointer rather than the window, because a touchscreen laptop is not a
  phone and a phone held in a desktop-width window still is one.
- **Breakpoint *transitions* could not be driven in the built-in browser**: it changes the
  emulated metrics without firing `resize` or a `matchMedia` change, confirmed by probing
  for both. Each layout was verified by loading at that width, and the subscription path
  by firing the breakpoint's own `change` event.
- The composer's keyboard hint is hidden below 768px — two lines of advice about keys the
  traveler has not got. `#faf8f5` is written out in `index.html` and the manifest, the two
  files outside the design system's reach, with a test asserting all three agree with
  `--color-canvas`. `sm:` still does the padding inside the Conversation pane, as before:
  whether a pane is a sheet and how much padding it has are different questions.
