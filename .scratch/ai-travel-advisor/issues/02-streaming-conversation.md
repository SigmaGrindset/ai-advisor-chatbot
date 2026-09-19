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

Implemented. Driven in the browser against the real OpenRouter API: a reply streamed in
progressively, survived a reload and a container rebuild, and `cost_usd = 0.006724` was
recorded from the provider's own final chunk. 24 backend tests pass, `mypy --strict` and
`tsc --noEmit` clean.

- **The stream is hand-rolled server-sent events over a POST** — `traveler_message`, a
  `fragment` per chunk, then `advisor_message` or `failed` — and the browser reads it with
  a stream reader, because `EventSource` can only GET.
- **The traveler's Message is committed before the model is called**, so a turn that dies
  mid-stream still leaves their words where they said them.
- **`Message.created_at` is `clock_timestamp()`, not `now()`.** `now()` is the transaction
  timestamp, so Messages written inside one transaction — as the harness does — would
  share a timestamp and lose their order.
- Cost is `usage.cost` on the final chunk, asked for with `{"usage": {"include": true}}`;
  confirmed against the live API that the usage chunk arrives after the finish chunk.
- Compose passes `CONVERSATION_MODEL` and `UTILITY_MODEL` through only when actually set,
  so an unset variable leaves the application's default rather than blanking it.

Deviations, and what was left for later tickets:

- `test_the_utility_model_is_named_by_the_environment` asserts on `Settings` rather than
  through the API, because nothing consumes the utility model until 03 needs titles.
  Marked as a deviation in its own docstring.
- Raw Tailwind colour utilities, against the spec's no-raw-colour rule: the semantic token
  layer is 04's, and building it here would be the scope creep this ticket otherwise
  avoids.
- Failure handling is the minimum that avoids a hang — a 503 before anything persists when
  the key is missing, a `failed` event when the turn dies, the draft handed back. The
  structured error and the partial Message are 14's.
- `/api/conversation` is singular because there is exactly one; 03 generalises it.
  Markdown renders as plain text until 05. The growing composer is 05's.
