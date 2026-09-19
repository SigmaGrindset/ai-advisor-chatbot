# Other Conversations are known by name, not by content

The spec asks for "one-line summaries of the traveler's other Conversations" in every
prompt, so that the advisor knows the traveler has others going. That is read as the
*name* of each other Conversation and the Trip it is refining — nothing that was said in
it. A Conversation nothing has been said in yet has no title and is not listed at all.

A generated gist of the contents, the other reading, is rejected on three counts: it costs
a utility-model call per Conversation kept fresh against every turn of every one of them;
it grows without bound, which is the very cost Compaction exists to control; and it
quietly undoes what the traveler asked for by starting a second Conversation — they
separated two lines of thinking, and a gist puts them back together.

What carries between Conversations is still the Traveler Profile and the Trip Plan
(ADR-0001, ADR-0002), both structured and both editable by the traveler. This adds
awareness that the others exist and nothing else: an advisor that wants to know what was
decided reads the plan. The line is only as good as the title, which is written after the
first exchange and may be stale — the same imprecision the Conversation list already has.
