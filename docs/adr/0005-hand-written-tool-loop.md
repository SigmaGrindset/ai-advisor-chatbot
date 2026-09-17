# Hand-written tool loop over an agent framework

The application calls OpenRouter through the official `openai` Python SDK pointed at its
OpenAI-compatible base URL, and implements the multi-step tool loop itself — accumulate
streamed tool-call argument fragments, parse, dispatch, append the result, re-call until
the model stops asking.

## Considered Options

- **`pydantic-ai`.** Would reduce the loop to a few lines, but sits between the
  application and the exact request body at precisely the points where control matters:
  toggling the web plugin per request, injecting the Traveler Profile and Trip Plan, and
  reading `usage.cost` off the final stream chunk to meter a $5 budget.
- **LangChain / LangGraph.** Would become the largest dependency in the project and hide
  the mechanism this application exists to demonstrate.

## Consequences

Roughly eighty lines that a reader might otherwise mistake for reinvention. In exchange,
every request the application sends is visible in the source, and the four things that
make this advisor specific — profile injection, plan patching, gated search, spend
metering — all hang off a loop we own.
