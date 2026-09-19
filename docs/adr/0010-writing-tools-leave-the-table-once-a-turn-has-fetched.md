# Writing tools leave the table once a turn has fetched anything

ADR-0004 promises that a tool result may never on its own cause a Trip Plan change, and
ADR-0009 handed the rule that keeps it to whoever built the first writing tool: **a step
answering tool results is never offered the collection that writes.** Ticket 09 built
them, so this records what that rule became in code.

The loop offers the Live-data Tools on every step, and the Trip Plan tools only while
nothing fetched has entered the turn. The moment a Live-data Tool result is appended, the
plan tools are gone for the rest of that turn — and a model that asks for one anyway is
told there is no such tool, the same answer it gets for a tool that never existed. So a
page the advisor read cannot change the traveler's plan, because by the time anything that
page said is in front of the model there is nothing on the table that writes. The
capability is absent rather than refused.

## Considered Options

- **Offer both collections on every step and rely on the untrusted-data markers.**
  Rejected: that is a promise the model keeps, and ADR-0004 says "structurally". A
  boundary that depends on the thing it is bounding is not one.
- **Withdraw the plan tools only after a *web search*,** on the grounds that weather and
  exchange rates answer in numbers. Rejected: the rule then needs a list of which sources
  are dangerous, kept in step with the catalogue forever, and the first entry added
  without updating the list is a hole. "Anything fetched" needs no list.
- **Withdraw them for one step rather than the rest of the turn.** Rejected: what came
  back stays in the conversation for every later step, so a one-step pause protects
  nothing.

## Consequences

**The advisor records before it looks up.** In a turn that both records and searches, the
recording goes out in the same step as the search rather than waiting for the answer; the
Advisor Instructions say so and say why.

**A search that changes the advisor's mind changes the plan a turn later.** It says so in
its reply and patches the field on the next turn, by which time the traveler has read the
same thing. That is a real cost and it is the point: a plan change always follows
something the traveler said, never something a stranger wrote on a web page.

**There are two tripwires.**
`test_a_search_result_telling_the_advisor_to_write_produces_no_write` names a plan tool
that genuinely exists, asks for it after a search, and asserts both that it was refused as
non-existent and that no Trip was started;
`test_nothing_that_writes_is_offered_once_something_has_been_fetched` asserts the offered
set on each step directly. Between them the guarantee fails loudly rather than quietly.
