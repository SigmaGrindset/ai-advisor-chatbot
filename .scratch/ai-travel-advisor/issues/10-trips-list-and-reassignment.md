# 10: Trips list and reassignment

**What to build:** A traveler planning more than one journey can tell them apart. Several
Conversations refining one Trip are visibly a group, all Trips are listable in one place,
and a Conversation the Advisor attached to the wrong Trip can be moved.

**Blocked by:** 09.

**Status:** ready-for-agent

- [x] A Trips page lists every Trip with a summary of its Trip Plan
- [x] Each row in the Conversation list carries a Trip chip in that Trip's deterministic
      pastel, so threads about one journey are recognisable at a glance
- [x] A Conversation with no Trip yet is shown as such rather than hidden or grouped
      arbitrarily
- [x] A Conversation can be reassigned to a different Trip, or detached from one
- [x] Several Conversations attached to the same Trip refine the same Trip Plan
- [x] The Trip switcher in the plan pane header moves between Trips
- [x] Mobile behaviour ships with this ticket, on the 06 primitives
- [x] A test asserts that two Conversations attached to one Trip see the same Trip Plan

## Comments

All eight criteria are done and were driven through the running application against a real
model. **84 backend tests** (was 75) and **99 frontend tests in 14 files** (was 84 in 11);
`tsc --noEmit` silent, `npm run build` clean, mypy clean over 46 files.

- **The first client-side route.** `routes/routing.ts` is two addresses and no router: `/`
  and `/trips`. A traveler can be *at* the Trips page, so a reload, a bookmark and the
  back button all have to land where they were, and `frontend.py`'s fallback to
  `index.html` was written for exactly that. ADR-0012 records what is allowed to be a
  page; ticket 12's is one more line in `PATHS`.
- **The switcher is the reassignment.** The thing at the head of the plan that says which
  Trip you are looking at is the thing that changes it, with "Not on a trip" as the last
  entry — that is where the mistake shows (ADR-0002). It opens in flow rather than over
  anything, because on a phone it sits inside the record sheet and a menu floating out of
  a modal `<dialog>` is a second layer to escape from; its Escape calls `preventDefault`
  as well as `stopPropagation`, which is what the sheet's own handling reads.
- **The Trips list is kept rather than re-read.** A Trip is born mid-turn and
  `plan_revised` already carries the whole plan, so `withPlan` and `markTrip` put the card
  and the chip up without a round trip. `GET /api/trips` answers with whole plans for the
  same reason: a thinner shape would be a second thing to keep true.
- **`AppFrame` is new and small** — the fixed, keyboard-aware window lifted out of
  `AppShell`, because a composer surviving a virtual keyboard is not a property to have on
  one screen and not the other.
- **Three pure modules carry the opinions**, which is where the frontend tests are:
  `routing.ts`, `trip/naming.ts` and `trip/listing.ts`.

Ruled on rather than assumed:

- **A Conversation on no Trip carries no chip.** It is said where that is a fact rather
  than an absence: the switcher's "Not on a trip", and the Trips page's own section.
- **Only the open Conversation can be reassigned**, because the correction belongs where
  the mistake is visible. The Trips page is one click from opening any of them.
- **No way to create or delete a Trip by hand**, and detaching the last Conversation
  leaves the Trip listed: the plan is the durable thing, the Conversations are how it got
  written.
- **The Trips page lists the Conversations refining each Trip**, which the criteria do not
  ask for; it is what makes several of them read as a group rather than as a repeated
  word.

Two things worth knowing: the advisor sometimes answers "Done." without calling the tool
and so starts no Trip — check `/api/trips`, not the reply; and two of the twelve pastels
read as green at chip size, which `design/tripPastel.ts` accepts by design since the chip
carries the Trip's name as well as its colour.

Left for a human: nothing on this ticket. Ticket 06's real-phone pass is still open and
still 06's.

### After the two-axis review

Fixed: *thread* had become the change's working noun where `CONTEXT.md` puts it on
**Conversation**'s `_Avoid_` line (a `Threads` component and twenty-nine uses in prose);
the switcher's open list now says "Move this conversation to", since a chip and a chevron
read as a way of looking rather than of moving; ADR-0012 written, because ADR-0006 had
rejected routing for the plan; `markTrip` deduplicated out of `noteTrip` and `attach`;
`routing.test.ts` pins `/trips` itself rather than round-tripping the literal both
functions read; `loose` → `unattached` and `Attaching` → `ChosenTrip`.

Left as built, and argued above: reassignment from the open Conversation only; the
switcher answering both criteria, since one that changed only what is displayed would
leave the traveler editing one Trip while the advisor patches another; whole plans on
`GET /api/trips`; and `api/conversations.py` calling `db/trips.py` directly, as ticket 09
ruled for `api/trips.py`.
