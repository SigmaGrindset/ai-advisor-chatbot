"""Running one turn of a Conversation against the model.

The loop is ours rather than a framework's (ADR-0005). It streams a step, reads
what came back, and re-calls until the model stops asking for more — which today
is always after the first step, because no tools are offered yet. Tool
accumulation and dispatch join the loop at the marked point in a later ticket.

Nothing in here knows about HTTP, the database, or the browser: it takes a
prompt and yields the reply as it arrives.
"""

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from decimal import Decimal

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from openai.types.completion_usage import CompletionUsage

#: A turn that has asked for tools this many times is looping rather than working.
MAX_STEPS = 8


@dataclass(frozen=True, slots=True)
class ReplyFragment:
    """A piece of the advisor's reply, as it arrives."""

    text: str


@dataclass(frozen=True, slots=True)
class TurnComplete:
    """The end of a turn: the whole reply, and what it cost."""

    content: str
    cost_usd: Decimal | None


TurnEvent = ReplyFragment | TurnComplete


async def run_turn(
    model: AsyncOpenAI,
    *,
    model_name: str,
    prompt: Sequence[ChatCompletionMessageParam],
) -> AsyncIterator[TurnEvent]:
    """Drive one turn to completion, yielding the reply as the model writes it."""
    reply: list[str] = []
    cost = _Spend()

    for _ in range(MAX_STEPS):
        finish_reason: str | None = None
        stream = await model.chat.completions.create(
            model=model_name,
            messages=list(prompt),
            stream=True,
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
                reply.append(choice.delta.content)
                yield ReplyFragment(choice.delta.content)
            if choice.finish_reason:
                finish_reason = choice.finish_reason

        # Where tool calls are dispatched and their results appended to `prompt`
        # before the next step. Until there are tools, a step is always the last.
        if finish_reason != "tool_calls":
            break

    yield TurnComplete("".join(reply), cost.total)


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
