# 05: Chat presentation and first run

**What to build:** The chat reads like an advisor writing to you rather than a messenger
app, and a first-time visitor knows what the application is for within seconds of it
loading.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] Messages are full-width and editorial; the traveler's Messages are distinguished
      without chat bubbles
- [ ] Markdown in the Advisor's replies is rendered through a sanitising renderer with a
      restricted element set — no raw HTML, no images supplied by the model
- [ ] The view sticks to the bottom while streaming only if the traveler was already at the
      bottom; otherwise it stays put and offers a jump-to-latest control
- [ ] A stop control interrupts a streaming reply
- [ ] A failed Message shows an inline error with a retry control; retry is the only
      per-Message action
- [ ] Enter sends and Shift+Enter inserts a newline; the composer grows with its content
- [ ] First run shows a greeting that is rendered as interface and is not persisted as a
      Message, plus four starter prompts covering a visa question, a weather question, an
      exchange-rate question and an open-ended planning question
- [ ] Clicking a starter prompt fills the composer without sending it
- [ ] Empty states for no Conversations, no Trips and no Profile Facts each say in one line
      what will fill them; the Traveler Profile's empty state also says that facts can be
      deleted
- [ ] The streaming reply is announced through a live region for screen readers
- [ ] Every control in the chat is reachable and operable by keyboard
