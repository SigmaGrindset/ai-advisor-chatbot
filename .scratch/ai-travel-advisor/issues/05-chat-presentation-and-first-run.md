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

Implemented. Every criterion was driven through the interface against a real model rather
than reasoned about. 66 frontend and 36 backend tests pass; `tsc --noEmit` and
`npm run build` clean.

- **`markdown.ts` is the sanitising renderer, and it sanitises nothing.** It answers with
  a typed tree that has no node for an image and no node for raw markup, so a script tag
  cannot become a script element — there is nothing for it to become, and it arrives as
  text. Nothing calls `dangerouslySetInnerHTML`, and `vocabulary.test.ts` fails the build
  if anything ever does. A filter is a list of things somebody remembered; this is a shape
  that cannot hold the thing.
- **Link schemes are an allowed list** — `http`, `https`, `mailto` — so a scheme invented
  next year is refused by default. Control characters are stripped first, because a tab
  inside `java<tab>script:` reads as a scheme to a browser but not to a naive test for
  one.
- **The parser is written for text that is half-arrived**: an unclosed delimiter is the
  character it is, an unclosed fence is the code so far, and a test runs every prefix of a
  realistic reply through it. Every reply is rendered at every length it ever has.
- **The reply is read out a sentence at a time as it is written**, not once at the end:
  start-then-silence-then-a-wall-of-text is the non-streaming experience wearing a live
  region. Sentences are *added* rather than replacing what is there, which is the only way
  two turns running can each say "The advisor is replying." — the same string written
  twice is not a change any reader reports. `settled()` holds back the half-written
  sentence and knows a figure from a full stop, because "The rate is 1." is worse than
  saying nothing yet.
- **Four seams were agreed before any test was written** — the parse tree, `atBottom`, the
  first-run content, the source guard. Nothing renders a component to assert on it, which
  is the line 04 drew with `tripPastel`.

Five bugs found by driving the application, none of which a test would have caught: the
live region was announcing raw Markdown, so `spoken()` reads the words off the parsed
tree; the scroll position has to be read **during the render**, because browsers coalesce
scroll events to one per frame and a layout effect is already too late — by then the reply
has grown the transcript and every position looks scrolled away from; `sending` was
global, so Stop appeared in Conversations that were not streaming and aborted the one that
was; the finished reply was drawn both as a Message and as one still arriving through the
naming call's window, where stopping would have marked a persisted reply "not kept"; and
Send unmounted itself when activated, dropping keyboard focus to the body.

Deviations, and what was left for later tickets:

- **Retry sends the question again, so a failed turn can leave it in the transcript
  twice**, and a failed turn's error and retry live only in memory, so a reload loses
  both. Re-sending was chosen over widening 05 into the streaming endpoint. **This is a
  new item for 14, not one 14 already covers** — 14's criterion is about persisting a
  partial *reply*.
- **A stopped reply is kept on screen, labelled as not kept.** The criterion asks only
  that stopping interrupts; throwing away what they had already read would be worse, and
  the label tells the truth about what survives a reload, which is nothing.
- **The rendered element set is wider than "lists, emphasis and links"** — headings,
  blockquote, thematic break and fenced code are in it. A model writing an itinerary emits
  `## Day One` whatever we support, and showing two literal hashes is not a narrower
  interface, it is a broken one. Six block shapes and five inline ones, closed. A fenced
  block's language is parsed and then dropped, read only so it is not mistaken for code.
- The traveler's own words go through no renderer at all: Markdown is what the advisor
  writes, not what the traveler is made to write.
- **The no-Conversations empty state is the one thing not seen on screen** — showing it
  meant deleting the real Conversations on this machine. It is a `length === 0` branch.
