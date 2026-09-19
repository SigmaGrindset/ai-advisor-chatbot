# Other Conversations are known by name, not by content

The spec asks for "one-line summaries of the traveler's other Conversations" in every
prompt, so that the advisor knows the traveler has others going. Ticket 13 read that as
the *name* of each other Conversation and the Trip it is refining — nothing that was said
in it. This records why, because "summary" could as easily have been read as a
gist of the contents, and the difference is not a small one.

What is composed in is a line each: the title the utility model gave the Conversation
after its first exchange, and the destination of its Trip where it has one. A Conversation
nothing has been said in yet has no title and is not listed at all.

## Considered Options

- **A generated gist of each other Conversation's contents.** Rejected on three counts.
  It costs a utility-model call per Conversation, kept fresh against every turn of every
  one of them, for a line the advisor reads and mostly ignores. It grows without bound:
  a traveler with thirty Conversations would carry thirty paragraphs into every prompt,
  which is the very cost Compaction exists to control. And it quietly undoes what the
  traveler asked for by starting a second Conversation — they separated two lines of
  thinking, and a gist puts them back together without being asked.
- **The Conversation's rolling Compaction summary, where it has one.** Rejected: it is
  the wrong length (hundreds of words, by design) and only long Conversations have one,
  so the advisor would know a great deal about the Conversations that had run long and
  nothing about the ones that had not.
- **The last Message of each.** Rejected: a Conversation's most recent exchange is the
  least summary-like thing in it, and it is raw traveler text crossing a boundary the
  traveler drew.

## Consequences

**What carries between Conversations is still the Traveler Profile and the Trip Plan.**
Those are the two records built for it, both structured, both visible to the traveler and
editable by them (ADR-0001, ADR-0002). This adds awareness that the other Conversations
exist, and deliberately nothing else — an advisor that wants to know what was decided
about the trip reads the plan, which is where deciding things is recorded.

**A Conversation is worth mentioning once it has been spoken in.** The title is what makes
it worth mentioning, and the title is written after the first exchange, so the two
conditions are the same one. An empty Conversation the traveler opened and wandered away
from is not another Conversation about their journey.

**The line is only as good as the title.** A Conversation named after its first exchange
may have moved on to something else entirely, and the advisor will be told the old name.
That is the same imprecision the traveler already lives with in the Conversation list, and
the cost of fixing it is a naming call per turn.
