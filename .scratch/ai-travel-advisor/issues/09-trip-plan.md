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

Shape of it:

- **The plan is rows.** `Trip` carries the scalar fields, `itinerary_item` and
  `open_question` are tables of their own, and `conversation.trip_id` is nullable with
  `on delete set null` so deleting one of several threads leaves the Trip where it is.
  Nine tools, each writing one field or one entry, and no whole-plan write anywhere —
  which is what lets the traveler's own edit survive the next turn rather than being read
  back stale and put straight back (ADR-0002).
- **Two catalogues, dispatched down two branches of the loop.** The Live-data Tools fetch
  and never write; the plan tools write and never fetch. That was already a claim in
  `LiveDataTools`' docstring; it is a fact about `loop.py` now.
- **ADR-0009's last paragraph came due, and is now ADR-0010.** Once anything has been
  fetched into a turn, the plan tools are gone for the rest of it, and a model asking for
  one is told there is no such tool. Both tripwire tests were rewritten rather than
  relaxed: the injection test now names `set_destination`, a tool that genuinely exists,
  asks for it on the step after a search, and asserts it was refused *and* that no Trip
  was started. A second test asserts the offered set on each step directly.
- **The advisor points at entries by number, not by UUID.** `Trip.next_item_ref` and
  `next_question_ref` hand out numbers that are never reused, so an advisor working from
  the plan it was shown at the top of the turn cannot remove whatever has taken the place
  of something it removed a moment ago. The interface addresses the same rows by their
  identifiers; the advisor never sees one.
- **Days are numbers, not dates.** Moving a trip a week later is one patch to `starts_on`
  rather than a rewrite of every item. What day 2 falls on is arithmetic, in `dates.ts`,
  done in UTC throughout — a calendar day read as an instant in a timezone behind
  Greenwich becomes the evening before, and shows the traveler a date they did not type.
- **Three pure modules carry the opinions**, which is where the new frontend tests are:
  `merging.ts` (what happens when the advisor and the traveler reach for one field),
  `fields.ts` (a field read as text and written back from it), `dates.ts`. `holding.ts`
  holds the plan and calls the first two; `PlanPanel` draws what it is handed.
- **A patch that changes nothing is not reported as a change.** A field lighting up for a
  change that was not one sends the traveler looking for something that did not happen.

Deviations, and what was decided rather than assumed:

- **The phone peek is a strip above the composer, not a third snap point — ADR-0011,
  which amends ADR-0006.** The sheet is a modal `<dialog>` by ticket 06's decision, and a
  modal sheet resting permanently over the composer would stop the traveler typing, which
  is the one thing the peek exists to let them do. The three states still cycle under a
  thumb: tap the strip to open at half, drag to full, drag down to land back on the strip.
  Verified at 375×812. No second sheet implementation.
- **Open Questions can be settled by hand as well as clicked.** The criteria only ask for
  add/remove on Itinerary Items, but the ticket's prose says the traveler can change any
  part of the plan by hand, and a question they have already settled is the most obvious
  thing to want gone. One endpoint, one control.
- **A removal cannot start a Trip.** Only a change that records something does. A test
  caught this: `remove_itinerary_item` on a Conversation with no plan was creating an
  empty Trip to fail against.
- **Itinerary Items have no part-of-day when the traveler adds one.** The column is
  nullable and untimed items sort after the timed ones. Asking someone to pick morning or
  evening before they can write a line down is a form, not a plan.

Three bugs found by driving the running application, none of which a test would have
caught:

- **"Use it" on a suggestion saved the traveler's draft instead of the advisor's value.**
  Clicking the control blurred the field first, so the blur committed the half-typed
  value and the two saves raced. The suggestion controls now prevent the default of the
  press, so the field keeps focus, and taking a suggestion abandons the open editor
  rather than saving it.
- **Itinerary text was right-aligned**, because it shared the editable field with the
  facts above it. A column of values reads down the right; a line of the itinerary is a
  sentence, and a sentence that wraps reads from the left. The field takes an alignment.
- **The unseen-change mark read the tab from the render that started the turn.** A turn
  outlives that render, so a traveler who changed tab mid-turn got a mark for a change
  they had watched arrive, or none for one they had missed. It reads a ref now.

