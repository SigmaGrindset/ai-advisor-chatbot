# The Trip Plan is a persistent pane, not a page you navigate to

The Trip Plan sits beside the conversation at all times — a third pane on desktop, a
bottom sheet with a peek state on mobile — updating live as the advisor patches it, with
changed fields briefly highlighted. It is never a destination you navigate away to.

The brief's claim is that the plan "takes shape as they talk". If the plan lives on its
own route, that never happens on screen: the traveler talks, then leaves to discover
something changed. Keeping it in view is what makes the product's central idea legible
without explanation.

## Considered Options

- **The plan as its own route.** Simplest to build and the cheapest on horizontal space.
  Rejected because it hides the only moment that demonstrates the tool loop, the live data
  and the plan mutation all at once.
- **The plan rendered inline as a card in the message stream.** Rejected on spec grounds:
  the brief asks for "a distinct, structured thing... not just another chat message".

## Consequences

Horizontal space is tight — roughly 240 / 640 / 400 at 1280px — so the plan pane
collapses and the conversation list narrows. Below 1100px the conversation list gives way
first, because the plan is continuous context while the list is occasional navigation. On
a phone the peek state of the bottom sheet preserves the same property: destination and
dates stay visible above the composer, and the highlight still fires where the traveler
can see it.
