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
real model.

- **The plan is rows.** `Trip` carries the scalars, `itinerary_item` and `open_question`
  are tables of their own, and `conversation.trip_id` is nullable with
  `on delete set null`. Nine tools, each writing one field or one entry, and no whole-plan
  write anywhere — which is what lets the traveler's own edit survive the next turn rather
  than being read back stale and put straight back (ADR-0002).
- **Two catalogues, dispatched down two branches of the loop.** The Live-data Tools fetch
  and never write; the plan tools write and never fetch. **ADR-0009's last paragraph came
  due and is now ADR-0010**: once anything has been fetched into a turn the plan tools are
  gone for the rest of it. Both tripwire tests were rewritten rather than relaxed.
- **The advisor points at entries by number, not by UUID.** `next_item_ref` and
  `next_question_ref` hand out numbers that are never reused, so an advisor working from
  the plan it was shown at the top of the turn cannot remove whatever has taken the place
  of something it removed a moment ago. The interface addresses the same rows by identifier.
- **Days are numbers, not dates.** Moving a trip a week later is one patch to `starts_on`
  rather than a rewrite of every item. What day 2 falls on is arithmetic in `dates.ts`, done
  in UTC throughout — a calendar day read as an instant west of Greenwich becomes the
  evening before, and shows the traveler a date they did not type.
- **Three pure modules carry the opinions**: `merging.ts`, `fields.ts`, `dates.ts`.
  `holding.ts` holds the plan; `PlanPanel` draws what it is handed. A patch that changes
  nothing is not reported as a change.
- **The phone peek is a strip above the composer, not a third snap point**, because the
  sheet is a modal `<dialog>` and one resting over the composer would stop the traveler
  typing. Recorded in ADR-0006.
- **A removal cannot start a Trip** — only a change that records something does. A test
  caught `remove_itinerary_item` creating an empty Trip to fail against.
- Beyond the criteria, because the ticket's prose says any part of the plan can be changed
  by hand: an Open Question can be settled by hand as well as clicked, and an Itinerary Item
  the traveler adds has no part-of-day — asking someone to pick morning or evening before
  they can write a line down is a form, not a plan.

Not fixable here: the edit-immunity test exercises the pure `merged()` with `editing` handed
to it, and nothing tests the wiring that produces that argument, because the frontend suite
is Node-only and component tests are out of scope by the spec. That wiring was driven by
hand.

Left for a human: the real-phone pass, which is 06's open criterion rather than this one's.