**A stale dev server from an earlier session was serving old code on `[::1]:8000`** while
the new one bound `127.0.0.1:8000` — `localhost` resolves to the IPv6 address first on
this machine, so both curl and Vite's proxy reached the old one, and the plan never
appeared. Its `--reload` parent was gone but its worker still held the socket. This is the
same trap the handoff's §5 note is about, one layer deeper: check *which* process owns the
port, not only that one is listening.

Left for a human: the real-phone pass, which is ticket 06's open criterion rather than
this one's. The peek, the sheet's three states and every control were driven at 375×812
with touch emulation, which is as far as this machine goes.

### After the two-axis review

Nine findings acted on; both suites still green (75 backend, 84 frontend), mypy and `tsc`
clean.

Fixed:

- **The underline was dashed, not dotted.** The criterion and ADR-0007 both say *dotted*.
  All ten editable fields now compute `border-bottom-style: dotted`, checked in the page
  rather than by eye.
- **Clearing an Itinerary Item's text deleted the row.** The editor opens with its text
  selected, so one Backspace and a click away destroyed a record silently, with no confirm
  and no undo. Clearing now saves nothing; removing one is the control beside it, which
  says what it does.
- **A refused write announced a lookup.** A plan tool named after the tools had left the
  table fell through to the Live-data Tools to be refused, and their refusal carries a
  status line — so the traveler was told "Checking a live source" on behalf of a write
  that was never made. The loop now answers for any name neither catalogue has, which
  covers the withdrawn plan tool and the wholly unknown name alike. The injection test
  asserts the turn announced exactly one lookup, the search.
- **The peek strip tinted only for destination and dates.** On a phone with the sheet
  closed it is the only place a change can be noticed — the tab that would otherwise be
  marked is inside the sheet — so it now tints for any change at all.
- **`PATCH /trips/{id}/itinerary/{item_id}` accepted `day` and `part_of_day`** that nothing
  sent. Narrowed to the one thing the interface edits in place.
- **The six scalar field names were written out twice on the frontend.** `PLAN_FIELDS`,
  `PlanField` and `PlanPatch` now live in `api/types.ts`, where the API's vocabulary is,
  and `fields.ts` and `client.ts` both read them from there.
- **`describe_briefly` built prompt prose from inside `services/`**, where its two siblings
  are in `advisor/planning.py`. Moved.
- Two names: a loop variable renamed to `it` as churn, and `Awaited<ReturnType<typeof
  readConversation>>` where the exported `ConversationRead` says the same thing.
- **The empty Trip Plan is one line again**, as the criterion asks.

Ruled on rather than changed:

- **`fields.ts`, `EditableField` and the `field` parameters stay.** `CONTEXT.md` lists
  *field* on **Profile Fact**'s `_Avoid_` line, and HANDOFF §3 binds those lists to file and
  component names — but the ticket uses *field* eighteen times for a Trip Plan scalar, and
  so does ADR-0002. The avoid entry means "a Profile Fact is not a field", not "this word
  is banned". `CONTEXT.md` now says which of the two it belongs to, in both entries, so the
  next agent does not undo this.
- **Three switches over the same field names** (`valueOf`, `asPatch`, `keeping`) were left
  as switches. They read, parse and copy respectively — a shared table would need three
  functions per field and would trade type safety for a shape.
- **`api/trips.py` calls `db/trips.py` directly** rather than going through
  `services/plans.py`, so the two writers of one plan enter by different doors. The
  direction is the one `api/conversations.py` already takes, and the traveler's edits have
  no rule to apply — only the advisor's do, because only the advisor can start a Trip.
- **Settling an Open Question by hand stays**, flagged by both the reviewer and this
  ticket's own notes as beyond the criteria and justified by its prose.

Not fixable here, and worth knowing: the edit-immunity test exercises the pure `merged()`
with `editing` handed to it. Nothing tests the wiring that produces that argument, because
the frontend suite is Node-only and component tests are out of scope by the spec. That
wiring was driven by hand instead — an advisor patch landing on a field mid-edit, the
traveler's value held, the suggestion offered, and "Use it" taking it.
