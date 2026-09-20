# AI Travel Advisor — Antonio Batarilović

A web application where a traveler plans a real trip by talking about one. The advisor
fetches what it cannot know rather than guessing, remembers the traveler between
conversations, and builds a structured Trip Plan beside the chat as they talk.

## 1. Setup & run

Prerequisite: Docker with Compose v2. Nothing else — no Node, no Python, no database on
the host.

```bash
docker compose up
```

The application is on <http://localhost:8000>. One command is all of it: this archive
ships with a working `.env` holding the OpenRouter key you supplied, so there is nothing
to fill in first.

If ports 8000 or 5432 are taken, set `APP_PORT` or `DB_PORT`.

To run it against a different key instead, `cp .env.example .env` and put your own in it.

The two models are optional and unset by default. The defaults are
`anthropic/claude-sonnet-5` for the conversation and `anthropic/claude-haiku-4.5` for the
utility work behind titles, summaries and web search; set `CONVERSATION_MODEL` and
`UTILITY_MODEL` in `.env` if you want to change the default models. This is not required of course.

## 2. Architecture overview

Two containers: Postgres, and one application image. That image is built in two stages —
Node builds the frontend bundle, then the Python process serves that bundle and the API
together. Everything comes from one origin, so there is no CORS configuration anywhere
and a client-side route survives a reload.

### One message, end to end

The rest of this section makes more sense after following one message through, so:

1. The traveler sends a message. The browser posts it and keeps the response open, since
   the answer comes back in pieces.
2. The prompt is put together: the Advisor Instructions as they stand right now, the Trip
   Plan, the Traveler Profile, the names of the traveler's other Conversations, and, for a
   long thread, a summary covering its oldest messages.
3. That goes to the model, which starts writing.
4. It may stop partway and ask for a tool — a forecast, an exchange rate, a web search, a
   change to the Trip Plan. The tool runs, its result goes back, the model is called
   again, and this repeats for as long as it keeps asking.
5. Whatever the traveler should see on the way is sent as it happens: the text itself,
   "Checking current weather in Lisbon…" while a tool runs, plan fields changing under it.
6. The reply is stored when it finishes.

That whole pass is a **turn** — one question in, one answer out, however many model calls
and tool calls happened in between.

Keeping the response open like that is **server-sent events**: one HTTP response held
open, with small JSON frames written down it as things happen. It rides on a POST rather
than the browser's own `EventSource`, which only does GETs and so has no body to put the
traveler's message in.

### Where that lives in the code

```
   browser  —  React SPA
      │
      │   POST a message, and read the reply as it is written
      ▼
 ┌──────────────────────────────────────────────────────┐
 │  app  —  FastAPI, also serving the built SPA         │
 │                                                      │
 │    api/        HTTP routes, and the event format     │
 │      ↓         the browser reads                     │
 │    services/   one turn, end to end: prompt, plan,   │
 │      ↓         profile, compaction                   │
 │    advisor/    the model client and the tool loop    │
 │    db/         tables and queries                    │
 │    privacy/    the one way out, and the guard on it  │
 └────────┬───────────────────────────┬─────────────────┘
          │                           │
          ▼                           ▼
   ┌────────────┐      ┌───────────────────────────────────┐
   │  postgres  │      │  OpenRouter — the model itself,   │
   └────────────┘      │    and web search nested inside   │
                       │  Open-Meteo  — weather            │
                       │  Frankfurter — exchange rates     │
                       │  World Bank  — country facts      │
                       └───────────────────────────────────┘
```

Dependencies point one way — `api → services → advisor`/`db` — and nothing below reaches
back up. Three rules do most of the work of keeping it that way:

- **`services/` does not know it is talking to a browser.** It reports what happened —
  text arrived, a tool ran, the plan changed, the turn failed — and `api/` turns those
  reports into the messages the browser reads. Each side knows one thing, so a turn can
  be tested without a web server, and a new kind of event can be added without either
  side learning the other's job.
- **The system prompt is assembled in exactly one place.** Both a turn and the Advisor
  Instructions page go through that same assembly, which is what lets the page show
  the prompt character-for-character rather than a reconstruction of it that can
  drift from what the next message actually sends.
- **One door out, and it is called `privacy/`.** The traveler's data can only reach an
  outside service by leaving over a network request — so whatever owns outbound requests
  owns the privacy question. The single connection to the outside world is built there
  and handed to everything that needs it, the model client and every live-data tool
  alike

The **tool loop** is hand-written rather than taken from a framework: run a step, run
whatever tool the model asked for, hand back the result, call again until it stops
asking.

### The frontend

React 19, Vite, Tailwind v4, TypeScript strict.

The awkward part of the frontend is that a reply does not arrive all at once: it comes
in pieces, the traveler can stop it halfway, and it can fail partway through. All of
that lives in one module, so every component that shows a turn only draws what it is
given. Logic is kept out of the components generally, which is why the frontend tests
run under Node with no browser.

