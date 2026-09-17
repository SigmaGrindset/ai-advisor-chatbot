# 02: A Conversation that streams

**What to build:** A traveler types a message and watches the Advisor's reply stream in
word by word, then reloads the page and the exchange is still there. One Conversation, the
default Advisor Instructions, no tools, no memory, no plan — the thinnest complete path
from a keystroke to a persisted answer.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Sending a Message streams the Advisor's reply to the browser as it arrives rather
      than appearing all at once when complete
- [ ] Both the traveler's Message and the Advisor's Message persist and reappear after a
      reload
- [ ] The Advisor answers in role as a travel advisor, using default Advisor Instructions
      composed on the server
- [ ] The multi-step loop is written by hand against the OpenAI-compatible client pointed
      at OpenRouter; upstream keep-alive comment lines are ignored rather than parsed
- [ ] The cost of each turn is read from the usage on the final stream chunk and recorded
      against the turn
- [ ] The conversation model and the utility model are configurable by environment variable
      and have working defaults
- [ ] A test drives a complete turn through the seam with a canned stream and asserts what
      is persisted
- [ ] A test asserts that content arriving as fragments across chunks reassembles correctly
