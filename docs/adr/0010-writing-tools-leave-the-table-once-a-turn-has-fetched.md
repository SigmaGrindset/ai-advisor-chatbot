# Writing tools leave the table once a turn has fetched anything

ADR-0004 promises that a tool result may never on its own cause a Trip Plan change, and
ADR-0009's last paragraph handed the rule that keeps it to whoever built the first writing
tool: **a step answering tool results is never offered the collection that writes.**

The loop offers the Live-data Tools on every step, and the writing tools only while
nothing fetched has entered the turn. The moment a Live-data Tool result is appended they
are gone for the rest of that turn, and a model that asks for one anyway is told there is
no such tool — the same answer it gets for a tool that never existed. The capability is
absent rather than refused, which is what makes ADR-0004's promise structural; leaning on
the untrusted-data markers instead would be a promise the model keeps.

The cost is that a search which changes the advisor's mind changes the plan a turn later:
it says so in its reply and patches the field on the next turn, by which time the traveler
has read the same thing. That is the point — a plan change always follows something the
traveler said, never something a stranger wrote on a web page. It also means the advisor
records before it looks up, which the Advisor Instructions say and explain.

Two tripwires hold it: `test_a_search_result_telling_the_advisor_to_write_produces_no_write`
and `test_nothing_that_writes_is_offered_once_something_has_been_fetched`.
