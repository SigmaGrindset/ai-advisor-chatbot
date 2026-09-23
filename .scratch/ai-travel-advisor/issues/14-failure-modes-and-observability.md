# 14: Failure modes and observability

**Status:** closed

A failed turn is saved as a Message. It keeps whatever arrived, the kind of failure
(configuration, credit, upstream or application), and a retry that re-answers the same
question. Logs never contain Message text. Known gaps: retrying after a plan change can
apply that change twice, and a turn that dies reports no cost.
