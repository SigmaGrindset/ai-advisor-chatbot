# Take-Home Assignment — AI Advisor Chatbot

## Overview

Build a small web application where users chat with an AI **travel advisor** — a bot
that helps people plan trips, pick destinations, and answer travel questions.

Travelers plan real trips in these chats — along the way they often share personal
details: passport information, travel dates, who they're traveling with. As the advisor
gets more capable — reaching out for information it doesn't have, and remembering earlier
conversations — more of that personal information moves around: to the model, to any
outside source the advisor consults, and into whatever the app keeps.

We're not testing travel knowledge, and we don't expect a polished product. We want to
see how you design, build, and reason about a real AI-powered application — and how you
work with AI tools while doing it.

## Required tooling

- **Claude Code** is the required AI development tool for this assignment. Use it as
  much as you like — we expect and encourage heavy AI use.

- **This project is already a git repository.** Work inside it, and do not
  re-initialize it — your commit history is part of what you submit, so it must be kept
  intact and included when you send your work back.

- This repository includes a pre-configured prompt log: every prompt you write in
  Claude Code (and a truncated copy of each answer) is automatically appended to
  `PROMPTS.jsonl`. **Leave this enabled and commit the log together with your code.**
  The log is part of your submission.
- **Before you start building:** open Claude Code in the repo (approve the project
  settings when asked), send any first prompt, and check that `PROMPTS.jsonl` gained
  new lines. If it didn't, ask Claude to fix the logging hooks for your machine before
  continuing — a submission without a log can't be evaluated.

## What's in this project

When you unzip it, you'll find:

- **`TASK.md`** — this brief.
- **`README.md`** — a skeleton with the sections we expect you to fill in.
- **`PROMPTS.jsonl`** — your prompt log (starts empty, fills as you work). Keep it and
  commit it.
- **`CLAUDE.md`** and the **`.claude/`** folder — the prompt-logging setup. Leave them
  in place.
- **`.gitignore`** — keeps your `.env` and OS junk out of git; extend it as needed.

There's **no application code** — the stack, structure, and everything else are yours to
build from scratch.

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

## Running it

Your app must start with a **single command on a clean machine, fully isolated** — in
practice, we will run `docker compose up` (or the one command your README specifies)
and expect a working application. If we can't run it, we can't evaluate it.

## Working practices

- **AI use**: use Claude Code freely, but you must understand every piece of code you
  ship.
- **Ambiguity**: if any requirement seems unclear — or requirements seem to pull in
  different directions — don't wait for us: **make a reasonable call and document it in
  your README.** There is no single right answer; we care about your reasoning.

## Deliverables

Your project (see the email for how to send it back), containing:

- the complete source code,
- the full git history,
- the committed prompt log,
- a **README** with the following sections:
  1. **Setup & run** — the exact command(s) to get the app running on a clean machine,
     plus any prerequisites. We will follow these literally.
  2. **Architecture overview** — the main parts of your app and how they fit together.
     Keep it short; a diagram is welcome but not required.
  3. **Key decisions** — the choices you made on the important open questions, and what
     alternatives you considered.
  4. **Ambiguities** — anything in the requirements that was unclear or seemed to pull
     in different directions, and the call you made.
  5. **AI usage** — how you used Claude Code while building: which techniques you used
     (planning, subagents, anything beyond plain chatting), where, and why.
  6. **Known limitations** — what doesn't work well, wasn't handled, or would need
     attention before real use. Every project has these; we want to see that you know
     yours.
  7. **Beyond the spec** *(optional)* — anything you built beyond the requirements.

## Evaluation

We look at whether the app works, the decisions you made and how you justified them,
the quality and leanness of the code, and how you worked — including how you used AI
throughout.

## One more thing

Please don't delete your Claude Code session history for this project until the hiring
process is complete — we may ask for it.

Good luck — we're looking forward to seeing how you work.
