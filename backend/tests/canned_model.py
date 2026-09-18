"""A canned OpenRouter, in the wire format it actually uses.

The application's stream parsing is real code under test, so what it parses here
has to be the real thing: server-sent events carrying chat completion chunks,
keep-alive comment lines, a usage chunk at the end, and a `[DONE]` sentinel.

One canned provider answers both kinds of call the application makes, because on
the wire they go to one host. A streamed request is the traveler's turn; an
unstreamed one is the utility model's work, and gets a plain completion.
"""

import json
from collections.abc import AsyncIterator, Iterable, Mapping
from typing import Any

import httpx2

from .canned_transport import Responder

#: What OpenRouter sends while an upstream provider is still thinking. It is an
#: SSE comment, so a correct reader drops it rather than trying to parse it.
KEEP_ALIVE = b": OPENROUTER PROCESSING\n\n"

DONE = b"data: [DONE]\n\n"


def event(payload: Mapping[str, Any]) -> bytes:
    return f"data: {json.dumps(payload)}\n\n".encode()


def content(text: str) -> bytes:
    """A chunk carrying one fragment of the reply."""
    return event(_chunk({"role": "assistant", "content": text}))


def finish() -> bytes:
    """The chunk that says the model has stopped."""
    return event(_chunk({}, finish_reason="stop"))


def usage(cost: float) -> bytes:
    """The final chunk, carrying OpenRouter's own figures for the call."""
    chunk = _chunk({}, finish_reason="stop")
    chunk["usage"] = _usage(cost)
    return event(chunk)


def answering(text: str) -> Responder:
    """A model that answers one plain, unstreamed completion — the utility model's kind."""

    def answer(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            json={
                "id": "gen-utility",
                "object": "chat.completion",
                "created": 1,
                "model": "test/utility-model",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": text},
                        "finish_reason": "stop",
                    }
                ],
            },
        )

    return answer


def unwell() -> Responder:
    """A model that is having a bad day."""

    def answer(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(500, json={"error": {"message": "upstream is unwell"}})

    return answer


def _usage(cost: float) -> dict[str, Any]:
    return {
        "prompt_tokens": 240,
        "completion_tokens": 61,
        "total_tokens": 301,
        "cost": cost,
        "is_byok": False,
    }


def _chunk(delta: Mapping[str, Any], finish_reason: str | None = None) -> dict[str, Any]:
    return {
        "id": "gen-1",
        "object": "chat.completion.chunk",
        "created": 1,
        "model": "test/model",
        "choices": [{"index": 0, "delta": dict(delta), "finish_reason": finish_reason}],
    }


class CannedModel:
    """An OpenRouter that answers with fixed replies and remembers what it was asked.

    Usable directly as a route in the harness's `outbound_routes`.
    """

    def __init__(
        self,
        *events: bytes,
        split_every: int | None = None,
        utility: Responder | None = None,
    ) -> None:
        self.requests: list[httpx2.Request] = []
        self._body = b"".join((*events, DONE))
        # How the body arrives on the wire. A real stream is cut wherever the
        # network cuts it, so a test about reassembly asks for pieces that fall in
        # the middle of lines.
        self._split_every = split_every
        self._utility = utility or answering("A canned title")

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        if not _is_streamed(request):
            return self._utility(request)
        headers = {"content-type": "text/event-stream"}
        if self._split_every is None:
            return httpx2.Response(200, content=self._body, headers=headers)
        pieces = [
            self._body[at : at + self._split_every]
            for at in range(0, len(self._body), self._split_every)
        ]
        return httpx2.Response(200, content=_yield(pieces), headers=headers)

    @property
    def turns(self) -> list[dict[str, Any]]:
        """The bodies of the streamed calls — the traveler's turns."""
        return [_body(request) for request in self.requests if _is_streamed(request)]

    @property
    def utility_calls(self) -> list[dict[str, Any]]:
        """The bodies of the unstreamed calls — the utility model's work."""
        return [_body(request) for request in self.requests if not _is_streamed(request)]

    @property
    def sent(self) -> dict[str, Any]:
        """The body of the last turn the application sent."""
        return self.turns[-1]

    @property
    def prompt(self) -> list[dict[str, Any]]:
        """The messages of the last turn the application sent."""
        messages: list[dict[str, Any]] = self.sent["messages"]
        return messages


def replying(
    *fragments: str, cost: float | None = None, utility: Responder | None = None
) -> CannedModel:
    """A model that says `fragments`, one stream chunk each."""
    events = [content(fragment) for fragment in fragments]
    events.append(finish())
    if cost is not None:
        events.append(usage(cost))
    return CannedModel(*events, utility=utility)


def _body(request: httpx2.Request) -> dict[str, Any]:
    parsed: dict[str, Any] = json.loads(request.content)
    return parsed


def _is_streamed(request: httpx2.Request) -> bool:
    return bool(_body(request).get("stream"))


async def _yield(chunks: Iterable[bytes]) -> AsyncIterator[bytes]:
    for chunk in chunks:
        yield chunk
