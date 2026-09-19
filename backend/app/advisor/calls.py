"""Reading a call to one of the tools that write.

The Trip Plan tools and the Traveler Profile tools are deliberately separate
catalogues, dispatched down separate branches of the loop — that is what makes
ADR-0004's promise structural rather than a claim. What is *not* about either
of them is the same work twice: what a tool looks like as the model is offered
it, how a call's arguments are read out of the JSON they arrive as, and what
counts as a short line of text or a whole number. It lives here, so each
collection next door holds only its own vocabulary.

Nothing in here knows what a Trip Plan or a Traveler Profile is, and nothing in
here writes anything. The Live-data Tools do not share it: theirs is a
different shape, because a call that fetches is read into something that can
also be *refused before it is made*, and carries what to tell the traveler
while it runs.
"""

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from openai.types.chat import ChatCompletionToolParam


@dataclass(frozen=True, slots=True)
class Unusable:
    """A call that will not be applied, and what to tell the advisor instead."""

    complaint: str


@dataclass(frozen=True, slots=True)
class Tool[Change]:
    """One way of changing something, as the model is offered it.

    `Change` is whatever the collection this tool belongs to reads a call
    into — a change to the plan, or a change to the profile.
    """

    name: str
    description: str
    #: The JSON Schema for the arguments.
    arguments: Mapping[str, Any]
    read: Callable[[Mapping[str, Any]], Change | Unusable]

    def offered(self) -> ChatCompletionToolParam:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": dict(self.arguments),
            },
        }


def read_call[Change](
    catalogue: Mapping[str, Tool[Change]], name: str, arguments: str
) -> Change | Unusable:
    """What one call is asking for, or why it cannot be read.

    Never raises. A call naming a tool that is not in this catalogue, or
    carrying arguments that are not what the tool takes, becomes something the
    advisor is told about and can correct rather than something that ends the
    turn.
    """
    tool = catalogue.get(name)
    if tool is None:
        return Unusable(f"There is no tool called {name!r}.")
    try:
        given = json.loads(arguments or "{}")
    except json.JSONDecodeError:
        return Unusable(f"The arguments for {name} were not readable.")
    if not isinstance(given, dict):
        return Unusable(f"The arguments for {name} were not a set of named values.")
    return tool.read(given)


def words(value: object, *, longest: int) -> str | None:
    """A short line of text, tidied, or None when what arrived was not one."""
    if not isinstance(value, str):
        return None
    tidied = " ".join(value.split())
    return tidied if 0 < len(tidied) <= longest else None


def whole(value: object, *, least: int, most: int | None = None) -> int | None:
    """A whole number in range, or None. A float that is not whole is not one."""
    if isinstance(value, bool):
        return None
    if isinstance(value, float) and not value.is_integer():
        return None
    if isinstance(value, str):
        try:
            value = int(value.strip())
        except ValueError:
            return None
    if not isinstance(value, (int, float)):
        return None
    counted = int(value)
    if counted < least or (most is not None and counted > most):
        return None
    return counted
