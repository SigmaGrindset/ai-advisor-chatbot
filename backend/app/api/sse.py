"""Server-sent events, framed by hand.

One JSON object per event, so the browser reads a reply as it is written.
Hand-rolled because it is one line, and because these exact bytes are what the
frontend's stream reader is written against.
"""

import json
from typing import Any


def event(payload: dict[str, Any]) -> bytes:
    """One event on the wire."""
    return f"data: {json.dumps(payload)}\n\n".encode()
