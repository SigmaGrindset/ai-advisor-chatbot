# AI Travel Advisor

Status: ready-for-agent

## Problem Statement

A traveler planning a real trip has nowhere to think the trip through. General chat
assistants answer travel questions fluently but guess at anything current — an exchange
rate, today's weather, whether their passport needs a visa — and a wrong visa answer is
worse than no answer. They forget everything between sessions, so a traveler who returns
tomorrow re-explains who they are, where they live, and who they are travelling with. And
whatever plan emerges exists only as prose scattered through a transcript: there is no
single place to look at the trip, and no way to change one part of it without asking for
the whole thing again.

Along the way the traveler hands over personal details — nationality, passport
information, travel dates, who they are travelling with — and has no way to see what was
kept, no way to remove it, and no idea what left the machine.

## Solution

A web application where a traveler converses with an **Advisor** — an AI travel advisor
that stays in role, reaches out for facts it cannot know, remembers the traveler across
**Conversations**, and produces a **Trip Plan** as a durable, structured artifact that
sits beside the conversation and takes shape while they talk.

The Advisor calls **Live-data Tools** for volatile facts and attaches **Citations** to
what it fetched, so a visa answer arrives with sources rather than confidence. What it
learns about the traveler is recorded as **Profile Facts** in a **Traveler Profile** the
traveler can read and delete from, fact by fact. The **Advisor Instructions** are editable
on their own page, and changes take effect on the next message.

## User Stories

### Core conversation

1. As a traveler, I want to open the application and immediately start talking to the Advisor, so that I can get help without creating an account.
2. As a traveler, I want the Advisor's reply to stream in as it is written, so that I know the application is working and can start reading sooner.
3. As a traveler, I want the Advisor to behave consistently as a travel advisor for the whole Conversation, so that it does not change personality partway through.
4. As a traveler, I want the Advisor to politely decline off-topic requests and steer back to my trip, so that it stays useful rather than becoming a general chatbot.
5. As a traveler, I want Messages laid out so long itinerary answers are readable, so that a detailed reply is not squeezed into a narrow bubble.
6. As a traveler, I want lists, emphasis and links in the Advisor's replies rendered properly, so that a day-by-day suggestion is legible.
7. As a traveler, I want to scroll up to re-read something mid-reply without the view snapping back to the bottom, so that I can follow a long answer at my own pace.
8. As a traveler, I want a way to jump back to the latest Message after scrolling up, so that I can rejoin the live reply.
9. As a traveler, I want to send with Enter and insert a newline with Shift+Enter, so that composing a multi-line question is natural.
10. As a traveler, I want to stop a reply that is still streaming, so that I am not stuck waiting for an answer I no longer want.
11. As a traveler, I want a failed Message to show an error inline with a retry control, so that a transient failure does not lose my question.
12. As a traveler, I want to see what the Advisor is doing while it works ("Checking current weather in Lisbon…"), so that a pause feels like progress rather than a hang.

### Getting things right

13. As a traveler, I want the Advisor to look up the current weather rather than guess, so that packing advice reflects reality.
14. As a traveler, I want the Advisor to look up the current exchange rate rather than recall one, so that budget figures are not years out of date.
15. As a traveler, I want the Advisor to tell me the rate it used is a daily reference rate, so that I do not mistake it for a live market quote.
16. As a traveler, I want the Advisor to search the web for visa and entry requirements, so that the answer reflects current rules rather than training data.
17. As a traveler, I want Citations under any answer built from fetched information, so that I can check the source myself.
18. As a traveler, I want to expand a Citation and see where it came from, so that I can judge whether to trust it.
19. As a traveler, I want the Advisor to say plainly when it could not verify something, so that I know which parts of an answer to double-check.
20. As a traveler, I want the Advisor to still answer from its own knowledge about things that are not volatile — what a city is like in April, whether three days is enough — so that it is not reduced to a search box.
21. As a traveler, I want the Advisor to carry on usefully when a data source is unavailable, so that one failing service does not end the turn.

