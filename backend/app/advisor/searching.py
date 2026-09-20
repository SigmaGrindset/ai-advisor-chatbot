"""The web search: one nested request, with OpenRouter's web plugin on it.

A second, cheaper model asked a single question with the `web` plugin enabled;
its answer and annotated sources return into the main loop as a tool result
(ADR-0003).

**The plugin is enabled here and nowhere else.** On the main request it would
be a flat charge on every message, and would put whatever the traveler just
said into a search engine. Nested, it is paid for when the advisor decides it
needs the web, and what goes out is one bounded query that has already been
through the guard in `privacy/queries.py`.

The searching model is given the query and nothing else — not the
Conversation, the Profile or the Plan.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from urllib.parse import urlsplit

from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from openai.types.chat.chat_completion_message import Annotation
from openai.types.completion_usage import CompletionUsage

#: Longer than a keyless lookup's four seconds — this is a model call with a
#: search and a read behind it — but short enough not to leave anyone waiting.
SEARCH_TIMEOUT = 25.0

#: `max_results` is what the plugin is charged by. Five pages is enough for
#: sources to disagree, which is the thing worth knowing about an entry rule.
WEB_PLUGIN: Sequence[dict[str, object]] = ({"id": "web", "max_results": 5},)

_SEARCHING_INSTRUCTION = """\
You search the web and report what you find. You will be given one question and nothing
else — no conversation, and nothing about who is asking.

Answer it in at most a short paragraph, from what the search returns rather than from your
own knowledge. Where the question is about a rule or a requirement, say which authority
states it and how recent the page you read appears to be. Where what you find is unclear,
partial, or contradicted by another page, say so rather than settling it yourself. If the
search returns nothing that answers the question, say that it did not.
"""


@dataclass(frozen=True, slots=True)
class Page:
    """One page the search found and read."""

    #: The site it is on, as a traveler would recognise it — "gov.uk".
    site: str
    title: str
    url: str


@dataclass(frozen=True, slots=True)
class Searched:
    """What the searching model wrote, and the pages it annotated it with."""

    written: str
    pages: tuple[Page, ...]
    #: What the nested call cost, so the turn that asked is charged for it too.
    usage: CompletionUsage | None


async def search(model: AsyncOpenAI, *, model_name: str, query: str) -> Searched:
    """Search the web for `query`, and read back what came of it.

    Raises `APIError` when the call disappoints. The caller turns that into a
    tool result the advisor can explain, rather than a turn that collapses.
    """
    answered = await model.chat.completions.create(
        model=model_name,
        messages=_searching_prompt(query),
        extra_body={
            "plugins": list(WEB_PLUGIN),
            # So the search's charge lands on the turn that asked for it.
            "usage": {"include": True},
        },
        timeout=SEARCH_TIMEOUT,
    )
    said = answered.choices[0].message if answered.choices else None
    return Searched(
        written=(said.content or "").strip() if said is not None else "",
        pages=_pages(said.annotations if said is not None else None),
        usage=answered.usage,
    )


def _searching_prompt(query: str) -> list[ChatCompletionMessageParam]:
    """The whole of what the searching model is shown. The query, and no more."""
    return [
        ChatCompletionSystemMessageParam(role="system", content=_SEARCHING_INSTRUCTION),
        ChatCompletionUserMessageParam(role="user", content=query),
    ]


def _pages(annotations: Sequence[Annotation] | None) -> tuple[Page, ...]:
    """The pages an answer was annotated with, in the order they were cited.

    A page cited twice is one page: annotations mark stretches of the answer,
    but a traveler wants each place they could go and check exactly once.
    """
    found: dict[str, Page] = {}
    for annotation in annotations or ():
        if annotation.type != "url_citation":
            continue
        cited = annotation.url_citation
        found.setdefault(
            cited.url, Page(site=_site(cited.url), title=cited.title, url=cited.url)
        )
    return tuple(found.values())


def _site(url: str) -> str:
    """The site a page is on, as a traveler would recognise it in a chip."""
    host = urlsplit(url).hostname
    return host.removeprefix("www.") if host else "the web"
