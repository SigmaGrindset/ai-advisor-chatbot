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
    ChatCompletionToolParam,
)
from openai.types.chat.chat_completion_chunk import ChoiceDeltaToolCall
from openai.types.completion_usage import CompletionUsage

from . import planning, remembering
from .tools import Citation, LiveDataTools, no_such_tool

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
class Patched:
    """The Trip Plan has just changed, and this is what moved.

    Reported the moment it happens rather than at the end of the turn, because
    the plan taking shape *while* the traveler talks is the whole of what the
    pane beside the conversation is for (ADR-0006).
    """

    #: The parts that changed, named the way the interface names them.
    changed: Sequence[str]


@dataclass(frozen=True, slots=True)
class Remembered:
    """The Traveler Profile has just changed.

    Bare, where `Patched` names what moved: the profile is a short list the
    traveler reads whole, so there is nothing to point at within it — and
    colour in this application says four things, none of which is this
    (ADR-0004 asks that the profile be visible, not that it be highlighted).
    """


@dataclass(frozen=True, slots=True)
class TurnComplete:
    """The end of a turn: the whole reply, what it cost, and what backs it."""

    content: str
    cost_usd: Decimal | None
    citations: Sequence[Citation] = ()


TurnEvent = ReplyFragment | Consulting | Consulted | Patched | Remembered | TurnComplete


async def run_turn(
    model: AsyncOpenAI,
    *,
    model_name: str,
    prompt: Sequence[ChatCompletionMessageParam],
    tools: LiveDataTools,
    plan: planning.Plan,
    profile: remembering.Profile,
) -> AsyncIterator[TurnEvent]:
    """Drive one turn to completion, yielding the reply as the model writes it."""
    said: list[ChatCompletionMessageParam] = list(prompt)
    reply: list[str] = []
    citations: list[Citation] = []
    cost = _Spend()
    # Whether anything from outside this application has entered the turn yet.
    # It is what decides whether the plan tools are on the table — see
    # `_offered` — so it is read at the top of every step and never unset.
    fetched = False

    for _ in range(MAX_STEPS):
        asked = _ToolCalls()
        spoken: list[str] = []
        stream = await model.chat.completions.create(
            model=model_name,
            messages=said,
            stream=True,
            tools=_offered(tools, writing=not fetched),
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
        writing = not fetched
        looked_up = False
        for call in wanted:
            # Catalogues dispatched apart rather than through one table. One of
            # them fetches and never writes; the other two write and never
            # fetch, and the branch is where that stops being a claim about the
            # tools and becomes a fact about the loop (ADR-0004).
            #
            # `writing` is read here as well as at the top of the step, so a
            # tool that has left the table falls past these branches rather
            # than quietly running.
            if writing and planning.offers(call.name):
                patched = await planning.change(plan, call.name, call.arguments)
                if patched.revised:
                    yield Patched(patched.fields)
                told = patched.told
            elif writing and remembering.offers(call.name):
                learned = await remembering.change(profile, call.name, call.arguments)
                if learned.revised:
                    yield Remembered()
                told = learned.told
            elif tools.offers(call.name):
                # Read before it is run, so the traveler learns what is being
                # fetched while it is being fetched rather than afterwards.
                lookup = tools.read(call.name, call.arguments)
                looked_up = True
                yield Consulting(lookup.activity)
                answer = await tools.run(lookup)
                citations.extend(answer.citations)
                # A lookup somebody charged for — the nested search — is part
                # of what this turn cost, and goes on the same running total
                # as the steps around it.
                cost.add(answer.usage)
                told = answer.content
            else:
                # A name no catalogue has, or a tool that writes and has left
                # the table for the rest of this turn (ADR-0010). Either way
                # there is nothing to call — and nothing to tell the traveler
                # is happening, which is why this is answered here rather than
                # handed to the Live-data Tools to refuse. Their refusal comes
                # with a status line, and a write that was never made must not
                # put "checking a live source" on somebody's screen.
                told = no_such_tool(call.name)
            said.append(
                ChatCompletionToolMessageParam(
                    role="tool", tool_call_id=call.id, content=told
                )
            )
        # Only where something was actually fetched. A step that only wrote to
        # the plan never said it was consulting anything, and saying it has
        # finished would put the status line down twice.
        if looked_up:
            yield Consulted()
            fetched = True

    yield TurnComplete("".join(reply), cost.total, citations)


def _offered(tools: LiveDataTools, *, writing: bool) -> list[ChatCompletionToolParam]:
    """What the model may call on this step, which is not the same every step.

    The Live-data Tools, always. Everything that writes — the Trip Plan tools
    and the Traveler Profile tools alike — only while nothing fetched has
    entered the turn, which is the rule ADR-0009 hands to whoever builds a
    writing tool and the whole of how ADR-0004's promise is kept once one
    exists.

    A page the advisor read cannot cause a write, then, because by the time
    anything that page said is in front of the model there is no tool on the
    table that writes. It is not a rule applied at the moment of the call and
    it is not something the Advisor Instructions ask for: the capability is
    simply gone, and a model that asks for it anyway is told there is no such
    tool. What follows is that a plan change and a recorded fact alike always
    follow from something the traveler said — a search that changes the
    advisor's mind changes the plan on the next turn, from the same
    conversation, once the traveler has read it too.
    """
    if not writing:
        return list(tools.offered())
    return [*tools.offered(), *planning.offered(), *remembering.offered()]


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