### Conversations

22. As a traveler, I want to start a new Conversation, so that a separate line of thinking does not pollute an existing one.
23. As a traveler, I want to see all my Conversations in a list, so that I can find the one I want.
24. As a traveler, I want each Conversation to carry a meaningful title derived from what we discussed, so that I can recognise it at a glance.
25. As a traveler, I want Conversations ordered by most recent activity, so that what I am working on is at the top.
26. As a traveler, I want to see which Trip each Conversation belongs to, so that several threads about one journey are recognisable as a group.
27. As a traveler, I want to reopen any Conversation and continue where I left off, so that I can return days later.
28. As a traveler, I want to delete a Conversation I no longer need, so that my list stays relevant.
29. As a traveler, I want deleting a Conversation to ask me once before it happens, so that I do not lose a thread by mis-clicking.
30. As a traveler, I want deleting a Conversation not to silently destroy my Trip Plan or Traveler Profile, so that deleting one of several threads does not gut the trip I am planning.
31. As a traveler, I want a very long Conversation to keep working, so that returning to it over many sessions does not degrade or fail.
32. As a traveler, I want the full transcript of a long Conversation to remain visible to me, so that Compaction never hides my own history from me.

### Continuity across Conversations

33. As a traveler, I want the Advisor to already know my nationality, home city and who I travel with in a new Conversation, so that I do not repeat myself.
34. As a traveler, I want the Advisor to be aware that other Conversations exist about my trip, so that it can connect threads instead of starting cold.
35. As a traveler, I want to see everything the Advisor has learned about me as a plain list, so that its memory is not a black box.
36. As a traveler, I want to delete any single Profile Fact, so that I can correct or remove something without wiping everything.
37. As a traveler, I want an empty Traveler Profile to explain what will appear there and that I can delete it, so that I understand the arrangement before I share anything.
38. As a traveler, I want a correction I make in conversation to update what the Advisor believes, so that stale facts do not persist.

### The Trip Plan

39. As a traveler, I want a structured Trip Plan distinct from the chat, so that my trip is a thing I can look at rather than a transcript I must re-read.
40. As a traveler, I want the Trip Plan visible beside the Conversation, so that I can see it take shape as we talk.
41. As a traveler, I want a field the Advisor just changed to be briefly highlighted, so that I notice what moved without hunting for it.
42. As a traveler, I want to edit any part of the Trip Plan myself, so that I am not forced to ask the Advisor to make a change.
43. As a traveler, I want my in-progress edit to survive the Advisor changing the same field, so that my typing is never silently discarded.
44. As a traveler, I want to be told when the Advisor suggested a change to a field I was editing, so that I can take its suggestion if I want it.
45. As a traveler, I want the Trip Plan to show destination, dates, party size and budget, so that the shape of the trip is clear at a glance.
46. As a traveler, I want a day-by-day list of Itinerary Items, so that I can see the rough shape of the days.
47. As a traveler, I want to add and remove Itinerary Items myself, so that I can adjust the days directly.
48. As a traveler, I want a list of Open Questions the plan still needs decided, so that I know what is unresolved.
49. As a traveler, I want clicking an Open Question to compose a matching message in the input without sending it, so that I can pursue it while staying in control of what I say.
50. As a traveler, I want several Conversations to refine the same Trip Plan, so that planning one journey across multiple threads does not fragment it.
51. As a traveler, I want to see all my Trips in one place, so that I can plan more than one journey.
52. As a traveler, I want to reassign a Conversation to a different Trip, so that I can correct the Advisor when it attaches a thread to the wrong journey.
53. As a traveler, I want a Trip Plan with no Itinerary Items yet to explain what will fill it, so that an early plan does not look broken.

### Tuning the Advisor