## 3. Key decisions

**Trips own Trip Plans; Conversations attach to a Trip** The plan belongs to the Trip.
The advisor decides which Trip a Conversation joins, and since it can get that wrong,
the traveler can move it.

**A structured Traveler Profile, not retrieval over past messages**. The usual way to
make an assistant remember you is to keep every old message and dig out the ones that
look most similar to whatever you just asked. So the advisor keeps a short list of plain
facts instead: nationality, dietary needs, who they travel with. The real win is that a
list can be shown. "Here is everything the advisor knows about you, delete any line" is
a page you can build from that, and never from a pile of retrieved fragments.

**Live data through typed keyless tools, with web search as a nested call**.
Whoever runs this has one API key and nothing else, so nothing the advisor reaches for
can require a second signup. That leaves the free, keyless sources: Open-Meteo for
weather, Frankfurter for exchange rates, the World Bank for country facts. Web search
has no free equivalent, so it goes through the one key there is — a second, small
OpenRouter request with web search turned on, whose answer and sources come back into
the conversation as just another tool result. Keeping it separate is the point. Leaving
search switched on for the whole conversation cost a flat $0.007 per request whether the
web was touched or not, so asking about tomorrow's weather would have paid it on top of
a forecast that is free.

**A hand-written tool loop**. A framework would have done this in a few lines, but it
would also sit between the application and the request actually going out — and the
request is exactly where the control is needed: switching web search on for one call and
not another, deciding what goes into the prompt, reading back what the turn cost. Eighty
lines written by hand means every request this application makes is visible in the
source.

**Personal data is guarded on the way out, not on the way to the model**. The obvious move
is to strip personal details before anything reaches the model. That would break the
advisor rather than protect it: it needs a nationality to answer a visa question and
dates to plan the days, and the model is the one outside service this application cannot
do without. So the guard sits further out, where data goes to everyone else. Most tools
take typed arguments — a city, a date, a currency — which have nowhere to put a passport
number in the first place. The one exception is the web search query, the only free text
that ever leaves, so it is checked for the shapes a document number takes and shown to
the traveler exactly as it went out.

**Nothing fetched can write**. Once anything from outside enters a turn — a forecast, a
search result — the tools that change the Trip Plan and the Traveler Profile are taken
away for the rest of it, and a model that asks for one anyway is told no such tool
exists. They are not refused, they are simply not there, which is the difference between
a rule the model is trusted to follow and one it cannot break. The cost is that a search
which changes the advisor's mind only changes the plan on the next turn. That is also
the point: a change to the plan always follows something the traveler said, never
something a web page said.

**The Trip Plan is a pane, never a page**. The brief says the plan "takes shape as they
talk" — and nothing takes shape in front of you if you have to navigate away to see it.
So it sits beside the conversation — a third column on desktop, a sheet that
slides up from the bottom on a phone — updating as the advisor writes, with whatever
just changed briefly highlighted.

**Compaction shortens the prompt, never the transcript.** A conversation can eventually
grow past what fits in a single request, so its oldest messages are replaced by a
running summary — but only in what gets sent to the model. Scroll back and every message
is still there, exactly as it was.

**Other Conversations are known by name, not by content**. The advisor is told what the
traveler's other Conversations are called and nothing about what was said in them.
Summarising each would mean an extra model call per Conversation on every turn, a prompt
that grows without limit as they pile up, and — worst — undoing the thing the traveler
did by opening a separate Conversation in the first place. What does carry across is the
Traveler Profile and the Trip Plan, both of which the traveler can read and edit.

## 4. Ambiguities

**"A conversation should produce a trip plan" versus "a traveler plans one trip across
several conversations."** These two pull in opposite directions. Take the first
literally and every thread gets a plan of its own, at which point the second has nothing
left to mean. So the Trip owns the plan, and Conversations attach to it.

**"Changes take effect immediately"** needed a reading. It was taken to mean the next
message in any Conversation uses the new instructions, including Conversations that were
already going — but not that a reply already being written is interrupted, and not that
messages already sent are rewritten. Which version of the instructions was in force is
read at the start of every turn and stored with the message it produced, so if the
advisor starts behaving differently halfway through a Conversation there is a record of
why.

**How far deleting a Conversation reaches.** Deleting one removes that thread and its
messages and nothing more — the Trip Plan and the Traveler Profile stay. Deleting one of
several conversations about a journey should not throw away the journey. Deleting a
*Trip* is different, and that is where the traveler is asked what should happen to the
Conversations attached to it.

