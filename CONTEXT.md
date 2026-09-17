# AI Travel Advisor

A web application where a traveler converses with an AI travel advisor. Conversations
produce a durable trip plan, and what the advisor learns about the traveler carries
across conversations.

## Language

### People and conversation

**Traveler**:
The person planning a trip. The application has exactly one, implicitly — there are no
accounts and no sign-in.
_Avoid_: User, customer, client

**Advisor**:
The AI travel advisor the traveler talks to. Its behaviour is defined by the Advisor
Instructions.
_Avoid_: Assistant, bot, agent, AI

**Conversation**:
One continuous thread of messages between the traveler and the advisor. A traveler has
many, and may return to any of them at any time.
_Avoid_: Chat, session, thread

**Message**:
A single turn in a Conversation, from either the traveler or the advisor.

**Compaction**:
Replacing the older stretch of a Conversation with a running summary when the history
grows too large to send in full. Compaction affects only what the advisor is shown; the
Conversation itself is never shortened.
_Avoid_: Truncation, pruning, trimming

### Planning

**Trip**:
One journey the traveler is planning. Several Conversations may refine the same Trip.
_Avoid_: Journey, holiday, vacation, booking

**Trip Plan**:
The structured, durable record of a Trip — destination, dates, party, budget, its
Itinerary Items and its Open Questions. A Trip has exactly one. The traveler can view and
change it directly, and the advisor can change it as they talk.
_Avoid_: Itinerary (that is one part of it), schedule, document

**Itinerary Item**:
One thing planned for a particular day of a Trip.
_Avoid_: Activity, event, entry

**Open Question**:
Something a Trip Plan still needs decided. Open Questions are what the advisor drives the
conversation toward.
_Avoid_: TODO, gap, blocker

### Memory

**Traveler Profile**:
What the advisor durably knows about the traveler across all Conversations — nationality,
home city, companions, constraints, preferences. Visible to the traveler and editable by
them.
_Avoid_: Memory, user data, context

**Profile Fact**:
One entry in the Traveler Profile. Individually viewable and individually deletable.
_Avoid_: Memory, attribute, field

### Behaviour and sources

**Advisor Instructions**:
The editable part of the advisor's system prompt — its persona and its rules. Distinct
from the injected Traveler Profile, Trip Plan and tool guidance that are composed around
it at runtime.
_Avoid_: System prompt (that is the composed whole), persona, preamble

**Prompt Version**:
A saved revision of the Advisor Instructions. Every Message records the Prompt Version
that produced it.

**Live-data Tool**:
A capability the advisor calls to fetch real-world information it cannot know — current
weather, exchange rates, country facts, or a web search. Distinct from the tools it uses
to write to the Traveler Profile or the Trip Plan.
_Avoid_: Function, plugin, API call, skill

**Citation**:
A source link attached to an advisor Message, recording where a fetched claim came from.
_Avoid_: Reference, source, annotation
