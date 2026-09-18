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

Implemented, bar the last criterion. Eight of the nine are done and were driven through the
running application at 375×812 with touch emulation; **the pass on a real phone has not
happened and cannot be done from this machine**, so the ticket is `ready-for-human` rather
than closed. 102 frontend tests and 37 backend tests pass; `tsc --noEmit` and
`npm run build` are clean.

Measured on this machine, in the browser, against real data: at 1280px the three panes are
**240 / 640 / 400**, the geometry ADR-0006 names; at 900px the Conversation and the record
are **580 / 320** with the list as a left sheet; at 375px the Conversation has the screen
and both of the others are sheets. Every control is **44 × 44** under a coarse pointer and
back at its drawn 34px under a fine one.

Shape of it:

- **The sheet is a modal `<dialog>`**, which is the whole reason it is worth having one
  primitive. The browser then owns the focus trap, the inertness of everything behind it
  and the return of focus to whatever opened it — verified: closing returns focus to the
  control that opened the sheet. A hand-written trap gets one of those subtly wrong, and
  the one it gets wrong is only ever found by the traveler who depends on it.
- **Snap points are a pure module** (`snapping.ts`). Where a sheet comes to rest is the
  part with an opinion in it: a thumb never lets go on a snap point, a tie goes to the
  larger extent because a sheet that closes on a half-drag takes away what the traveler
  was reaching for, and a flick moves exactly one place because overshooting the middle
  state loses it. `dragging.ts` turns pointers into extents; `Sheet.tsx` is the dialog.
- **Four seams were agreed before any test was written**, as in 04 and 05: the snap rule,
  the visible viewport, the layout rule, and a source-and-build guard. Nothing renders a
  component to assert on it. Each of the four guards was checked by putting the bug back
  and watching it fail.
- **`viewport.ts` is why the composer survives a keyboard.** `100dvh` is the tallest a
  stylesheet can be told the window is, and on a phone it is wrong: the keyboard takes half
  the screen without resizing anything CSS can see, and the phone scrolls the page up
  underneath as well. The shell is sized and placed from `window.visualViewport` instead,
  and left alone while the traveler is pinched in — a magnified page reports a viewport a
  third of the size, and a shell that believed it would reflow to a phone layout under
  their fingers. Driven: told the shell it had 420px starting 96px down, and the composer
  moved from y=741 to y=401–445, inside the band.
- **The layout is chosen in TypeScript, not only in CSS.** A pane and a sheet cannot be one
  element hidden twice: rendering the record into both and showing whichever the media
  query allows would give two tab strips disagreeing about which tab is open, and two of
  every identifier on the page. `layout.ts` answers it once, each thing is mounted once,
  and `layout.test.ts` reads the theme's own `--breakpoint-*` back so the two never drift.
- **Row actions are behind one permanently visible overflow control**, and the strip it
  opens holds Delete, which then asks. No hover, no swipe: a pointer is an affordance a
  touch screen has not got, and a swipe would fight the sheet the list sits in on a phone.
  A guard test fails the build on any `group-hover:` or hover-reveals-visibility class.
- **The manifest, the theme colour and four PNG icons** ship, and a backend test asserts
  the manifest is served as `application/manifest+json` — a browser offers to install
  nothing whose manifest arrives as a generic download, and that would have failed on the
  device rather than here. `scripts/icons.mjs` draws the mark over `node:zlib`, reading the
  clay out of `tokens.css` so a re-theme cannot leave an old accent on somebody's home
  screen. No service worker, and a test that says so.

Five bugs the tests could not have caught, all found by driving the running application:

- **Escape closed the sheet and the row's actions together.** A dialog's close request is
  the *default action* of that key, and nothing inside the sheet can stand in front of it —
  `stopPropagation` in the list did not help, because default actions are not propagation.
  Escape is taken on `keydown` and prevented, so one press is one thing: the first closes
  the row's actions, the second closes the sheet. Verified in that order.
