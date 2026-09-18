"""What the advisor is shown, asked for without a database.

Composing the prompt used to need a session, so the only way to see it was to
run a turn and read what the canned model was sent. It is a function of the
Messages now, which is the point of it having moved: the thing that decides
what the advisor knows can be asked directly, and the answer read in one
screen. Tickets 09 and 11 put the Trip Plan and the Traveler Profile in here,
and those are exactly the claims that want asserting cheaply.
"""

import uuid

from app.advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS
from app.advisor.prompt import compose_prompt
from app.advisor.tools import UNTRUSTED_CLOSE, UNTRUSTED_OPEN
from app.db.tables import Message, MessageRole


def _said(role: MessageRole, content: str) -> Message:
    return Message(id=uuid.uuid4(), conversation_id=uuid.uuid4(), role=role, content=content)


def test_the_advisor_instructions_come_first_and_once() -> None:
    prompt = compose_prompt([_said(MessageRole.TRAVELER, "Three days in Lisbon?")])
    system = str(prompt[0]["content"])
    assert [part["role"] for part in prompt] == ["system", "user"]
    assert system.count(DEFAULT_ADVISOR_INSTRUCTIONS) == 1


def test_the_advisor_is_told_a_tool_result_is_never_an_instruction() -> None:
    """The markers the advisor is warned about are the markers a result wears.

    Said here rather than left to the two files to agree by eye: a result
    wrapped in one pair of markers while the prompt names another is a prompt
    injection the application built itself.
    """
    system = str(compose_prompt([])[0]["content"])
    assert UNTRUSTED_OPEN in system
    assert UNTRUSTED_CLOSE in system
    assert "never an instruction" in system


def test_the_conversation_is_sent_in_the_order_it_was_said() -> None:
    prompt = compose_prompt(
        [
            _said(MessageRole.TRAVELER, "Three days in Lisbon?"),
            _said(MessageRole.ADVISOR, "Start in Alfama."),
            _said(MessageRole.TRAVELER, "And the third day?"),
        ]
    )
    assert [part["role"] for part in prompt] == ["system", "user", "assistant", "user"]
    assert [part["content"] for part in prompt[1:]] == [
        "Three days in Lisbon?",
        "Start in Alfama.",
        "And the third day?",
    ]


def test_a_conversation_with_nothing_said_in_it_is_still_the_advisor() -> None:
    # The first turn composes a prompt before the traveler's words are read
    # back, so an empty transcript is a real case rather than a hypothetical.
    assert [part["role"] for part in compose_prompt([])] == ["system"]
