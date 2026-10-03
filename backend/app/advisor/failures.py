"""Why a turn did not answer, in words that say whose problem it is.

A key never set is the operator's to fix, an exhausted balance theirs to top
up, a provider having a bad afternoon nobody's, and a request the provider
refused ours. All four arrive as the same `APIError`, so the kind is read off
the provider's status or error code once, here, and carried whole afterwards:
recorded on the Message, sent to the browser, shown under the question.

Nothing here touches HTTP, the database or the browser.
"""

from dataclasses import dataclass
from enum import StrEnum

from openai import APIError, APIStatusError


class FailureKind(StrEnum):
    """Whose problem a failed turn is.

    Four rather than free text, because the reader of the label is deciding
    what to *do* — set something, pay something, wait, or report a bug.
    """

    #: No key, or a key the provider will not accept.
    CONFIGURATION = "configuration"
    #: The account can no longer pay for a turn.
    CREDIT = "credit"
    #: The provider could not be reached, or would not answer this time.
    UPSTREAM = "upstream"
    #: A bug here, and said to be one.
    APPLICATION = "application"


@dataclass(frozen=True, slots=True)
class Failure:
    """A failed turn, as the traveler is told about it."""

    kind: FailureKind
    #: A sentence or two on what happened and what would change it.
    detail: str

    def recorded(self) -> dict[str, str]:
        """The failure as it is stored against a Message, and as the API reads it."""
        return {"kind": self.kind.value, "detail": self.detail}


#: No key at all. Raised before anything is recorded, so the traveler's
#: question is still in the composer rather than in a transcript.
NO_KEY = Failure(
    FailureKind.CONFIGURATION,
    "No OpenRouter key is configured. Set OPENROUTER_API_KEY and start the "
    "application again.",
)

#: Named as a bug on purpose: this is the case where it is not the reader's
#: configuration.
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
        # OpenRouter's answer both to an empty balance and to a key that has
        # reached its own spending limit. Told to the traveler, who cannot top
        # either up, so it says what it is and that the app itself is fine.
        return Failure(
            FailureKind.CREDIT,
            "The OpenRouter credit that pays for the advisor's answers has run out, "
            "so it cannot reply right now. Nothing in the app is broken: your "
            "question is kept, and Ask again will work once the credit is topped up.",
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

    A call refused outright carries the HTTP status. One that was accepted and
    then failed *while streaming* carries the code in the error body instead,
    because by then the response is a 200 that is still arriving.
    """
    if isinstance(failure, APIStatusError):
        return failure.status_code
    code = failure.body.get("code") if isinstance(failure.body, dict) else None
    return code if isinstance(code, int) else None