**What counts as needing a lookup.** The brief asks for live information without saying
where the line falls. Anything that changes gets fetched — an exchange rate, a forecast,
entry requirements — while what a city is like in April, or whether three days is
enough, is answered from what the model already knows. Otherwise the advisor is just a
search box with a nicer voice. One case turned out to matter more than expected: for
dates too far out for any forecast to exist, it reports what those days have actually
been like over the last ten years, gives the range rather than a single number, and says
plainly that it is describing a season and not predicting a day.

**How much of an earlier conversation "draw on those earlier conversations" means.**
What carries over in full is the structured part: the Traveler Profile and the Trip
Plan, both of which the traveler can read and edit. The other Conversations come through
only as their names and which Trip each one is about — enough for the advisor to know
they exist and mention them, but not a summary of what was said in them. The reasons are
in §3.

## 5. AI usage

What was worth doing beyond plain chatting:

**A spec before any code, and tickets after it.** None of it started with code. A skill
called `grill-with-docs` ran the interview instead — question after question about what
the brief actually meant, where it contradicted itself, and what to do about it —
writing down what got settled as it went: the words this project would use, in
`CONTEXT.md`, and the decisions behind them, as ADRs. That is where the real decisions
were made, before there was anything to make them in. `to-spec` then took that
conversation and turned it into a spec of 91 user stories without asking anything new,
and `to-tickets` cut the spec into sixteen tickets under
`.scratch/ai-travel-advisor/issues/`, each small enough to build in one sitting and each
saying which others had to land first.

**Decisions written down at the moment they were made**, not reconstructed afterwards.
Each one is an ADR — a short file recording what was decided and what was turned down to
get there.

**A ticket lands as a commit, and closes with what it learned.** Every ticket ends with
a note written after the work: what was decided, what was left undone on purpose, and
what was ruled on rather than assumed. Those closing notes are why the work could be
picked up again sessions later without arguing the same points a second time.

**A code review at the end of every piece of work.** The `code-review` skill ran with
the commit the work started from as the fixed point and the ticket as the spec. Two
subagents took the halves of it in parallel — one checking the code against the
project's standards, the other against what the ticket actually asked for — which is
worth splitting because those two reads want completely different things in context.

**A handoff document** (`HANDOFF.md`), kept current so the next session starts oriented
instead of guessing. Its sections:

1. What to read first
2. How the application is put together, backend and frontend
3. The working rules for this repo, the testing rule among them
4. How to verify things by hand
5. Traps specific to this machine
6. Open questions — raise these, do not decide them alone
7. Skills worth calling

A long agent session loses its context. This is the file that survives one.

## 6. Known limitations

**Personal data is stored in plaintext**, and the whole Traveler Profile goes to the
model on every turn. Encrypting the database would not help much while the key sits in
the same `.env` file on the same machine, and stripping details before the model would
break the advisor. Both are still real exposures.

**No migrations.** For a demo application they did not seem worth the weight, so the
schema is simply created at startup — which adds any missing table but never a missing
column. A database left over from an earlier commit therefore comes up silently missing
columns instead of failing outright, and wiping it with `docker compose down -v` is the
fix. Anything meant to outlive an evaluation would want proper numbered migrations.

**The advisor's instructions page has no authentication**, as the brief specifies, which
means anyone who can reach the application can change how the advisor behaves. Fine for an
evaluation, not for anything real.

**Cost is recorded per turn but not enforced.** What a turn cost comes back with the
reply itself and is stored, so spend is visible without asking the provider for it. But
nothing stops a turn that is about to be expensive, and there is no rate limiting
anywhere.

**Compaction summaries are only as good as the model that writes them.** If a summary
drops something that mattered, the traveler cannot tell: their transcript still shows
every message, so nothing looks missing — it is the advisor that has forgotten. Titles
have a smaller version of the same problem, written after the first exchange and never
revisited, so a thread that wandered keeps a name that stopped fitting long ago.

## 7. Beyond the spec

- **Dark mode** that fits the color theme
- **Mobile as a first-class target** which the brief does not ask for: a phone
  layout built around the chat, the conversation list sliding in from the left, the plan
  as a sheet dragged up from the bottom with a strip that keeps the destination and dates
  in view while typing, and a web manifest so it installs like an app.
- **Compaction**, so a Conversation returned to over weeks keeps working instead of
  running out of room.
- **Typical Weather for a trip's dates** — what those days have actually been like over
  the last ten years, range and all, for dates further out than any forecast reaches.
- **Structured failures.** A turn that fails says which of four things went wrong — a
  configuration problem, an empty balance, the provider, or a bug here — keeps whatever of
  the reply had arrived, and can be run again without retyping the question.
- **A live status line** while the advisor works ("Checking current weather in Lisbon…"),
  and citations under anything built from a lookup, each opening to its source and the
  exact query that was sent.
- **The full prompt on screen**, on the instructions page: exactly what the next turn will
  send, profile and plan included.
- **Data controls**: every fact in the profile deletable on its own, and one control that
  erases everything.
