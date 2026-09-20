# 11: Traveler Profile and data controls

**What to build:** The Advisor stops asking the same questions. A traveler who mentioned
their nationality last week doesn't mention it again — and can see exactly what was
remembered, and delete any part of it.

**Blocked by:** 09.

**Status:** ready-for-agent

- [x] The Advisor records durable facts as Profile Facts through a tool it calls during a
      turn, not through a separate extraction pass on every Message
- [x] The Traveler Profile is composed into every turn's prompt, so a brand-new Conversation
      already knows nationality, home city and travel companions
- [x] The Traveler tab lists every Profile Fact in plain language
- [x] Any single Profile Fact can be deleted on its own
- [x] A correction made in conversation updates the stored fact rather than accumulating a
      contradiction
- [x] A clear-all-data control removes Conversations, Trips, Trip Plans and the Traveler
      Profile
- [x] Deleting one Conversation leaves the Trip Plan and the Traveler Profile intact
- [x] Mobile behaviour ships with this ticket, on the 06 primitives
- [x] A test asserts deleting a Conversation does not remove Profile Facts or Trip Plan data
- [x] A test asserts a tool result cannot cause a Profile write

## Comments

All ten criteria are done and were driven through the running application against a real
model. The pass worth recording: a traveler said they were Croatian and corrected it to
Irish a turn later, and the Nationality fact changed in place rather than doubling — then a
**brand-new** Conversation answered "as an Irish citizen, you don't need a visa… since
you're based in Zagreb… the usual family of four?" without a word of it having been said in
it.

- **A Profile Fact is a subject and a line, and three subjects hold one fact each.**
  Nationality, home city and who they travel with are single-valued, so recording one again
  *replaces* it — that is the correction mechanism, and it is enforced in
  `services/profile.py` rather than asked for in the tool's description, because a profile
  that stayed consistent only while the model was careful about it would not be one, and
  ticket 12 hands the traveler the instructions to edit. `note` is the collection for what a
  fixed set could not anticipate, and the one place two facts can still disagree.
- **The profile tools are the second collection that writes**, and inherit ADR-0010 whole:
  `loop.py::_offered` withdraws them alongside the Trip Plan tools the moment anything has
  been fetched into a turn. The three layers mirror the plan's, one for one.
- **`profile_revised` is a turn event**, so the Traveler tab fills while the traveler talks
  the same way the Plan tab does, and carries the whole profile: a correction replaces a
  fact, so a patch would have to say which one it replaced. Facts are listed in a settled
  order rather than the order they were learned — a profile is a small record, not a log.

Ruled on rather than assumed:

- **No page for any of this.** It is the Traveler tab of the record pane, which ADR-0012
  says is right: this sits beside the Conversation that is writing to it.
- **Clear-all lives under the profile, and says it is not only about the profile.**
  `DELETE /api/traveler/everything` deletes the Traveler row and puts an empty one straight
  back, so the database's own cascade takes everything and a table added later needs no line
  in it. (Rows the database takes underneath a session are still in its identity map, hence
  the `expunge_all()`.)
- **Nothing checks what a fact contains.** The instructions say never to record a passport
  number, a card number, an identity number or a date of birth, and that is all: ADR-0004
  rejects filtering on the way to the model, and the answer to a fact that should not be
  there is that it is listed in plain language with a control beside it.
- **A fact deleted by hand is not announced to the advisor.** The next turn composes the
  profile as it stands, so it simply no longer knows it — a "the traveler deleted this" note
  would be the fact again in another form.

Worth knowing: the advisor will re-record a note it has already been shown if the wording
differs, since the exact-words check only catches the identical sentence. And **the schema
changed** — see `HANDOFF.md` §5 for what an older database is missing.