54. As a traveler, I want a page where I can read and edit the Advisor Instructions, so that I can change how the Advisor behaves.
55. As a traveler, I want to see the fully composed prompt exactly as it will be sent, including injected Traveler Profile and Trip Plan, so that nothing about the Advisor's behaviour is hidden from me.
56. As a traveler, I want my edit to take effect on the very next Message in any Conversation, so that "immediately" means immediately.
57. As a traveler, I want to restore the default Advisor Instructions, so that I can recover from an edit that broke the Advisor.
58. As a traveler, I want each Message to record which Prompt Version produced it, so that a change in behaviour partway through a Conversation is explicable rather than mysterious.

### Privacy

59. As a traveler, I want personal details I share to be unable to leak into calls to weather, currency or country services, so that a passport number cannot ride along with a lookup.
60. As a traveler, I want to see the exact search query that was sent when the Advisor searched the web, so that I know what left the machine.
61. As a traveler, I want a search query containing something that looks like a passport or card number to be blocked or stripped before it is sent, so that a careless phrasing does not expose me.
62. As a traveler, I want instructions embedded in a fetched web page to have no power over the Advisor, so that a malicious page cannot make it act against me.
63. As a traveler, I want nothing the Advisor read on the web to be able to write to my Traveler Profile or Trip Plan on its own, so that only what I actually said shapes what is stored.
64. As a traveler, I want deleting a Conversation to really delete it rather than hide it, so that deletion means what it says.
65. As a traveler, I want a way to clear all my data, so that I can leave nothing behind.

### First run and empty states

66. As a first-time visitor, I want the application to greet me and suggest a few good opening questions, so that I know what it is for and where to start.
67. As a first-time visitor, I want clicking a suggested question to fill the input rather than send it, so that I can edit it first.
68. As a first-time visitor, I want the greeting not to appear as part of my transcript, so that my Conversation contains only real Messages.
69. As a traveler with no Conversations, Trips or Profile Facts yet, I want each empty area to say in one line what will fill it, so that the application never looks broken.

### Across devices

70. As a traveler on a laptop, I want the Conversation list, chat and Trip Plan visible at once, so that I can work without navigating.
71. As a traveler on a tablet, I want chat and Trip Plan side by side with the Conversation list a tap away, so that the plan stays in view where there is room for it.
72. As a traveler on a phone, I want a chat-first layout with the Conversation list as a sheet, so that the small screen is not wasted on navigation.
73. As a traveler on a phone, I want the Trip Plan as a bottom sheet with a peek state showing destination and dates, so that I can still see the plan take shape while typing.
74. As a traveler on a phone, I want the composer to stay visible and usable when the keyboard opens, so that I can actually type.
75. As a traveler on a phone, I want the composer clear of the home indicator, so that the last line is not cut off.
76. As a traveler on a phone, I want focusing the input not to zoom the page, so that I am not left panning a magnified layout.
77. As a traveler on a phone, I want to delete a Conversation through a visible control rather than a hidden gesture, so that the action is discoverable and does not fight the sheet.
78. As a traveler on any device, I want to see which parts of the Trip Plan are editable, so that touch users are not left guessing.
79. As a traveler who prefers reduced motion, I want animations suppressed, so that the interface does not make me unwell.
80. As a traveler using a keyboard, I want to reach and operate every control, so that I am not locked out of parts of the application.
81. As a traveler using a screen reader, I want the Advisor's streaming reply announced, so that I can follow the answer as it arrives.
82. As a traveler on a phone, I want to add the application to my home screen with a proper icon, so that it feels like an application rather than a tab.

### Running and operating

83. As an evaluator, I want to start the whole application with a single command on a clean machine, so that I can run it without reading a setup guide.
84. As an evaluator, I want to supply my own OpenRouter key through a documented environment variable, so that I can run it against my own account.
85. As an evaluator, I want a missing or invalid key to produce a clear message in the interface, so that I am not left staring at a spinner.
86. As an evaluator, I want an exhausted credit balance to say so specifically, so that I do not misdiagnose it as a bug.
87. As an evaluator, I want the database schema created automatically on first start, so that there is no migration step to run by hand.
88. As an evaluator, I want data to survive a restart, so that I can verify that Conversations and Trip Plans persist.
89. As a developer, I want the conversation model and the utility model to be configurable, so that I can test cheaply and demonstrate well.
90. As a developer, I want the cost of each turn recorded from the provider's own usage figures, so that spend is observable without polling the provider.
91. As a developer, I want application logs not to contain Message bodies, so that operating the system does not become another copy of the traveler's personal data.

