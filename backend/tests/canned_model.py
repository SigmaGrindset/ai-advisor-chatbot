"""Canned streamed completions, in the wire format OpenRouter actually sends.

The application's stream parsing is real code under test, so what it parses here
has to be the real thing: server-sent events carrying chat completion chunks,
keep-alive comment lines, a usage chunk at the end, and a `[DONE]` sentinel.
"""

import json
from collections.abc import AsyncIterator, Iterable, Mapping
from typing import Any

import httpx2

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
    chunk["usage"] = {
        "prompt_tokens": 240,
        "completion_tokens": 61,
        "total_tokens": 301,
        "cost": cost,
        "is_byok": False,
    }
    return event(chunk)


def _chunk(delta: Mapping[str, Any], finish_reason: str | None = None) -> dict[str, Any]:
    return {
        "id": "gen-1",
        "object": "chat.completion.chunk",
        "created": 1,
        "model": "test/model",
        "choices": [{"index": 0, "delta": dict(delta), "finish_reason": finish_reason}],
    }


class CannedModel:
    """An OpenRouter that answers with a fixed stream and remembers what it was asked.

    Usable directly as a route in the harness's `outbound_routes`.
    """

    def __init__(self, *events: bytes, split_every: int | None = None) -> None:
        self.requests: list[httpx2.Request] = []
        self._body = b"".join((*events, DONE))
        # How the body arrives on the wire. A real stream is cut wherever the
        # network cuts it, so a test about reassembly asks for pieces that fall in
        # the middle of lines.
        self._split_every = split_every

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        headers = {"content-type": "text/event-stream"}
        if self._split_every is None:
            return httpx2.Response(200, content=self._body, headers=headers)
        pieces = [
            self._body[at : at + self._split_every]
            for at in range(0, len(self._body), self._split_every)
        ]
        return httpx2.Response(200, content=_yield(pieces), headers=headers)

    @property
    def sent(self) -> dict[str, Any]:
        """The body of the last request the application sent."""
        body: dict[str, Any] = json.loads(self.requests[-1].content)
        return body

    @property
    def prompt(self) -> list[dict[str, Any]]:
        """The messages of the last request the application sent."""
        messages: list[dict[str, Any]] = self.sent["messages"]
        return messages


def replying(*fragments: str, cost: float | None = None) -> CannedModel:
    """A model that says `fragments`, one stream chunk each."""
    events = [content(fragment) for fragment in fragments]
    events.append(finish())
    if cost is not None:
        events.append(usage(cost))
    return CannedModel(*events)


async def _yield(chunks: Iterable[bytes]) -> AsyncIterator[bytes]:
    for chunk in chunks:
        yield chunk
