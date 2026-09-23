# 08: Web search and the query guard

**Status:** closed

Web search is a nested OpenRouter call with the web plugin, and its sources become
Citations that show the exact query sent. The guard strips document-shaped numbers instead
of refusing the query (ADR-0009). Code review caught two gaps in its first patterns, so
every pattern now has a test.
