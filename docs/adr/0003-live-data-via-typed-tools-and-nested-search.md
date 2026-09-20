# Live data via typed keyless tools, with web search as a nested call

Weather (Open-Meteo), exchange rates (Frankfurter) and country facts (the World Bank) are
keyless HTTP APIs with typed arguments. Web search is a *nested* OpenRouter request — a
cheap model with the `web` plugin enabled — whose answer and citations return into the
main loop as a tool result.

The binding constraint is that the evaluating machine holds exactly one credential, the
OpenRouter key, so no source may require a second signup. Country facts were REST
Countries until ticket 07, when it stopped being keyless — `restcountries.com/v3.1/*`
answers `301` to a deprecation notice and `/v5/*` answers `401 authKeyMissing` — so they
come from `api.worldbank.org/v2/country/{code}` instead: official name, capital, region,
income classification and rough coordinates, the last of which are what the advisor hands
to the weather tool, which has no place search of its own. Currency, languages and time
zones are no longer fetched — stable knowledge the advisor may answer from its own, while
the *rate* between two currencies stays a tool call.

The plugin is never enabled on the main conversation: `:online` there was measured at a
flat **$0.007 per request** regardless of result count, charged whether or not the web was
needed. Nested, it is paid only when the advisor decides it needs the web, and a weather
question stays a free number rather than $0.007 of prose. Frankfurter serves ECB reference
rates, daily rather than intraday, and the advisor says so.
