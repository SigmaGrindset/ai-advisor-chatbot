# 05: Chat presentation and first run

**What to build:** The chat reads like an advisor writing to you rather than a messenger
app, and a first-time visitor knows what the application is for within seconds of it
loading.

**Blocked by:** 04.

**Status:** ready-for-agent

- [x] Messages are full-width and editorial; the traveler's Messages are distinguished
      without chat bubbles
- [x] Markdown in the Advisor's replies is rendered through a sanitising renderer with a
      restricted element set — no raw HTML, no images supplied by the model
- [x] The view sticks to the bottom while streaming only if the traveler was already at the
      bottom; otherwise it stays put and offers a jump-to-latest control
- [x] A stop control interrupts a streaming reply
- [x] A failed Message shows an inline error with a retry control; retry is the only
      per-Message action
- [x] Enter sends and Shift+Enter inserts a newline; the composer grows with its content
- [x] First run shows a greeting that is rendered as interface and is not persisted as a
      Message, plus four starter prompts covering a visa question, a weather question, an
      exchange-rate question and an open-ended planning question
- [x] Clicking a starter prompt fills the composer without sending it
- [x] Empty states for no Conversations, no Trips and no Profile Facts each say in one line
      what will fill them; the Traveler Profile's empty state also says that facts can be
      deleted
- [x] The streaming reply is announced through a live region for screen readers
- [x] Every control in the chat is reachable and operable by keyboard

## Comments

Implemented. Verified on this machine, in the browser, against the running application and
a real model: every criterion was driven through the interface rather than reasoned about.
66 frontend tests and 36 backend tests pass; `tsc --noEmit` and `npm run build` are clean.

Shape of it:

- **`markdown.ts` is the sanitising renderer, and it sanitises nothing.** It answers with a
  typed tree that has no node for an image and no node for raw markup, so a reply saying
  `<script>steal()</script>` cannot become a script element — there is nothing for it to
  become, and it arrives as text. Nothing anywhere calls `dangerouslySetInnerHTML`, and
  `vocabulary.test.ts` now fails the build if anything ever does. A filter is a list of
  things somebody remembered; this is a shape that cannot hold the thing.
- Link addresses are an **allowed** list — `http`, `https`, `mailto` — rather than a refused
  one, so a scheme invented next year is refused by default. Control characters are stripped
  first, because `java\tscript:` reads as a scheme to a browser but not to a naive test for
  one. A refused link keeps its words and loses only its address: the traveler still reads
  what they were told and simply has nothing to click.
- The parser is written for text that is **half-arrived**. A delimiter with no closer is the
  character it is, an unclosed fence is the code so far, and a test runs every prefix of a
  realistic reply through it. That is not robustness for its own sake: every reply is
  rendered at every length it ever has.
- **Four seams were agreed before any test was written** — the parse tree, `atBottom`, the
  first-run content, and the source guard. The spec puts frontend component and browser tests
  out of scope and that still holds: nothing here renders a component to assert on it. These
  are pure modules, which is the line 04 already drew with `tripPastel`.

Two bugs the tests could not have caught, both found by driving the running application:

- **The live region was announcing raw Markdown.** A screen reader was being read "hash hash
  Three Days in Lisbon, star star Day One", because to a reader markup is characters like any
  other. `spoken()` reads the words off the parsed tree instead.
- **The scroll rule was broken in exactly the case it exists for.** Browsers coalesce scroll
  events to one per frame, so a frame holding both the traveler's wheel and the view following
  the reply reports only the foot — and a layout effect is already too late, because by the
  time one runs the reply has grown the transcript and every position looks scrolled away
  from. The position has to be read **during the render**, which is the last moment the
  pre-update DOM exists. Before the fix, scrolling up mid-reply snapped back inside a second;
  after it, the transcript grew from 1724px to 3482px while the view stayed at 0.

Three more came out of the review, all real, all verified fixed in the browser:

- **The stop control was in the wrong Conversation.** `sending` was global, so switching
  Conversations mid-turn offered Stop in a Conversation that was not streaming — and pressing
  it aborted the other one. Stopping and sending are now two different questions: a turn
  elsewhere holds this composer's send shut, but only this Conversation's reply can be stopped
  here.
- **The reply was drawn twice, and stopping then lied.** The turn is not over when the reply
  is: the Conversation may still be being named, which is another round trip. Through that
  window the finished reply was on the page both as a Message and as one still arriving, and
  stopping there would have marked an already-persisted reply "not kept". A reply stops being
  one that is arriving the moment it becomes a Message. Sampled 65 times across a first turn,
  including the naming call: never twice, and Stop never offered after the answer landed.
- **Send unmounted itself under the keyboard.** Activating it replaced it with a separate Stop
  button, dropping focus to `<body>`. It is one control that changes what it does, so the node
  survives and the traveler who reached it by keyboard still has it under them.

On the live region, which the ticket's accessibility criterion turns on: the reply is read out
**a sentence at a time as it is written**, not once at the end. Story 81's reason is "so that I
can follow the answer as it arrives", and start-then-silence-then-a-wall-of-text is the
non-streaming experience wearing a live region. Sentences are *added* to the region rather than
replacing what is there, which is both what `aria-relevant="additions"` watches for and the only
way two turns running can each say "The advisor is replying." — the same string written twice is
not a change any reader reports. `settled()` holds back the half-written sentence at the end,
and knows a figure from a full stop, because "The rate is 1." is worse than saying nothing yet.
Measured: four announcements arrived while the reply was still streaming, one per sentence.

Deliberate deviations, and what was left for later tickets:

- **Retry sends the question again, so a failed turn can leave it in the transcript twice.**
  The server commits the traveler's Message before it calls the model, so by the time a turn
  fails the question is already recorded; asking again records a second one. This was raised
  before the work started and re-sending was chosen over widening 05 into the streaming
  endpoint. **This is a new item for 14, not one 14 already covers** — 14's criterion is about
  persisting a partial *reply*, and says nothing about a traveler Message whose turn never
  answered.
- **A failed turn's error and its retry live only in memory.** Reloading, or opening another
  Conversation and coming back, leaves the question there with no way to ask it again. Same
  root as the above and the same owner.
- **A stopped reply is kept on screen, labelled as not kept.** The criterion asks only that
  stopping interrupts. Throwing away what they had already read to satisfy the letter of it
  would be worse, and the label tells the truth about what survives a reload — nothing, since
  an interrupted stream commits nothing server-side.
- **The rendered element set is wider than the spec's "lists, emphasis and links"** —
  headings, blockquote, thematic break and fenced code are in it. A model writing an itinerary
  emits `## Day One` whatever we support, and showing the traveler two literal hashes is not a
  narrower interface, it is a broken one. "Restricted" is the criterion, and it is: six block
  shapes and five inline ones, closed.
- **The language on a fenced code block is parsed and then dropped.** It is read only so it is
  not mistaken for the first line of the code. Nothing highlights, and a field nothing reads
  is a field that goes quietly wrong.
- **"No Trips" is the Trip Plan pane's empty state**, because there is no Trips surface to have
  one until 09 and 10. Both record-pane panels now say in one line what will fill them, and the
  Traveler Profile's says its facts can be deleted.
- **The no-Conversations empty state is the one thing here not seen on screen** — showing it
  would have meant deleting the real Conversations on this machine. It is a `length === 0`
  branch, read rather than watched.
- The transcript's typography is 04's, which arrived early and said so. This ticket left it
  alone and put the traveler's own words through no renderer at all: Markdown is what the
  advisor writes, not what the traveler is made to write.
