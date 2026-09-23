
## Overview

Build a small web application where users chat with an AI **travel advisor** — a bot
that helps people plan trips, pick destinations, and answer travel questions.

Travelers plan real trips in these chats — along the way they often share personal
details: passport information, travel dates, who they're traveling with. As the advisor
gets more capable — reaching out for information it doesn't have, and remembering earlier
conversations — more of that personal information moves around: to the model, to any
outside source the advisor consults, and into whatever the app keeps.

## What to build

### Core chat

- A web UI where a user converses with the travel advisor bot.
- The bot stays in its role: it's a travel advisor, and it should behave like one.
- A conversation should feel coherent from start to finish — the bot shouldn't change
  personality mid-conversation.
- No login or user accounts — keep it simple.

### Getting things right

- The advisor should be genuinely useful about real trips. Some questions it can answer
  from what it already knows; others depend on live, real-world information it can't get
  from the model alone — a current exchange rate, the weather somewhere right now, whether
  a destination needs a visa. For those, the advisor needs a way to reach out and fetch
  fresh information rather than guess — getting it right is the goal.

### Conversations

- A user can have multiple separate conversations: start a new one, see a list of
  existing ones, open any of them to continue, and delete ones they no longer need.
- Users can leave and come back to any conversation at any time.
- Travelers may chat extensively, and return to long conversations over many sessions.

### Continuity across conversations

- A traveler usually plans a single trip across several conversations. The advisor should
  draw on those earlier conversations when it's relevant — bringing in what it already
  knows about the traveler instead of asking again.

### A plan that takes shape

- Beyond the back-and-forth, the conversation should produce a concrete trip plan — a
  distinct, structured thing the traveler can see, come back to, and change, not just
  another chat message. It takes shape as they talk (where they're going, when, the rough
  shape of the days), and they can view it and adjust individual parts of it.

### Tuning the advisor

- The advisor's instructions — its system prompt — should be viewable and editable
  through a simple page in the app (no authentication needed).

- Changes take effect immediately.
