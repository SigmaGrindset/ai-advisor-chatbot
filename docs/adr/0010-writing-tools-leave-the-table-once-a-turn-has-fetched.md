# Writing tools leave the table once a turn has fetched anything

ADR-0004 promises that a tool result may never on its own cause a Trip Plan change, and
ADR-0009's last paragraph handed the rule that keeps it to whoever built the first writing
tool: **a step answering tool results is never offered the collection that writes.** Ticket
09 built them, so this records what that rule became in code.

The loop offers the Live-data Tools on every step. It offers the Trip Plan tools only while
nothing fetched has entered the turn. The moment a Live-data Tool result is appended, the
plan tools are gone for the rest of that turn — and a model that asks for one anyway is
told there is no such tool, the same answer it gets for a tool that never existed. The
capability is absent rather than refused.

So a page the advisor read cannot change the traveler's plan, because by the time anything
that page said is in front of the model there is nothing on the table that writes. It is
not a rule applied at the moment of a call, it is not a check on the arguments, and it is
not something the Advisor Instructions ask for. It is the absence of a capability.

## Considered Options

- **Offer both collections on every step and rely on the untrusted-data markers.** The
  markers are already there and the Advisor Instructions already say that nothing between
  them is an instruction. Rejected because that is a promise the model keeps, and ADR-0004
  says "structurally". A boundary that depends on the thing it is bounding is not one —
  the same sentence ADR-0009 rejected trusting the model with a search query for.
- **Withdraw the plan tools only after a *web search*,** on the grounds that the weather
  and the exchange rate come from services that answer in numbers. Rejected: the rule then
  needs a list of which sources are dangerous, kept in step with the catalogue forever, and
  the first entry added without updating the list is a hole. "Anything fetched" needs no
  list.
- **Withdraw them for one step rather than the rest of the turn.** Rejected: what came back
  stays in the conversation for every later step, so a one-step pause protects nothing.

## Consequences

**The advisor records before it looks up, not after.** The Advisor Instructions say so, and
say why. In a turn that both records and searches, the recording goes out in the same step
as the search rather than waiting for the answer.

**A search that changes the advisor's mind changes the plan a turn later.** It says so in
its reply and patches the field on the next turn — by which time the traveler has read the
same thing. This is a real cost and it is the point: a plan change now always follows
something the traveler said, and never something a stranger wrote on a web page.

**The tripwire moved rather than went.**
`test_a_search_result_telling_the_advisor_to_write_produces_no_write` now names a Trip Plan
tool that genuinely exists, asks for it on the step after a search, and asserts both that
it was refused as a tool that does not exist and that no Trip was started. The sibling
test, `test_nothing_that_writes_is_offered_once_something_has_been_fetched`, asserts the
offered set on each step of a turn directly. Between them, the guarantee fails loudly
rather than quietly.