## Implementation Decisions

### Shape and delivery

- Two containers: a Postgres service and a single application service. The application
  image is built in stages — the frontend bundle is built with Node, then served by the
  Python process alongside the API. One origin, so there is no CORS configuration.
- Backend is FastAPI on Python; frontend is React with Vite and Tailwind. The frontend is
  served as static assets with an SPA fallback so client-side routes resolve.
- The database schema is applied automatically at container start before the server accepts
  traffic. The application service waits on the database's health check.
- Configuration is by environment variable: the OpenRouter key is required, the two model
  identifiers are optional with defaults. A missing key is detected at startup, logged
  clearly, and surfaced to the interface as a structured error rather than a generic
  failure.

### Data model

- A single **Traveler** row exists implicitly; every other table carries a real traveler
  reference, so per-browser travelers would later be a middleware change rather than a
  migration.
- **Conversation** belongs to a Traveler and optionally to a **Trip**. It carries a title,
  an activity timestamp, and a rolling summary used for Compaction.
- **Message** belongs to a Conversation and records role, content, the **Prompt Version**
  that produced it, any **Citations**, and an error marker for a turn that failed
  mid-stream.
- **Trip** belongs to a Traveler and owns exactly one **Trip Plan** (ADR-0002). The Trip
  Plan holds destination, date range, party size, budget, a collection of **Itinerary
  Items** keyed by day and rough time of day, and a collection of **Open Questions**.
- **Traveler Profile** holds **Profile Facts** — a fixed set of known fields plus a
  free-form notes collection for facts the schema did not anticipate. Each fact is
  individually addressable so it can be deleted on its own.
- **Advisor Instructions** are stored as versioned rows; the current version is composed
  into every turn, and every Message references the version that produced it.
- Semi-structured values use a JSON column type. The database is Postgres and no
  compatibility with other engines is maintained.

### Talking to the model

- The application uses the official OpenAI-compatible client pointed at OpenRouter's base
  URL and implements the multi-step tool loop itself (ADR-0005): stream, accumulate tool
  call argument fragments across chunks, parse, dispatch, append results, re-call until the
  model stops requesting tools.
- Tool call argument fragments arrive as string pieces, and call identifier formats differ
  by upstream provider; nothing may pattern-match on the identifier format.
- The final stream chunk carries provider usage including cost; that figure is recorded per
  turn rather than polled from the provider's account endpoint.
- Two models are configured: a conversation model, and a cheaper utility model used for
  Conversation titles, Compaction summaries, and the nested web search call.
- Streaming to the browser is a hand-rolled server-sent stream over a POST, consumed by a
  reader on the client. Upstream keep-alive comment lines are ignored.

### Tools

- Four **Live-data Tools**: current weather, exchange rate, country facts, and web search.
  The first three call keyless public HTTP services with strictly typed arguments — none
  has a free-text argument, which is what makes personal data structurally unable to travel
  with them (ADR-0004).
- Web search is a nested request to OpenRouter with its web plugin enabled on the utility
  model; the answer and its source annotations return into the main loop as a tool result
  (ADR-0003). The plugin is never enabled on the main conversation request.
- The free-text search query is validated before it leaves: patterns resembling passport,
  identity or card numbers are rejected or stripped, and the query actually sent is
  persisted so it can be shown to the traveler.
- Tool results are wrapped in delimiters marking them as untrusted data, and the Advisor
  Instructions state that content inside those delimiters is never an instruction.
- A tool result may never on its own cause a Traveler Profile write or a Trip Plan change.
- Live-data calls have a short timeout and a single retry; after that the failure becomes
  the tool result, so the Advisor explains it rather than the turn collapsing.

### Memory and context

