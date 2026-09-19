# 09: The Trip Plan

**What to build:** The conversation starts producing something. As the traveler talks, a
structured Trip Plan fills in beside the chat — destination, dates, party, budget, the rough
shape of the days, and the questions still open. The traveler can change any part of it by
hand, and their edits survive whatever the Advisor does next.

Three decisions are settled and should not be relitigated mid-build. The Trip Plan is
**relational** — scalar fields as columns on the Trip, Itinerary Items and Open Questions as
their own tables — because ADR-0002 committed to field-level patches specifically so manual
edits are not clobbered, and a single JSON document makes every patch a read-modify-write of
the whole thing. A Conversation gets a Trip by the **first patch auto-creating one**, with a
single `join_trip` tool for attaching to an existing Trip from the list shown in context.
The phone presentation **reuses the sheet primitive from 06** rather than introducing a
second sheet implementation.

**Blocked by:** 07.

**Status:** ready-for-agent

- [x] A Trip owns exactly one Trip Plan; Itinerary Items and Open Questions are their own
      records rather than fields of a JSON document
- [x] The first plan patch in a Conversation with no Trip creates one; a `join_trip` tool
      lets the Advisor attach the Conversation to an existing Trip instead
- [x] The Advisor changes the plan through small typed tools that patch individual fields
      and collection entries; there is no whole-document write
- [x] The Plan tab renders destination, date range, party size, budget, Itinerary Items
      grouped by day, and Open Questions
- [x] A field the Advisor has just changed highlights briefly and fades
- [x] Editable fields carry a permanent dotted underline on every breakpoint; clicking one
      edits in place, blur saves, Escape cancels
- [x] A field the traveler is currently editing is immune to an incoming patch: the patch
      applies to everything else and the conflict is surfaced quietly rather than
      overwriting or interrupting
- [x] The traveler can add and remove Itinerary Items directly
- [x] Clicking an Open Question composes a matching prompt into the composer without
      sending it
- [x] An empty Trip Plan explains in one line what will fill it
- [x] On a phone the plan is a bottom sheet built on the 06 primitive, with a peek state
      showing destination and dates above the composer, plus half and full states
- [x] When the Plan tab is not showing, a change marks the tab rather than switching to it
- [x] A test asserts a field-level patch leaves other fields untouched
- [x] A test asserts a patch arriving for a field under edit does not overwrite it

## Comments

All fourteen criteria are done and were driven through the running application against a
real model. **75 backend tests** (was 64) and **84 frontend tests in 11 files** (was 56);
`tsc --noEmit` silent, `npm run build` clean, mypy clean over 45 files.

- **The plan is rows.** `Trip` carries the scalars, `itinerary_item` and `open_question`
  are tables of their own, and `conversation.trip_id` is nullable with
  `on delete set null`. Nine tools, each writing one field or one entry, and no whole-plan
  write anywhere — which is what lets the traveler's own edit survive the next turn rather
  than being read back stale and put straight back (ADR-0002).
- **Two catalogues, dispatched down two branches of the loop.** The Live-data Tools fetch
  and never write; the plan tools write and never fetch. That was a claim in
  `LiveDataTools`' docstring; it is a fact about `loop.py` now. **ADR-0009's last
  paragraph came due and is now ADR-0010**: once anything has been fetched into a turn the
  plan tools are gone for the rest of it. Both tripwire tests were rewritten rather than
  relaxed — the injection test now names `set_destination`, a tool that genuinely exists,
  asks for it after a search, and asserts it was refused *and* that no Trip was started.
- **The advisor points at entries by number, not by UUID.** `next_item_ref` and
  `next_question_ref` hand out numbers that are never reused, so an advisor working from
  the plan it was shown at the top of the turn cannot remove whatever has taken the place
  of something it removed a moment ago. The interface addresses the same rows by
  identifier.
- **Days are numbers, not dates.** Moving a trip a week later is one patch to `starts_on`
  rather than a rewrite of every item. What day 2 falls on is arithmetic in `dates.ts`,
  done in UTC throughout — a calendar day read as an instant west of Greenwich becomes the
  evening before, and shows the traveler a date they did not type.
