# Live data via typed keyless tools, with web search as a nested call

> **Amended by ADR-0008.** REST Countries stopped being keyless during ticket 07;
> country facts come from the World Bank instead. Everything else below stands.

Weather (Open-Meteo), exchange rates (Frankfurter) and country facts (REST Countries) are
keyless HTTP APIs with typed arguments. Web search is a *nested* OpenRouter request — a
cheap model with the `web` plugin enabled — whose answer and citations return into the
main loop as a tool result.

The binding constraint is that the evaluating machine holds exactly one credential, the
OpenRouter key, so no source may require a second signup.

The plugin is never enabled on the main conversation: `:online` there was measured at a
flat **$0.007 per request** regardless of result count, charged whether or not the web was
needed. Nested, it is paid only when the advisor decides it needs the web, and a weather
question stays a free number rather than $0.007 of prose. Frankfurter serves ECB reference
rates, daily rather than intraday, and the advisor says so.
