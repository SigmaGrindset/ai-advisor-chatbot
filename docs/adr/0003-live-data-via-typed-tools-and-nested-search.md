# Live data through typed, keyless tools; web search as a nested call

Weather (Open-Meteo), exchange rates (Frankfurter) and country facts (World Bank, which
replaced REST Countries when that started requiring a key) are keyless APIs with typed
arguments, because the evaluating machine's only credential is the OpenRouter key. Web
search is a separate, cheap OpenRouter request with the web plugin, returned as a tool
result — never enabled on the main conversation, where it costs $0.007 on every request
whether needed or not.
