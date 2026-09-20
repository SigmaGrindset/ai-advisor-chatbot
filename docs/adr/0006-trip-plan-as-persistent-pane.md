# The Trip Plan is a persistent pane, not a page you navigate to

The Trip Plan sits beside the conversation at all times — a third pane on desktop, a
bottom sheet on mobile — updating live as the advisor patches it, with changed fields
briefly highlighted. It is never a destination you navigate away to.

The brief's claim is that the plan "takes shape as they talk", and on its own route that
never happens on screen: the traveler talks, then leaves to discover something changed.
Inline as a card in the message stream fails the same brief from the other side — it asks
for "a distinct, structured thing... not just another chat message".

Horizontal space is tight — roughly 240 / 640 / 400 at 1280px. Below 1100px the
conversation list gives way before the plan does, because the plan is continuous context
while the list is occasional navigation.

On a phone the peek — destination and dates, held in view while the traveler types — is a
strip of its own above the composer rather than a third resting place of the sheet. The
sheet is a modal `<dialog>` by ticket 06's decision, so the browser owns the focus trap
and the inertness of everything behind it; one resting permanently at the bottom of the
screen would make the composer inert, and a peek that stops the traveler typing is not a
peek. `PlanPeek` is a button that opens the sheet at half, and dragging down past half
lands back on the strip, so all three states are reachable and only two of them are the
sheet.
