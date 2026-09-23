# AI Travel Advisor

Status: closed

## Problem Statement

A traveler planning a real trip has nowhere to think the trip through. General chat
assistants answer travel questions fluently but guess at anything current — an exchange
rate, today's weather, whether their passport needs a visa — and a wrong visa answer is
worse than no answer. They forget everything between sessions, so a traveler who returns
tomorrow re-explains who they are, where they live, and who they are travelling with. And
whatever plan emerges exists only as prose scattered through a transcript: there is no
single place to look at the trip, and no way to change one part of it without asking for
the whole thing again.

Along the way the traveler hands over personal details — nationality, passport
information, travel dates, who they are travelling with — and has no way to see what was
kept, no way to remove it, and no idea what left the machine.

## Solution

A web application where a traveler converses with an **Advisor** — an AI travel advisor
that stays in role, reaches out for facts it cannot know, remembers the traveler across
**Conversations**, and produces a **Trip Plan** as a durable, structured artifact that
sits beside the conversation and takes shape while they talk.

The Advisor calls **Live-data Tools** for volatile facts and attaches **Citations** to
what it fetched, so a visa answer arrives with sources rather than confidence. What it
learns about the traveler is recorded as **Profile Facts** in a **Traveler Profile** the
traveler can read and delete from, fact by fact. The **Advisor Instructions** are editable
on their own page, and changes take effect on the next message.

## Out of Scope

- Authentication, user accounts, and multiple travelers in one deployment.
- Dark mode. Token naming accommodates it; the theme is not built.
- Frontend unit tests, component tests, and browser end-to-end tests.
- Touch gestures such as swipe-to-delete, beyond a sheet's own standard dismissal.
- Offline support and any service worker.
- Encryption at rest. Personal data is stored in plaintext, deliberately and documented.
- Redaction of personal data on the way to the model, as distinct from egress to other third
  parties.
- Drag-and-drop reordering of Itinerary Items, and rich text within plan notes.
- Editing or regenerating an already-sent Message.
- Booking, payment, or any transaction; the application plans trips, it does not buy them.
- Internationalisation and localisation.
- Rate limiting, abuse protection, and horizontal scaling.