- Durable facts enter the Traveler Profile through a tool the Advisor calls during a turn,
  not through a separate extraction pass on every Message.
- Each turn's prompt is composed from: the current Advisor Instructions, the Traveler
  Profile, the current Trip Plan, one-line summaries of the traveler's other Conversations,
  the Compaction summary of this Conversation, and the recent Messages verbatim.
- Compaction is triggered by a token budget rather than a Message count, because tool
  results dominate history size. It folds the oldest Messages into the Conversation's
  rolling summary and removes them from the prompt only. It is not surfaced in the
  interface.

### Trip Plan behaviour

- The Advisor changes the plan through several small typed tools that patch individual
  fields and collection entries, never through a single whole-document write.
- Conversations attach to a Trip; the Advisor is shown existing Trips and may join one or
  create one. Misattachment is expected and correctable from the interface.
- The interface edits the same fields through partial-update endpoints. A field currently
  being edited by the traveler is immune to an incoming patch; the patch applies elsewhere
  and the conflict is surfaced quietly.

### Interface structure

- Desktop is three panes: Conversation list, chat, and a right pane with **Plan** and
  **Traveler** tabs. Advisor Instructions are their own page. Trips have a switcher in the
  plan pane header and a page listing all Trips.
- Tablet keeps chat and plan; the Conversation list becomes a sheet. Phone is chat-first
  with the Conversation list as a left sheet and the Trip Plan as a bottom sheet with peek,
  half and full snap points (ADR-0006, ADR-0007).
- The layout is built mobile-first. Viewport units account for mobile browser chrome, the
  composer respects the device safe area, and no control's only affordance is hover.
- First run shows a composed greeting that is not persisted as a Message, plus four starter
  prompts covering a visa question, a weather question, an exchange-rate question, and an
  open-ended planning question. Clicking one fills the input without sending.
- Messages are full-width and editorial rather than bubbles. Markdown is rendered through a
  sanitising renderer with a restricted element set; no raw HTML and no model-supplied
  images. Auto-scroll sticks to the bottom only when the traveler is already there.
- Tool activity appears as a specific ephemeral status line during the turn. Citations
  persist beneath the Message as numbered chips that expand to show the source and, for
  search, the exact query sent.
- Retry on a failed Message is the only per-Message action.

### Visual system

- Colour, spacing, radius and type are defined once as semantically named tokens consumed
  through the Tailwind theme; no component references a raw colour value. Dark mode is not
  built, but the token naming is chosen so adding it later is a single additional theme
  block.
- Warm monochrome base with a muted clay accent. Colour carries exactly four meanings — a
  recently changed plan field, a verified claim, an unresolved Open Question, and an error
  — plus a deterministic pastel per Trip used on Trip chips throughout.
- Type is Archivo for display, Geist Sans for body and interface, Geist Mono for metadata
  and figures, with tabular figures on values that change in place. Fonts are self-hosted
  rather than loaded from a third-party CDN, consistent with the application's own claims
  about what leaves the machine.
- Icons come from Lucide at a 1.5 stroke weight, restricted to two sizes; the
  sparkle/bot/zap/wand glyph family is not used.
- Motion is limited to the streaming caret, the changed-field highlight, sheet and panel
  transitions, and hover and focus transitions, all suppressed under a reduced-motion
  preference.
- Accessibility baseline: full keyboard navigation, a live region announcing the streaming
  reply, focus trapping and escape handling on sheets, and verified contrast on the accent
  and the four semantic tints.
- A minimal web application manifest and touch icon are provided. No service worker.

## Testing Decisions

### What makes a good test here

A good test drives the application the way a browser does — through its own HTTP API — and
asserts on what a traveler would observe: the Messages that come back, what is persisted,
what the Trip Plan looks like afterwards, and what the application sent outward. It does
not reach into internal functions, assert how many times something was called, or know the
shape of any object that is not part of the API contract. The target is a test that still
passes after a correct refactor and fails on a behavioural regression.

### The seam

