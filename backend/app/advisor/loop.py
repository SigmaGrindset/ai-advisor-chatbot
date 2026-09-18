"""Running one turn of a Conversation against the model.

The loop is ours rather than a framework's (ADR-0005). It streams a step,
accumulates whatever tool calls the model asked for across the chunks they
arrive in, dispatches them, appends what came back, and re-calls until the
model stops asking. `MAX_STEPS` is the guard against a turn that has started
looping rather than working.

Nothing in here knows about HTTP, the database, or the browser: it takes a
prompt and yields the reply as it arrives, plus what it went and fetched on
the way.
"""

from collections.abc import AsyncIterator, Iterable, Sequence
from dataclasses import dataclass, field
from decimal import Decimal

from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCallParam,
    ChatCompletionToolMessageParam,
)
from openai.types.chat.chat_completion_chunk import ChoiceDeltaToolCall
from openai.types.completion_usage import CompletionUsage

from .tools import Citation, LiveDataTools

#: A turn that has asked for tools this many times is looping rather than working.
MAX_STEPS = 8


@dataclass(frozen=True, slots=True)
class ReplyFragment:
    """A piece of the advisor's reply, as it arrives."""

    text: str


@dataclass(frozen=True, slots=True)
class Consulting:
    """A Live-data Tool is running, and this is what it is doing."""

    #: Specific enough to be worth reading — "Checking current weather in Lisbon".
    activity: str


@dataclass(frozen=True, slots=True)
class Consulted:
    """Nothing is being fetched any more, whatever came of it."""


@dataclass(frozen=True, slots=True)
class TurnComplete:
    """The end of a turn: the whole reply, what it cost, and what backs it."""

    content: str
    cost_usd: Decimal | None
    citations: Sequence[Citation] = ()


TurnEvent = ReplyFragment | Consulting | Consulted | TurnComplete


async def run_turn(
    model: AsyncOpenAI,
    *,
    model_name: str,
    prompt: Sequence[ChatCompletionMessageParam],
    tools: LiveDataTools,
) -> AsyncIterator[TurnEvent]:
    """Drive one turn to completion, yielding the reply as the model writes it."""
    said: list[ChatCompletionMessageParam] = list(prompt)
    reply: list[str] = []
    citations: list[Citation] = []
    cost = _Spend()
    offered = tools.offered()

    for _ in range(MAX_STEPS):
        asked = _ToolCalls()
        spoken: list[str] = []
        stream = await model.chat.completions.create(
            model=model_name,
            messages=said,
            stream=True,
            tools=offered,
            # OpenRouter's own accounting, returned on the final chunk. Asking for
            # it here is what makes the turn's cost knowable without polling the
            # provider's account endpoint afterwards.
            extra_body={"usage": {"include": True}},
        )
        async for chunk in stream:
            cost.add(chunk.usage)
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            if choice.delta.content:
                spoken.append(choice.delta.content)
                reply.append(choice.delta.content)
                yield ReplyFragment(choice.delta.content)
            if choice.delta.tool_calls:
                asked.add(choice.delta.tool_calls)

        # A step that asked for nothing is the last one. Read off what actually
        # accumulated rather than off `finish_reason`, which upstream providers
        # do not agree about when a step both writes and asks.
        wanted = asked.settled()
        if not wanted:
            break

        said.append(_asking(spoken, wanted))
        for call in wanted:
            # Read before it is run, so the traveler learns what is being
            # fetched while it is being fetched rather than afterwards.
            plan = tools.read(call.name, call.arguments)
            yield Consulting(plan.activity)
            answer = await tools.run(plan)
            if answer.citation is not None:
                citations.append(answer.citation)
            said.append(
                ChatCompletionToolMessageParam(
                    role="tool", tool_call_id=call.id, content=answer.content
                )
            )
        yield Consulted()

    yield TurnComplete("".join(reply), cost.total, citations)


@dataclass(frozen=True, slots=True)
class _Asked:
    """One tool call, once every piece of it has arrived."""

    id: str
    name: str
    arguments: str


class _ToolCalls:
    """Tool calls as a stream delivers them: a name once, arguments in pieces.

    Kept under the index the provider numbers them with, because that is the
    only thing every fragment carries — the identifier arrives once and the
    argument fragments that follow it are bare. Nothing in here reads the shape
    of that identifier: providers format them differently and it is only ever
    handed back exactly as it came.
    """

    def __init__(self) -> None:
        self._sofar: dict[int, _Accumulating] = {}

    def add(self, deltas: Iterable[ChoiceDeltaToolCall]) -> None:
        for delta in deltas:
            call = self._sofar.setdefault(delta.index, _Accumulating())
            if delta.id:
                call.id = delta.id
            if delta.function is None:
                continue
            if delta.function.name:
                call.name = delta.function.name
            if delta.function.arguments:
                call.arguments.append(delta.function.arguments)

    def settled(self) -> list[_Asked]:
        """Every call that arrived whole, in the order the model asked for them."""
        return [
            _Asked(
                # A provider that sent no identifier still needs the tool result
                # tied back to its call, so the index becomes the name of it.
                id=call.id or f"call_{index}",
                name=call.name,
                arguments="".join(call.arguments),
            )
            for index, call in sorted(self._sofar.items())
            if call.name
        ]


@dataclass(slots=True)
class _Accumulating:
    """One tool call while its pieces are still arriving."""

    id: str = ""
    name: str = ""
    arguments: list[str] = field(default_factory=list)


def _asking(spoken: Sequence[str], wanted: Sequence[_Asked]) -> ChatCompletionAssistantMessageParam:
    """The step in which the model asked, as the next step has to be shown it."""
    return ChatCompletionAssistantMessageParam(
        role="assistant",
        content="".join(spoken),
        tool_calls=[
            ChatCompletionMessageToolCallParam(
                id=call.id,
                type="function",
                function={"name": call.name, "arguments": call.arguments},
            )
            for call in wanted
        ],
    )


class _Spend:
    """What the provider says a turn cost, accumulated across its steps."""

    def __init__(self) -> None:
        self.total: Decimal | None = None

    def add(self, usage: CompletionUsage | None) -> None:
        if usage is None:
            return
        # `cost` is OpenRouter's addition to the OpenAI usage shape, so it arrives
        # as an extra field rather than a declared one.
        reported = (usage.model_extra or {}).get("cost")
        if not isinstance(reported, (int, float)):
            return
        self.total = (self.total or Decimal(0)) + Decimal(str(reported))
