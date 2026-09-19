"""The web search: one nested request, with OpenRouter's web plugin on it.

The search is not a keyless HTTP source like the other three Live-data Tools.
It is a second, cheaper model asked a single question with OpenRouter's `web`
plugin enabled: it searches, reads what it finds, and answers with its sources
annotated onto the reply. The answer and those sources return into the main
loop as a tool result, which is what ADR-0003 chose and why.

**The plugin is enabled here and nowhere else.** On the main conversation
request it would be a flat charge on every message whether or not the web was
wanted, and — worse — it would put whatever the traveler had just said into a
search engine. Nested, it is paid for when the advisor decides it needs the web,
and what is searched for is one bounded query that has already been through the
guard in `privacy/queries.py`.

Nothing about the traveler goes with the query. The searching model is told what
kind of answer to write, and is given the query. It is not given the
Conversation, the Traveler Profile or the Trip Plan, and there is nowhere in
this module they could be added without it being obvious.
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

#: Longer than a keyless lookup's four seconds, because this one is a model call
#: with a search and a read behind it — but still short enough that a traveler
#: is not left watching a status line wondering.
SEARCH_TIMEOUT = 25.0

#: What OpenRouter is asked to turn on. `max_results` is what the plugin is
#: charged by: five pages is enough for sources to disagree with each other,
#: which is the thing worth knowing about an entry rule.
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
    #: What the nested call cost, in OpenRouter's own figures, so the turn that
    #: asked for the search is charged for it too. None when it said nothing
    #: about cost.
    usage: CompletionUsage | None


async def search(model: AsyncOpenAI, *, model_name: str, query: str) -> Searched:
    """Search the web for `query`, and read back what came of it.

    Raises `APIError` when the call disappoints in any way — refused, timed out,
    or answering in a shape that will not parse. The caller turns that into a
    tool result the advisor can explain, rather than a turn that collapses.
    """
    answered = await model.chat.completions.create(
        model=model_name,
        messages=_searching_prompt(query),
        extra_body={
            "plugins": list(WEB_PLUGIN),
            # OpenRouter's own accounting, so the search's charge lands on the
            # turn that asked for it rather than going unrecorded.
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

    A page cited twice is one page: an annotation marks the stretch of the
    answer it stands behind, and a traveler reading the Citations underneath
    wants each place they could go and check exactly once.
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
