# PII boundary: guard egress, do not redact before the model, store in plaintext

Travelers share passport details, dates and companions with the advisor. We draw the
boundary at **egress to third parties**, not at the model: tool arguments are typed so
structured Live-data Tools cannot carry personal data by construction, the free-text
search query is validated and the exact query that left the machine is shown in the UI,
and the Traveler Profile is enumerable and deletable fact by fact.

## Considered Options

- **Redacting personal data before it reaches the model too.** Rejected: the advisor needs
  nationality to answer a visa question and dates to plan days, so redaction here does not
  harden the product, it breaks it. The LLM is the one third party the application cannot
  avoid, since it is the application's reason to exist. Better stated plainly than
  mitigated with a filter that cannot be trusted anyway.
- **Encrypting personal data at rest.** Rejected as theatre while the key would sit in the
  same `.env` on the same host. Storage is plaintext and the README says so.

## Consequences

Web search results are untrusted input: they are wrapped in delimiters that mark them as
data rather than instructions, and — structurally — a tool result may never on its own
trigger a Traveler Profile write or a Trip Plan change. Those follow only from something
the traveler actually said.
