"""The single seam through which every outbound HTTP call leaves the application.

One client, injected as a dependency, used by the model client and by every
Live-data Tool. Tests replace it with a transport that answers by host, which is
what keeps the real request-building and response-parsing code under test.
"""

import httpx2
from fastapi import Request

OUTBOUND_TIMEOUT = httpx2.Timeout(10.0, connect=5.0)


def create_http_client() -> httpx2.AsyncClient:
    return httpx2.AsyncClient(timeout=OUTBOUND_TIMEOUT)


def get_http_client(request: Request) -> httpx2.AsyncClient:
    client: httpx2.AsyncClient = request.app.state.http_client
    return client
