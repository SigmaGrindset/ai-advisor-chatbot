# Pages are real addresses, and there are almost none of them

A page is a real address — `/trips`, and `/instructions` after it — pushed onto the
history and read back out of `window.location`, not a piece of state called `screen`. A
traveler can be *at* the Trips page, so a reload, a bookmark, a shared link and the back
button all have to land where they were; the application is already served with a fallback
to `index.html` on any path the API does not claim (`app/frontend.py`), which exists for
exactly this.

Almost nothing is allowed to be one. ADR-0006 settled that the Trip Plan is a pane and
never a destination, and routes sharpen that reasoning: a page is for the things about
**none of the open Conversations in particular** — every Trip at once, and the Advisor
Instructions. Anything about the Conversation in front of the traveler stays beside it. A
third kind of thing wanting a page has to argue with this ADR.

No routing library: React Router is four figures of kilobytes and a vocabulary for a
`PATHS` literal with two entries. The same argument as ADR-0005's hand-written tool loop —
what is avoided is not the dependency but having to know a framework's answer to a
question this application asks once.

The state every screen needs therefore lives above the route, in `App.tsx`. Navigating
swaps what is drawn and nothing else, so a reply still arriving when the traveler opens
the Trips page is still arriving when they come back; a router that owned the screens
would unmount the turn with them.
