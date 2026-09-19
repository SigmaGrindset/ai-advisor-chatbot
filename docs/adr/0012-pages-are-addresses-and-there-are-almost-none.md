# Pages are real addresses, and there are almost none of them

Ticket 10 gave the application its first client-side route. This records both decisions
that came with it: **what is allowed to be a page**, and **what a router is here**.

A page is a real address — `/trips`, and `/instructions` after it — pushed onto the
history and read back out of `window.location`, not a piece of state called `screen`. A
traveler can be *at* the Trips page, so a reload, a bookmark, a shared link and the back
button all have to land where they were; the application is already served with a fallback
to `index.html` on any path the API does not claim (`app/frontend.py`), which exists for
exactly this.

Almost nothing is allowed to be one. ADR-0006 settled that the Trip Plan is a pane and
never a destination, and routes do not weaken that reasoning but sharpen it: a page is for
the things about **none of the open Conversations in particular** — every Trip at once,
and the Advisor Instructions. Anything about the Conversation in front of the traveler
stays beside it.

## Considered Options

- **A routing library.** React Router is four figures of kilobytes and a vocabulary
  (loaders, nested outlets, route objects) for a `PATHS` literal with two entries. The
  same argument as ADR-0005's hand-written tool loop: what is being avoided is not the
  dependency, it is having to know a framework's answer to a question this application
  asks once.
- **Hash addresses (`#/trips`).** Needs no server cooperation, and the server already
  cooperates. Rejected: a hash is not a path, and it would leave the SPA fallback — built,
  tested and deployed — doing nothing.
- **A `screen` in React state, no addresses at all.** Fewest moving parts, rejected on the
  reload: a traveler who refreshes the Trips page would be put back into a Conversation,
  and ticket 12's page is somewhere people will want to link to.

## Consequences

**The state every screen needs lives above the route**, in `App.tsx`. Navigating swaps
what is drawn and nothing else, so a reply still arriving when the traveler opens the
Trips page is still arriving when they come back. A router that owned the screens would
unmount the turn with them.

**`AppFrame` is the one window** — fixed, sized from the visible viewport and clear of the
safe areas, outside the route, because a composer that survives a virtual keyboard is not
a property to have on one screen and not another.

**A route that names no page is the application**: every path resolves to the bundle, so
anything unrecognised arrives somewhere usable rather than at a "not found". Adding ticket
12's page is one entry in `PATHS` and one branch in `App`; a third kind of thing wanting a
page has to argue with this ADR.
