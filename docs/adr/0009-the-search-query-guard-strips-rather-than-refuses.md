# The search guard strips document numbers instead of refusing the query

The search query is the only free text sent to a third party besides the model, so
`privacy/queries.py` removes anything shaped like a card, ID or passport number, or any run
of eight or more digits, before the request is built. Refusing would block real questions
like "My passport is C12345678, do I need a visa for Japan?", and matching shapes rather
than words keeps "my passport expires in 2027" searchable. The eight-digit rule
over-reaches on purpose (a price in rupiah can lose its figure), and the exact query sent
is always recorded and shown.