There is exactly one seam: the outbound HTTP client, provided as a single injectable
dependency and used by every outward call including the model client. Tests replace it with
a transport that routes by host and returns canned responses, including a canned streamed
response carrying tool calls. Everything inside the application is real — routing, the tool
loop, stream parsing, prompt composition, persistence, plan patching.

Typed per-service client interfaces were considered and rejected: they multiply seams and
let hand-written fakes drift from the real wire format, leaving the parsing code — where
the bugs actually are — untested.

The database is not a seam. Tests run against a real Postgres instance with each test in a
rolled-back transaction, because the schema depends on Postgres JSON behaviour and a
substituted engine would diverge silently.

### What is tested

- A complete turn end to end: a canned stream containing a tool call drives real dispatch of
  a Live-data Tool, the tool result re-enters the loop, the final answer is persisted with
  its Citations, and the Trip Plan and Traveler Profile reflect what the model asked for.
- Stream parsing: argument fragments split across chunks reassemble correctly; keep-alive
  lines are ignored; a stream that dies mid-answer persists a partial Message marked failed.
- The search query guard: queries carrying passport-like or card-like patterns do not leave
  the application, and what was sent is recorded.
- Untrusted tool results: content instructing the model to write to the Traveler Profile or
  Trip Plan cannot cause a write.
- Compaction: crossing the token budget folds the oldest Messages into the rolling summary,
  removes them from the composed prompt, and leaves the stored transcript intact.
- Prompt composition and versioning: the composed prompt contains the current Advisor
  Instructions, Traveler Profile and Trip Plan; editing the instructions changes the next
  turn in an existing Conversation; each Message records the Prompt Version used.
- Plan patching: a field-level patch does not disturb other fields, and a patch arriving for
  a field the traveler is editing does not overwrite it.
- Deletion semantics: deleting a Conversation removes its Messages and leaves the Trip Plan
  and Traveler Profile intact; deleting a Profile Fact removes only that fact.
- Live-data failure handling: timeout and error responses become tool results rather than
  turn failures.
- Configuration failure: a missing or invalid key produces a structured, recognisable error
  from the API.

### Prior art

None — this is the first code in the repository. These tests set the pattern: request
through the application's own API, one seam substituted, assertions on observable
behaviour.

## Out of Scope

- Authentication, user accounts, and multiple travelers in one deployment.
- Dark mode. Token naming accommodates it; the theme is not built.
- Frontend unit tests, component tests, and browser end-to-end tests.
- Touch gestures such as swipe-to-delete, beyond a sheet's own standard dismissal.
- Offline support and any service worker.
- Encryption at rest. Personal data is stored in plaintext, deliberately and documented.
- Redaction of personal data on the way to the model, as distinct from egress to other third
  parties.
- Drag-and-drop reordering of Itinerary Items, and rich text within plan notes.
- Editing or regenerating an already-sent Message.
- Booking, payment, or any transaction; the application plans trips, it does not buy them.
- Internationalisation and localisation.
- Rate limiting, abuse protection, and horizontal scaling.

## Further Notes

- The development OpenRouter key carries a small fixed credit balance and expires
  2026-10-17. Development and automated testing therefore run against the cheaper utility
  model; the conversation model is used for manual verification and demonstration. The
  evaluating machine supplies its own key.
- Web search through the provider's plugin carries a flat per-request surcharge roughly
  twenty times the token cost of a cheap turn, which is why it is a deliberately invoked
  tool rather than a mode left enabled.
- Reasoning-heavy model families spend their output budget on hidden reasoning and are
  unsuitable defaults here.
- The README must carry seven sections: setup and run, architecture overview, key decisions,
  ambiguities, AI usage, known limitations, and optionally what was built beyond the
  specification. Several ambiguities are already settled and recorded: the
  Conversation-versus-Trip ownership of the plan, the meaning of "immediately" for Advisor
  Instructions changes, and the reach of deletion.
- Committing is the candidate's decision. No git write happens without an explicit request,
  and when it does, the prompt log is committed alongside the code.
