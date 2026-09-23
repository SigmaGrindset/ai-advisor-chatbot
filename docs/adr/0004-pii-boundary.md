# Guard what leaves for third parties; don't redact before the model

The privacy boundary is at data leaving for third parties, not at the model: tool
arguments are typed so they can't carry personal data, the search query is stripped of
document numbers (ADR-0009), and the Traveler Profile can be deleted fact by fact.
Redacting before the model would break visa and date answers, and encrypting with the key
in the same `.env` would be theatre, so storage is plaintext. Search results are untrusted
data and can never cause a write (ADR-0010).
