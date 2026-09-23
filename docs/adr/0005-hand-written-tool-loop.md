# A hand-written tool loop, no agent framework

The `openai` SDK points at OpenRouter, and the tool loop — stream, parse tool calls,
dispatch, repeat — is about 80 lines of our own. A framework would sit exactly where
control matters: switching the web plugin per request, injecting the Profile and Plan, and
reading `usage.cost` to stay inside the $5 budget.
