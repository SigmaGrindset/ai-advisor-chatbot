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
model. **93 backend tests** (was 84) and **103 frontend tests in 15 files** (was 99 in 14);
`tsc --noEmit` silent, `npm run build` clean, mypy clean over 52 files.

The pass worth recording: a traveler said they were Croatian and corrected it to Irish a
turn later, and the Nationality fact changed in place rather than doubling — then a
**brand-new** Conversation answered "as an Irish citizen, you don't need a visa… since
you're based in Zagreb… the usual family of four?" without a word of it having been said
in it.

- **A Profile Fact is a subject and a line, and three subjects hold one fact each.**
  Nationality, home city and who they travel with are single-valued, so recording one again
  *replaces* it — that is the correction mechanism, and it is enforced in
  `services/profile.py` rather than asked for in the tool's description, because a profile
  that stayed consistent only while the model was careful about it would not be one, and
  ticket 12 hands the traveler the instructions to edit. `note` is the collection for what
  a fixed set could not anticipate, and the one place two facts can still disagree — the
  traveler deletes the wrong one, or the advisor takes it off by its number.
- **The profile tools are the second collection that writes**, and inherit ADR-0010 whole:
  `loop.py::_offered` withdraws them alongside the Trip Plan tools the moment anything has
  been fetched into a turn. The three layers mirror the plan's, one for one —
  `advisor/remembering.py` → `services/profile.py` → `db/traveler.py` → `api/traveler.py`,
  and nothing below `services/` knows what a session is.
- **`profile_revised` is a turn event**, so the Traveler tab fills while the traveler talks
  the same way the Plan tab does, and carries the whole profile: a correction replaces a
  fact, so a patch would have to say which one it replaced. Facts are listed in a settled
  order (`components/profile/listing.ts`) rather than the order they were learned — a
  profile is a small record, not a log.

Ruled on rather than assumed:

- **No page for any of this.** It is the Traveler tab of the record pane, which ADR-0012
  says is right: this sits beside the Conversation that is writing to it.
- **Clear-all lives under the profile, and says it is not only about the profile.**
  `DELETE /api/traveler/everything` deletes the Traveler row and puts an empty one straight
  back, so the database's own cascade takes everything and a table added later needs no
  line in it. The screen after it is a first visit.
- **Nothing checks what a fact contains.** The instructions say never to record a passport
  number, a card number, an identity number or a date of birth, and that is all: ADR-0004
  rejects filtering on the way to the model, and the answer to a fact that should not be
  there is that it is listed in plain language with a control beside it.
- **A fact deleted by hand is not announced to the advisor.** The next turn composes the
  profile as it stands, so it simply no longer knows it — a "the traveler deleted this"
  note would be the fact again in another form.

Two things worth knowing: the advisor will re-record a note it has already been shown if
the wording differs, since the exact-words check only catches the identical sentence. And
**the schema changed** — a database from before this ticket has no `profile_fact` table and
no `traveler.next_fact_ref`: `docker compose down -v`, or the one-line
`alter table traveler add column if not exists next_fact_ref integer not null default 1`
used to verify this one against an existing database. §7 of `HANDOFF.md` still holds.

Left for a human: nothing on this ticket. Ticket 06's real-phone pass is still open and
still 06's.

### After the two-axis review

Fixed: `planning.py` and `remembering.py` had grown a copy of each other — `_words`,
`_whole`, `Unusable`, `_read` and the tool dataclass — now `advisor/calls.py`;
`erase_everything` knew the delete order for Conversations and Trips, and instead deletes
the Traveler and reinserts it so the cascade does the rest (with an `expunge_all()`,
because rows the database takes underneath a session are still in its identity map);
`db/traveler.py::facts_about` does in the query what `services/profile.py` was filtering in
Python; and the deletion test never asserted the Conversation went, so a no-op delete would
have passed it — it now checks the 404 and goes on to delete the *last* Conversation on a
Trip, the case nothing covered.

Left as built, and argued above: `forget_profile_fact` and the fact numbering it needs;
`profile_revised` as a turn event; the subject vocabulary living as both a `FactSubject`
enum in `db/` and plain strings in `advisor/`, which is the line `advisor/` sits on; and
the two explicit `writing and ...offers` branches in `loop.py`, which read as duplication
but are the dispatch ADR-0004 calls structural — a loop over a list of catalogues would put
the guarantee back in a table. The review also asked for tests of `ProfilePanel`; the spec
puts component tests out of scope and the suite is Node-only, so that pane was checked by
hand on the phone layout instead.