- **Focusing the panel scrolled the sheet out of place.** A sheet resting part of the way
  out leaves the rest of its panel below the screen, and hidden overflow is still
  *scrollable* overflow: bringing the focused panel into view scrolled the dialog by
  exactly the distance the sheet had left to travel, so it came to rest the right size in
  the wrong place — `scrollTop: 365` on an 812px screen. `overflow: clip` and
  `focus({ preventScroll: true })`.
- **The opening transition depended on `requestAnimationFrame`.** A page that is not being
  painted never delivers one, and the sheet then sat invisible at extent 0 with the page
  already modal behind it. The starting position is resolved by reading a layout value
  instead, which needs no frame.
- **Under a reduced-motion preference the sheet held the page inert for 400ms after it had
  gone**, because the close waited a duration it had assumed. It reads its own travel off
  the page now: 310ms ordinarily, 70ms under reduced motion, both measured.
- **`transitionend` on the dialog caught colour transitions from the controls inside it.**
  Every control in a sheet transitions its colours and those events bubble, so a close
  button finishing its hover would have shut the sheet mid-flight — exactly the vanishing
  the wait exists to prevent. Narrowed to the panel's own `transform`.

Two more came out of the review, both real:

- **The composer was still capped at `40dvh`.** `dvh` corrects for the browser's chrome and
  knows nothing about a keyboard, so a grown field was free to take 40% of a screen it was
  only being shown half of, leaving the transcript nothing — the exact failure this ticket
  exists to prevent, left in the one control it is about. It is capped against
  `--spacing-viewport` now: 325px with the keyboard shut, 168px with it open, measured. The
  guard test was extended to reject `dvh` as well as `vh` everywhere but the theme.
- **Two guards were partly vacuous.** The overscroll guard's pattern opened on a backtick
  and closed on a double quote, so it stopped at the first string inside an interpolation
  and never read a template-literal class list at all; and the unit guard read comments as
  code, so prose explaining why `100dvh` is wrong counted as using it. Both fixed, both
  re-checked by mutation.

Deliberate deviations, and what was left for later tickets:

- **The record pane is a bottom sheet on a phone, which this ticket did not ask for.** 06
  is what creates the band below 768px, and without this the Plan and Traveler panels are
  simply unreachable there — the same mistake 04 avoided when it kept the list rather than
  dropping it into a sheet that did not exist yet. It rests at half and whole.
  **ADR-0006's peek state is not built**: it is meant to hold the destination and the dates
  in view while the traveler types, and there is no Trip Plan to put in it until 09, so a
  permanent strip saying what will one day be there would take a line of the transcript for
  nothing. 09 adds a third number to `RECORD_SNAPS` and the sheet keeps working.
- **The left sheet uses the primitive's single-stop case**, so the snap machinery is
  exercised by the record sheet and by `snapping.test.ts` rather than by the list. That is
  what the criterion asks for — one primitive, applied to the list — rather than a drawer
  pretending to have states it has no use for.
- **A 44px minimum on controls under `(pointer: coarse)` is not one of the criteria.** The
  ticket's own framing is "reach every control with a thumb", and 34px icon buttons beside
  each other are two guesses. It is asked as a question about the pointer rather than about
  the window, because a touchscreen laptop is not a phone and a phone held in a
  desktop-width window still is one.
- **The composer's keyboard hint is hidden below 768px.** It is two lines of advice about
  keys the traveler has not got, on the screen with none to spare.
- **Breakpoint *transitions* could not be driven in the built-in browser.** It changes the
  emulated metrics without firing `resize` or a `matchMedia` change, so the shell never
  hears about it — a limitation of the tool, confirmed by probing for both events and
  getting neither. Each layout was verified by loading at that width, and the subscription
  path by firing the breakpoint's own `change` event, which moved the shell from tablet to
  desktop. The hook listens to the two media queries rather than to `resize`, which is the
  narrower and more reliable signal on a real device anyway.
- **The `#faf8f5` theme colour is written out in `index.html` and in the manifest**, which
  are the two files outside the design system's reach. A test asserts all three agree with
  `--color-canvas`, so drift fails the build rather than the device.
- **`sm:` (the framework's 640px) still does the padding inside the Conversation pane**,
  as it did before this ticket. Whether a pane is a sheet and how much padding it has are
  different questions, and only the first one is the shell's.
