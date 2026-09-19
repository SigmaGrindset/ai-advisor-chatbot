# The phone peek is a strip above the composer, not a resting state of the sheet

Amends ADR-0006, which says the Trip Plan on a phone is "a bottom sheet with a peek
state". Built, the peek is a strip of its own above the composer and the sheet has two
resting places rather than three. The traveler still sees the three states ADR-0006 asks
for — where and when while they type, half, and whole — but the first of them is not the
sheet.

The sheet is a modal `<dialog>` by ticket 06's decision, so the browser owns the focus
trap, the inertness of everything behind it, the back gesture and the return of focus. A
modal dialog resting permanently at the bottom of the screen would make the composer
inert, and a peek that stops the traveler typing is not a peek.

## Considered Options

- **A third snap point, non-modal at peek and modal above it.** The honest reading of
  ADR-0006's words. It needs `close()` and `showModal()` to swap mid-drag — a dialog
  already open cannot be shown modally — so the sheet must be closed and reopened with a
  thumb on it, taking a `close` event and a focus move with it. Rejected: the failure
  modes are all in the hand rather than on the screen, on a device this machine cannot
  test on (ADR-0007), to satisfy the wording of a decision rather than its point.
- **Leaving the peek unbuilt,** as ticket 06 did while there was no plan to put in one.
  Rejected: there is a plan now, and a phone without the peek loses the property ADR-0006
  exists for.

## Consequences

**The sheet primitive is still the only sheet.** `PlanPeek` is a button, not a drawer: no
snap points, no drag, no scrim. It opens the sheet at half, and dragging down past half
closes it and lands back on the strip, so the three states cycle in both directions under
a thumb. A drag upward from the strip does nothing; a tap opens it — one gesture rather
than two, and the discoverable one.

**The strip is not there until there is something to put in it.** No destination and no
dates means no strip, for the reason ticket 06 gave for building none: a permanent line
saying what will one day be there costs a line of transcript on the screen with none to
spare.
