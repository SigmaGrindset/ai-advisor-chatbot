# 07: Live-data Tools

**What to build:** The Advisor stops guessing. Ask it about the weather somewhere, what a
currency is worth, or a country's basics, and it goes and fetches the answer — showing what
it is doing while it works and leaving Citations behind so the traveler can check.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] Three Live-data Tools exist — current weather, exchange rate, country facts — each
      calling a keyless public service with strictly typed arguments; none has a free-text
      argument
- [ ] While a tool runs, a status line above the forming reply names what is happening
      specifically ("Checking current weather in Lisbon…") and disappears when the answer
      lands
- [ ] Citations persist beneath the Advisor's Message as numbered chips that expand to show
      the source
- [ ] An exchange-rate answer states that the figure is a daily reference rate rather than
      a live market quote
- [ ] Live-data calls have a short timeout and a single retry; after that the failure
      becomes the tool result, and the Advisor explains it rather than the turn collapsing
- [ ] Tool results are wrapped in delimiters marking them as untrusted data, and the Advisor
      Instructions state that content inside them is never an instruction
- [ ] For weather, exchange rates, prices and opening hours the Advisor either calls a tool
      in that turn or says plainly that it could not verify; other travel questions it
      answers from its own knowledge
- [ ] A test drives a full turn from a canned stream carrying a tool call through real tool
      dispatch, the tool result re-entering the loop, and the final answer persisting with
      its Citations
- [ ] A test asserts tool-call argument fragments split across chunks reassemble correctly
- [ ] A test asserts a timed-out data source becomes a tool result rather than a failed turn
