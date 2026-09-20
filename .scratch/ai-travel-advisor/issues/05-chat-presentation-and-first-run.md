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
than reasoned about.

- **`markdown.ts` is the sanitising renderer, and it sanitises nothing.** It answers with
  a typed tree that has no node for an image and no node for raw markup, so a script tag
  cannot become a script element — there is nothing for it to become, and it arrives as
  text. Nothing calls `dangerouslySetInnerHTML`. A filter is a list of things somebody
  remembered; this is a shape that cannot hold the thing.
- **Link schemes are an allowed list** — `http`, `https`, `mailto` — so a scheme invented
  next year is refused by default. Control characters are stripped first, because a tab
  inside a scheme name reads as a scheme to a browser but not to a naive test for one.
- **The parser is written for text that is half-arrived**: an unclosed delimiter is the
  character it is, an unclosed fence is the code so far, and a test runs every prefix of a
  realistic reply through it.
- **The reply is read out a sentence at a time as it is written**, not once at the end.
  Sentences are *added* rather than replacing what is there, which is the only way two
  turns running can each say "The advisor is replying." — the same string written twice is
  not a change any reader reports. `settled()` holds back the half-written sentence and
  knows a figure from a full stop.
- **The scroll position has to be read during the render**: browsers coalesce scroll
  events to one per frame, and by the time a layout effect runs the reply has already
  grown the transcript and every position looks scrolled away from.

Deviations, and what was left for later tickets:

- **Retry sends the question again, so a failed turn can leave it in the transcript
  twice**, and a failed turn's error and retry live only in memory, so a reload loses
  both. Raised as a new item for 14, which settled it.
- **A stopped reply is kept on screen, labelled as not kept.** Throwing away what they had
  already read would be worse, and the label tells the truth about what survives a reload,
  which is nothing.
- **The rendered element set is wider than "lists, emphasis and links"** — headings,
  blockquote, thematic break and fenced code are in it. A model writing an itinerary emits
  `## Day One` whatever we support, and showing two literal hashes is not a narrower
  interface, it is a broken one. Six block shapes and five inline ones, closed.
- The traveler's own words go through no renderer at all: Markdown is what the advisor
  writes, not what the traveler is made to write.
