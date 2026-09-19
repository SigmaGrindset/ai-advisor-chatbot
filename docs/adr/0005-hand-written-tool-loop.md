# Hand-written tool loop over an agent framework

OpenRouter is called through the official `openai` Python SDK pointed at its
OpenAI-compatible base URL, and the multi-step tool loop is ours: accumulate streamed
tool-call argument fragments, parse, dispatch, append the result, re-call until the model
stops asking.

A framework (`pydantic-ai`, LangChain) would reduce that to a few lines while sitting
between the application and the exact request body at precisely the points where control
matters — toggling the web plugin per request, injecting the Traveler Profile and Trip
Plan, and reading `usage.cost` off the final stream chunk to meter a $5 budget. Eighty
lines buys every request being visible in the source.
