# Live data via typed keyless tools, with web search as a nested call

The advisor fetches real-world facts through four Live-data Tools: weather (Open-Meteo),
exchange rates (Frankfurter), country facts (REST Countries), and a general web search.
The first three are keyless HTTP APIs with typed arguments. The fourth is implemented as a
*nested* OpenRouter request — a cheap model with the `web` plugin enabled — whose answer
and citations are returned into the main loop as a tool result.

The binding constraint is that the evaluating machine will hold exactly one credential,
the OpenRouter key, so no source may require a second signup.

## Considered Options

- **Enabling OpenRouter's `:online` suffix on the main conversation.** Measured at a flat
  **$0.007 per request** regardless of result count — roughly twenty times the token cost
  of a cheap turn, charged on every message whether or not the web was needed. As a nested
  tool it is paid only when the advisor decides it needs the web.
- **Web search for everything, no typed APIs.** One mechanism, but a weather question
  costs $0.007 and returns prose where Open-Meteo returns a number for free.

## Consequences

Structured questions get deterministic sources and open-ended ones (visa and entry rules
in particular) get search results with Citations attached, which is what makes those
answers checkable. Frankfurter serves ECB reference rates, which are daily rather than
intraday — the advisor says so rather than implying a live market quote.
