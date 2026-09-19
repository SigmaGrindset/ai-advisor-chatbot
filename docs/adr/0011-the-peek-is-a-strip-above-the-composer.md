# The phone peek is a strip above the composer, not a resting state of the sheet

Amends ADR-0006, which says the Trip Plan on a phone is "a bottom sheet with a peek
state". Built, the peek is a strip of its own above the composer and the sheet has two
resting places rather than three. The traveler still sees the three states ADR-0006 asks
for — where and when while they type, half, and whole — but the first of them is not the
sheet.

The sheet is a modal `<dialog>` by ticket 06's decision, so the browser owns the focus
trap, the inertness of everything behind it, the back gesture and the return of focus. A
modal dialog resting permanently at the bottom of the screen would make the composer
inert, and a peek that stops the traveler typing is not a peek. A third snap point would
have to swap `close()` and `showModal()` mid-drag, taking a `close` event and a focus move
with it — failure modes all in the hand rather than on the screen, on a device this
machine cannot test on (ADR-0007).

So `PlanPeek` is a button, not a drawer: it opens the sheet at half, and dragging down
past half lands back on the strip. The strip is not there until there is something to put
in it, because a permanent line saying what will one day be there costs a line of
transcript on a screen with none to spare.
