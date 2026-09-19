# PII boundary: guard egress, do not redact before the model, store in plaintext

The boundary is at **egress to third parties**, not at the model: tool arguments are typed
so structured Live-data Tools cannot carry personal data by construction, the free-text
search query is stripped and the exact query that left the machine is shown in the UI
(ADR-0009), and the Traveler Profile is enumerable and deletable fact by fact.

Redacting before the model would break the product rather than harden it — the advisor
needs nationality to answer a visa question and dates to plan days — and the LLM is the
one third party the application cannot avoid, since it is the reason the application
exists. Encryption at rest is theatre while the key sits in the same `.env` on the same
host; storage is plaintext and the README says so.

Web search results are untrusted input: wrapped in delimiters marking them as data rather
than instructions, and — structurally — a tool result may never on its own trigger a
profile write or a plan change (ADR-0010).
