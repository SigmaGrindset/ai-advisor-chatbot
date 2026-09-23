# 09: The Trip Plan

**Status:** closed

The plan is stored as rows: plain fields on the Trip, and Itinerary Items and Open
Questions in their own tables. Nine tools each change one field or entry. A
field the traveler is editing is protected from incoming changes, and once a turn has
fetched anything the writing tools are withdrawn (ADR-0010). Days are stored as numbers,
not dates, so moving a trip is a single change.
