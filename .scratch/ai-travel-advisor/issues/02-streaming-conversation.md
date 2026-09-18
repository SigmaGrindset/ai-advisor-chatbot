# 02: A Conversation that streams

**What to build:** A traveler types a message and watches the Advisor's reply stream in
word by word, then reloads the page and the exchange is still there. One Conversation, the
default Advisor Instructions, no tools, no memory, no plan — the thinnest complete path
from a keystroke to a persisted answer.

**Blocked by:** 01.

**Status:** ready-for-agent

- [x] Sending a Message streams the Advisor's reply to the browser as it arrives rather
      than appearing all at once when complete
- [x] Both the traveler's Message and the Advisor's Message persist and reappear after a
      reload
- [x] The Advisor answers in role as a travel advisor, using default Advisor Instructions
      composed on the server
- [x] The multi-step loop is written by hand against the OpenAI-compatible client pointed
      at OpenRouter; upstream keep-alive comment lines are ignored rather than parsed
- [x] The cost of each turn is read from the usage on the final stream chunk and recorded
      against the turn
- [x] The conversation model and the utility model are configurable by environment variable
      and have working defaults
- [x] A test drives a complete turn through the seam with a canned stream and asserts what
      is persisted
- [x] A test asserts that content arriving as fragments across chunks reassembles correctly

## Comments

Implemented. Verified on this machine, in the browser, against the real OpenRouter API:
a reply streamed in progressively, survived a page reload and a container rebuild, and
`cost_usd = 0.006724` was recorded on the advisor Message from the provider's own final
chunk. 24 backend tests pass, `mypy --strict` and `tsc --noEmit` are clean.

Shape of it:

- `POST /api/conversation/messages` answers with a hand-rolled server-sent stream over a
  POST — `traveler_message`, then a `fragment` per chunk, then `advisor_message`, or
  `failed`. The browser reads it with a stream reader (`frontend/src/api.ts`), because
  `EventSource` can only GET.
- `app/advisor.py` is the turn loop: ours, not a framework's (ADR-0005). It streams a
  step and re-calls while the model asks for tools, which today is never. Keep-alive
  comment lines are dropped by the SDK's SSE decoder rather than parsed, and a test feeds
  them in to prove it.
- The traveler's Message is committed **before** the model is called, so a turn that dies
  mid-stream still leaves their words where they said them.
- `Message.created_at` defaults to `clock_timestamp()`, not `now()`. `now()` is the
  transaction timestamp, so Messages written inside one transaction — as the test harness
  does — would share a timestamp and lose their order.
- Cost is read from `usage.cost` on the final chunk, asked for with
  `{"usage": {"include": true}}`. Confirmed against the live API: the usage chunk arrives
  after the finish chunk and carries `cost`.
- `CONVERSATION_MODEL` defaults to `anthropic/claude-sonnet-5`, `UTILITY_MODEL` to
  `anthropic/claude-haiku-4.5`. Compose passes both through only when actually set, so an
  unset variable leaves the application's own default in place rather than blanking it.

Deliberate deviations, and what was left for later tickets:

- `test_the_utility_model_is_named_by_the_environment` asserts on `Settings` rather than
  through the API. Nothing consumes the utility model until Conversation titles need it
  in 03, so there is no behaviour to observe yet — only that the variable is read under
  the documented name. It is marked as a deviation in its own docstring.
- The interface uses raw Tailwind colour utilities, against the spec's rule that no
  component references a raw colour value. The semantic token layer is 04's; building it
  here would be the scope creep this ticket otherwise avoids. `text-red-700` on the error
  line is the one that should become a token first.
- Enter sends and Shift+Enter inserts a newline. The composer that grows with its content
  is still 05's.
- Failure handling is the minimum that avoids a hang: a 503 before anything is persisted
  when the key is missing, a `failed` event when the turn dies, and the draft handed back
  to the composer. The structured in-interface error and the partial Message marked failed
  are 14's.
- `/api/conversation` is singular because there is exactly one. 03 generalises it.
- Markdown in replies renders as plain text — 05 owns the sanitising renderer.
