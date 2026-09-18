"""Server-sent events, framed by hand.

One JSON object per event, so the browser can read a reply as it is written
rather than waiting for the whole of it. Hand-rolled because the whole of it is
one line, and because these exact bytes are the interface the frontend's stream
reader is written against — a library that framed them differently would be a
change to the API rather than a change of dependency.
"""

import json
from typing import Any


def event(payload: dict[str, Any]) -> bytes:
    """One event on the wire."""
    return f"data: {json.dumps(payload)}\n\n".encode()
