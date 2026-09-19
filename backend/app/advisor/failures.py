"""Why a turn did not answer, in words that say whose problem it is.

The whole point of this module is the distinction someone running the
application for the first time needs and cannot make from "something went
wrong": a key that was never set is theirs to fix, an exhausted balance is
theirs to top up, a provider having a bad afternoon is nobody's, and a request
the provider would not accept is ours. Every one of those arrives as the same
`APIError`, so the kind is read off the provider's own status or error code
once, here, rather than guessed at by whoever is showing it.

What comes out is carried whole: recorded against the Message the failed turn
left behind, sent to the browser on the event that says the turn failed, and
shown under the question that went unanswered. Nothing downstream re-decides
what kind of failure it was.

Nothing here touches HTTP, the database or the browser. It takes an exception
and answers with two strings.
"""

from dataclasses import dataclass
from enum import StrEnum

from openai import APIError, APIStatusError


class FailureKind(StrEnum):
    """Whose problem a failed turn is.

    Four rather than a free-text reason, because the traveler is shown this as
    a label above the sentence and the reader of a label is deciding what to
    *do* — set something, pay something, wait, or report a bug.
    """

    #: The application is not configured to reach the model: no key, or a key
    #: the provider will not accept.
    CONFIGURATION = "configuration"
    #: The account can no longer pay for a turn.
    CREDIT = "credit"
    #: The provider could not be reached, or would not answer this time.
    UPSTREAM = "upstream"
    #: This application asked for something it should not have, or fell over
    #: while answering. A bug, and said to be one.
    APPLICATION = "application"


@dataclass(frozen=True, slots=True)
class Failure:
    """A failed turn, as the traveler is told about it."""

    kind: FailureKind
    #: One or two sentences, addressed to whoever is reading the screen, saying
    #: what happened and what would change it.
    detail: str

    def recorded(self) -> dict[str, str]:
        """The failure as it is stored against a Message, and as the API reads it."""
        return {"kind": self.kind.value, "detail": self.detail}


#: No key at all. Raised before anything is recorded, because a turn that never
#: reached the model is not a turn the traveler has to retry — their question is
#: still in the composer.
NO_KEY = Failure(
    FailureKind.CONFIGURATION,
    "No OpenRouter key is configured. Set OPENROUTER_API_KEY and start the "
    "application again.",
)

#: Something in the application itself gave way. Named as a bug on purpose: the
#: reader has just been told three times over that a failure might be their
#: configuration, and this is the case where it is not.
UNEXPECTED = Failure(
    FailureKind.APPLICATION,
    "The application failed while answering. This is a fault here rather than "
    "in your configuration — the server log says where.",
)


def of(failure: APIError) -> Failure:
    """What to tell the traveler about a model call that did not answer."""
    status = _status(failure)
    if status in (401, 403):
        return Failure(
            FailureKind.CONFIGURATION,
            "OpenRouter would not accept the key. Check that OPENROUTER_API_KEY is "
            "a current key with access to the configured models.",
        )
    if status == 402:
        return Failure(
            FailureKind.CREDIT,
            "The OpenRouter account is out of credit. Nothing here is broken: add "
            "credit to the account and ask again.",
        )
    if status == 429:
        return Failure(
            FailureKind.UPSTREAM,
            "OpenRouter is rate-limiting this key. Wait a moment and ask again.",
        )
    if status is not None and status >= 500:
        return Failure(
            FailureKind.UPSTREAM,
            f"OpenRouter answered {status}. The model provider is having trouble; "
            "ask again in a moment.",
        )
    if status is not None:
        # Anything else the provider refused outright, it refused because of
        # what it was sent — which this application composed.
        return Failure(
            FailureKind.APPLICATION,
            f"OpenRouter would not accept the request ({status}). That is a fault "
            "in this application rather than in your configuration.",
        )
    return Failure(FailureKind.UPSTREAM, "The advisor could not be reached.")


def _status(failure: APIError) -> int | None:
    """The provider's own code for this failure, where it gave one.

    Two places carry it. A call that was refused outright carries the HTTP
    status. A call that was accepted and then failed *while streaming* — the
    turn that dies halfway through an answer — carries the provider's code in
    the error body instead, because by then the response is a 200 that is still
    arriving.
    """
    if isinstance(failure, APIStatusError):
        return failure.status_code
    code = failure.body.get("code") if isinstance(failure.body, dict) else None
    return code if isinstance(code, int) else None
