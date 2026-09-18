"""An httpx transport that answers by host, for use in the test harness.

Replacing the application's one outbound client with this leaves everything
inside the application real — routing, request building, response parsing,
persistence — while nothing reaches the network. An unrouted host is an error
rather than a silent real request.
"""

from collections.abc import Callable

import httpx2

Responder = Callable[[httpx2.Request], httpx2.Response]


class UnroutedHost(AssertionError):
    """The application tried to call a host the test did not cannedly answer."""


class CannedTransport(httpx2.AsyncBaseTransport):
    def __init__(self, routes: dict[str, Responder]) -> None:
        self._routes = routes

    async def handle_async_request(self, request: httpx2.Request) -> httpx2.Response:
        responder = self._routes.get(request.url.host)
        if responder is None:
            raise UnroutedHost(
                f"{request.method} {request.url} — no canned response for host "
                f"{request.url.host!r} (routed hosts: {sorted(self._routes)})"
            )
        return responder(request)
