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

- [ ] A Trip owns exactly one Trip Plan; Itinerary Items and Open Questions are their own
      records rather than fields of a JSON document
- [ ] The first plan patch in a Conversation with no Trip creates one; a `join_trip` tool
      lets the Advisor attach the Conversation to an existing Trip instead
- [ ] The Advisor changes the plan through small typed tools that patch individual fields
      and collection entries; there is no whole-document write
- [ ] The Plan tab renders destination, date range, party size, budget, Itinerary Items
      grouped by day, and Open Questions
- [ ] A field the Advisor has just changed highlights briefly and fades
- [ ] Editable fields carry a permanent dotted underline on every breakpoint; clicking one
      edits in place, blur saves, Escape cancels
- [ ] A field the traveler is currently editing is immune to an incoming patch: the patch
      applies to everything else and the conflict is surfaced quietly rather than
      overwriting or interrupting
- [ ] The traveler can add and remove Itinerary Items directly
- [ ] Clicking an Open Question composes a matching prompt into the composer without
      sending it
- [ ] An empty Trip Plan explains in one line what will fill it
- [ ] On a phone the plan is a bottom sheet built on the 06 primitive, with a peek state
      showing destination and dates above the composer, plus half and full states
- [ ] When the Plan tab is not showing, a change marks the tab rather than switching to it
- [ ] A test asserts a field-level patch leaves other fields untouched
- [ ] A test asserts a patch arriving for a field under edit does not overwrite it
