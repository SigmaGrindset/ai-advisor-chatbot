# The Trip Plan is a persistent pane, not a page you navigate to

The Trip Plan sits beside the conversation at all times — a third pane on desktop, a
bottom sheet with a peek on mobile (ADR-0011) — updating live as the advisor patches it,
with changed fields briefly highlighted. It is never a destination you navigate away to.

The brief's claim is that the plan "takes shape as they talk", and on its own route that
never happens on screen: the traveler talks, then leaves to discover something changed.
Inline as a card in the message stream fails the same brief from the other side — it asks
for "a distinct, structured thing... not just another chat message".

Horizontal space is tight — roughly 240 / 640 / 400 at 1280px. Below 1100px the
conversation list gives way before the plan does, because the plan is continuous context
while the list is occasional navigation.