- **Three pure modules carry the opinions**, which is where the new frontend tests are:
  `merging.ts`, `fields.ts`, `dates.ts`. `holding.ts` holds the plan; `PlanPanel` draws
  what it is handed. A patch that changes nothing is not reported as a change — a field
  lighting up for a change that was not one sends the traveler looking for something that
  did not happen.

Decided rather than assumed:

- **The phone peek is a strip above the composer, not a third snap point — ADR-0011, which
  amends ADR-0006.** The sheet is a modal `<dialog>` by 06's decision, and a modal sheet
  resting permanently over the composer would stop the traveler typing, which is the one
  thing the peek exists to let them do. The three states still cycle under a thumb. No
  second sheet.
- **Open Questions can be settled by hand as well as clicked.** The criteria only ask for
  add/remove on Itinerary Items, but the ticket's prose says any part of the plan can be
  changed by hand, and a question already settled is the most obvious thing to want gone.
- **A removal cannot start a Trip** — only a change that records something does. A test
  caught `remove_itinerary_item` creating an empty Trip to fail against.
- **Itinerary Items have no part-of-day when the traveler adds one.** Asking someone to
  pick morning or evening before they can write a line down is a form, not a plan.

Three bugs found by driving the application: "Use it" on a suggestion blurred the field
first, so the blur committed the half-typed draft and the two saves raced — the suggestion
controls prevent the default of the press now, so taking a suggestion abandons the open
editor rather than saving it; itinerary text was right-aligned because it shared the
editable field with the facts above it, and a sentence that wraps reads from the left, so
the field takes an alignment; and the unseen-change mark read the tab from the render that
started the turn, which a turn outlives, so it reads a ref now.

**A stale dev server from an earlier session was serving old code on `[::1]:8000`** while
the new one bound `127.0.0.1:8000` — `localhost` resolves to the IPv6 address first on
this machine, so both curl and Vite's proxy reached the old one and the plan never
appeared. Its `--reload` parent was gone but its worker still held the socket. Check
*which* process owns the port, not only that one is listening.

Left for a human: the real-phone pass, which is 06's open criterion rather than this
one's.

### After the two-axis review

Fixed: the underline was dashed where the criterion and ADR-0007 both say *dotted*;
clearing an Itinerary Item's text deleted the row, which one Backspace and a click away
could do silently, so clearing now saves nothing and removal is the control beside it; a
plan tool named after the tools had left the table fell through to the Live-data Tools to
be refused, so the traveler was told "Checking a live source" on behalf of a write that
was never made — the loop answers for any unknown name now; the peek strip tinted only for
destination and dates, though on a phone with the sheet closed it is the only place a
change can be noticed; `PATCH /trips/{id}/itinerary/{item_id}` accepted `day` and
`part_of_day` that nothing sent; `PLAN_FIELDS`, `PlanField` and `PlanPatch` moved to
`api/types.ts` where the API's vocabulary is, rather than being written out twice;
`describe_briefly` moved beside its two siblings in `advisor/planning.py`; two names; and
the empty Trip Plan is one line again.

Ruled on rather than changed: **`fields.ts`, `EditableField` and the `field` parameters
stay** — `CONTEXT.md` lists *field* on **Profile Fact**'s `_Avoid_` line, but the ticket
uses it eighteen times for a Trip Plan scalar and so does ADR-0002, so the entry means "a
Profile Fact is not a field", not "this word is banned"; `CONTEXT.md` now says which of
the two it belongs to so the next agent does not undo it. Three switches over the same
field names stay switches: they read, parse and copy, and a shared table would need three
functions per field and would trade type safety for a shape. `api/trips.py` calls
`db/trips.py` directly, the direction `api/conversations.py` already takes, because the
traveler's edits have no rule to apply — only the advisor can start a Trip. Settling an
Open Question by hand stays, argued above.

Not fixable here: the edit-immunity test exercises the pure `merged()` with `editing`
handed to it, and nothing tests the wiring that produces that argument, because the
frontend suite is Node-only and component tests are out of scope by the spec. That wiring
was driven by hand.
