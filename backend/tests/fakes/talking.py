"""Driving a Conversation through the API the way the browser does."""

import json
from typing import Any

import httpx2


async def start(api: httpx2.AsyncClient) -> str:
    """Begin a Conversation, and answer with the identifier of it."""
    started = await api.post("/api/conversations")
    assert started.status_code == 201
    conversation_id: str = started.json()["id"]
    return conversation_id


async def send(api: httpx2.AsyncClient, conversation: str, said: str) -> list[dict[str, Any]]:
    """Say something to the advisor and read back the stream, event by event."""
    events: list[dict[str, Any]] = []
    async with api.stream(
        "POST", f"/api/conversations/{conversation}/messages", json={"content": said}
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


async def transcript(api: httpx2.AsyncClient, conversation: str) -> list[tuple[str, str]]:
    """What a Conversation holds, as the browser would read it back after a reload."""
    reopened = await api.get(f"/api/conversations/{conversation}")
    assert reopened.status_code == 200
    return [(message["role"], message["content"]) for message in reopened.json()["messages"]]
