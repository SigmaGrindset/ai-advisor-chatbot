# The phone peek is a strip above the composer, not a resting state of the sheet

Amends ADR-0006, which says the Trip Plan on a phone is "a bottom sheet with a peek state".
Built, the peek is a strip of its own above the composer, and the sheet has two resting
places rather than three. The traveler sees the three states ADR-0006 asks for — where and
when while they type, half, and whole — but the first of them is not the sheet.

The sheet is a modal `<dialog>`, and that is not incidental: ticket 06 chose it so the
browser owns the focus trap, the inertness of everything behind it, the back gesture and
the return of focus. A modal dialog resting permanently at the bottom of the screen would
make the composer inert. The peek exists so the traveler can see the plan **while they
type**, so a peek that stops them typing is not a peek.

## Considered Options

- **A third snap point on the sheet, non-modal at peek and modal above it.** The honest
  reading of ADR-0006's words. It needs `close()` and `showModal()` to swap mid-drag —
  a dialog already open cannot be shown modally, so the sheet must be closed and reopened
  while a thumb is on it, taking a `close` event and a focus move with it. Rejected: the
  failure modes are all in the hand rather than on the screen, on a device this machine
  cannot test on (ADR-0007), to satisfy the wording of a decision rather than its point.
- **Leaving the peek unbuilt,** as ticket 06 did while there was no plan to put in one.
  Rejected: there is a plan now, and a phone without the peek loses the property ADR-0006
  exists for — the plan taking shape where the traveler can see it happening.

## Consequences

**The sheet primitive is still the only sheet**, which is what ticket 09 was told not to
break. `PlanPeek` is a button, not a drawer: it has no snap points, no drag and no scrim.
It opens the sheet at half, and dragging the sheet down past half closes it and lands back
on the strip, so the three states still cycle in both directions under a thumb.

**The strip is not there until there is something to put in it.** No destination and no
dates means no strip, for the reason ticket 06 gave for building none: a permanent line
saying what will one day be there costs the transcript a line on the screen with none to
spare.

**A drag upward from the strip does nothing; a tap opens it.** One gesture rather than
two, and the discoverable one. If a real-device pass says a thumb reaches for the drag,
the strip is where that would be added.
