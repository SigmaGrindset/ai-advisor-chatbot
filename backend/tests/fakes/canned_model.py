"""A canned OpenRouter, in the wire format it actually uses.

The stream parsing is real code under test, so what it parses here is the real
thing: SSE chat completion chunks, keep-alive comments, a usage chunk and a
`[DONE]` sentinel.

One provider answers all three kinds of call, because on the wire they go to
one host: a streamed request is the traveler's turn, an unstreamed one
carrying `plugins` is the nested search, and any other is the utility model's.
"""

import json
from collections.abc import AsyncIterator, Iterable, Mapping, Sequence
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


def wants_tools() -> bytes:
    """The chunk that says the model has stopped to wait on the tools it asked for."""
    return event(_chunk({}, finish_reason="tool_calls"))


def calling(name: str, *arguments: str, call_id: str = "call-1", at: int = 0) -> list[bytes]:
    """The chunks in which a model asks for one tool call.

    The arguments arrive in pieces, as a stream delivers them: name and
    identifier once, then bare JSON fragments. `at` is the provider's index,
    which is the only thing those later fragments carry.
    """
    opening, *rest = arguments or ("",)
    return [
        event(
            _chunk(
                {
                    "tool_calls": [
                        {
                            "index": at,
                            "id": call_id,
                            "type": "function",
                            "function": {"name": name, "arguments": opening},
                        }
                    ]
                }
            )
        ),
        *(
            event(_chunk({"tool_calls": [{"index": at, "function": {"arguments": piece}}]}))
            for piece in rest
        ),
    ]


def gives_up(code: int | None = None) -> bytes:
    """The event a provider sends when it stops mid-stream.

    A stream that fails after starting is a 200 still arriving, so the failure
    travels as an event in the body rather than as a status.
    """
    error: dict[str, Any] = {"message": "the upstream provider went away"}
    if code is not None:
        error["code"] = code
    return event({"error": error})


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


def searching(written: str, *pages: tuple[str, str], cost: float | None = None) -> Responder:
    """A searching model, answering the way OpenRouter's web plugin does.

    Pages come back as `url_citation` annotations rather than as text, which is
    why the search is worth nesting: the sources arrive as data instead of
    having to be read back out of a paragraph.
    """

    def answer(request: httpx2.Request) -> httpx2.Response:
        message: dict[str, Any] = {
            "role": "assistant",
            "content": written,
            "annotations": [
                {
                    "type": "url_citation",
                    "url_citation": {
                        "url": url,
                        "title": title,
                        "content": f"...the part of {title} that was read...",
                        "start_index": 0,
                        "end_index": len(written),
                    },
                }
                for title, url in pages
            ],
        }
        answered: dict[str, Any] = {
            "id": "gen-search",
            "object": "chat.completion",
            "created": 1,
            "model": "test/utility-model",
            "choices": [{"index": 0, "message": message, "finish_reason": "stop"}],
        }
        if cost is not None:
            answered["usage"] = _usage(cost)
        return httpx2.Response(200, json=answered)

    return answer


def refusing(status: int) -> Responder:
    """A model that will not answer at all."""

    def answer(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(status, json={"error": {"message": "not today"}})

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
        then: Sequence[Sequence[bytes]] = (),
        split_every: int | None = None,
        utility: Responder | None = None,
        web: Responder | None = None,
    ) -> None:
        self.requests: list[httpx2.Request] = []
        # One body per step of the turn: a turn that calls a tool streams once,
        # waits for the result, and streams again. A step past the last of them
        # gets the last one again, so a model that will not stop asking is a
        # test about MAX_STEPS rather than an IndexError.
        self._bodies = [b"".join((*events, DONE)), *(b"".join((*more, DONE)) for more in then)]
        # How a body arrives on the wire. A real stream is cut wherever the
        # network cuts it, so a test about reassembly asks for pieces that fall in
        # the middle of lines.
        self._split_every = split_every
        self._utility = utility or answering("A canned title")
        self._web = web or searching("Nothing much came back.")
        self._streamed = 0

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        if _is_search(request):
            return self._web(request)
        if not _is_streamed(request):
            return self._utility(request)
        body = self._bodies[min(self._streamed, len(self._bodies) - 1)]
        self._streamed += 1
        headers = {"content-type": "text/event-stream"}
        if self._split_every is None:
            return httpx2.Response(200, content=body, headers=headers)
        pieces = [body[at : at + self._split_every] for at in range(0, len(body), self._split_every)]
        return httpx2.Response(200, content=_yield(pieces), headers=headers)

    @property
    def turns(self) -> list[dict[str, Any]]:
        """The bodies of the streamed calls — the traveler's turns."""
        return [_body(request) for request in self.requests if _is_streamed(request)]

    @property
    def utility_calls(self) -> list[dict[str, Any]]:
        """The bodies of the naming calls — the utility model's unsearched work."""
        return [
            _body(request)
            for request in self.requests
            if not _is_streamed(request) and not _is_search(request)
        ]

    @property
    def searches(self) -> list[dict[str, Any]]:
        """The bodies of the nested web searches — every call with the plugin on."""
        return [_body(request) for request in self.requests if _is_search(request)]

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


def _is_search(request: httpx2.Request) -> bool:
    """Whether this is the nested search, which is to say: whether the plugin is on."""
    return "plugins" in _body(request)


async def _yield(chunks: Iterable[bytes]) -> AsyncIterator[bytes]:
    for chunk in chunks:
        yield chunk
