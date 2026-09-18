"""The Live-data Tools: what the advisor calls when it must not guess.

Three keyless public services — Open-Meteo for current weather, Frankfurter
for exchange rates, and the World Bank for a country's basics. None of them
needs a second credential, which is the constraint the whole choice was made
under (ADR-0003, and ADR-0008 for why the third one is not the one ADR-0003
named).

Every argument is typed and narrow. There is no free-text argument anywhere in
here, which is what makes personal data structurally unable to travel with a
lookup rather than merely unlikely to (ADR-0004). The one string the weather
tool takes is a place *label*: it is shown to the traveler while the lookup
runs, it is refused if it carries a digit, and it is never part of the request.

A call is read before it is made, because knowing what is about to be fetched
is what lets the traveler be told what is happening while it happens. What comes
back is wrapped in delimiters marking it as data rather than as anything anyone
is asking for, and a lookup that fails becomes the result the advisor explains
rather than an exception that collapses the turn.
"""

import json
import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

import httpx2
from openai.types.chat import ChatCompletionToolParam

logger = logging.getLogger(__name__)

#: Short, because a traveler is watching a status line while this runs. Longer
#: than this and the honest answer is that the source did not answer.
LIVE_DATA_TIMEOUT = httpx2.Timeout(4.0, connect=2.0)

#: The call, and one retry. A source that has failed twice in a row inside one
#: turn is not going to answer on a third try worth waiting for.
ATTEMPTS = 2

#: How long a place label may be. A place name is a label, not prose.
MAX_PLACE = 60

#: What a tool result is wrapped in. The Advisor Instructions say that anything
#: between these is data fetched from elsewhere and never an instruction —
#: see `instructions.TOOL_GUIDANCE`.
UNTRUSTED_OPEN = "<<<UNTRUSTED_TOOL_RESULT>>>"
UNTRUSTED_CLOSE = "<<<END_UNTRUSTED_TOOL_RESULT>>>"


@dataclass(frozen=True, slots=True)
class Citation:
    """Where a fetched claim came from, kept with the Message it went into."""

    #: The service's own name, as the traveler would recognise it.
    service: str
    #: What was looked up there, in words.
    about: str
    #: The exact request that produced it, so the traveler can go and look.
    url: str

    def recorded(self) -> dict[str, str]:
        """The Citation as it is stored and as it reaches the browser."""
        return {"service": self.service, "about": self.about, "url": self.url}


@dataclass(frozen=True, slots=True)
class Found:
    """What a service said, read into words, and what to call it in a Citation."""

    content: str
    about: str


@dataclass(frozen=True, slots=True)
class Errand:
    """A Live-data Tool call with its arguments read out of it, ready to run."""

    #: What the traveler is told while it runs — "Checking current weather in Lisbon".
    activity: str
    service: str
    url: str
    params: Mapping[str, str]
    #: How to read the service's answer. Anything it cannot make sense of it
    #: raises, and the lookup fails the same way a timeout does.
    read: Callable[[Any], Found]


@dataclass(frozen=True, slots=True)
class Unusable:
    """A call the application could not make sense of, so it never leaves."""

    activity: str
    complaint: str


@dataclass(frozen=True, slots=True)
class ToolResult:
    """A finished lookup: what the model is shown, and what to cite for it."""

    #: Already wrapped as untrusted data — this is what goes into the prompt.
    content: str
    #: None when the lookup found nothing to stand behind: there is nothing to cite.
    citation: Citation | None


@dataclass(frozen=True, slots=True)
class LiveDataTool:
    """One capability, as the model is offered it and as its call is read."""

    name: str
    description: str
    #: The JSON Schema for the arguments. Narrow on purpose: see the module note.
    arguments: Mapping[str, Any]
    read: Callable[[Mapping[str, Any]], Errand | Unusable]

    def offered(self) -> ChatCompletionToolParam:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": dict(self.arguments),
            },
        }


class LiveDataTools:
    """The Live-data Tools, as one thing the loop can offer and call.

    Takes the application's one outbound HTTP client, like every other outbound
    caller does (ADR-0004), so a test that swaps that client out has the real
    request building and response reading under it.
    """

    def __init__(self, http_client: httpx2.AsyncClient) -> None:
        self._client = http_client

    def offered(self) -> list[ChatCompletionToolParam]:
        """What the model is told it can call."""
        return [tool.offered() for tool in CATALOGUE]

    def read(self, name: str, arguments: str) -> Errand | Unusable:
        """What this call is asking for, before anything is fetched.

        Never raises. A call naming a tool that does not exist, or carrying
        arguments that are not what the tool takes, becomes something the
        advisor is told about rather than something that ends the turn.
        """
        tool = _BY_NAME.get(name)
        if tool is None:
            return _unreadable(f"There is no tool called {name!r}.")
        try:
            given = json.loads(arguments or "{}")
        except json.JSONDecodeError:
            return _unreadable(f"The arguments for {name} were not readable.")
        if not isinstance(given, dict):
            return _unreadable(f"The arguments for {name} were not a set of named values.")
        return tool.read(given)

    async def run(self, plan: Errand | Unusable) -> ToolResult:
        """Make the call, and answer with what to tell the model either way."""
        if isinstance(plan, Unusable):
            return ToolResult(content=_untrusted(plan.complaint), citation=None)

        trouble = "it did not answer"
        for _ in range(ATTEMPTS):
            try:
                response = await self._client.get(
                    plan.url, params=dict(plan.params), timeout=LIVE_DATA_TIMEOUT
                )
                response.raise_for_status()
            except httpx2.HTTPError as failure:
                trouble = _plainly(failure)
                if _settled(failure):
                    break
                continue
            try:
                found = plan.read(response.json())
            except (ValueError, KeyError, IndexError, TypeError):
                trouble = "its answer could not be read"
                break
            return ToolResult(
                content=_untrusted(found.content),
                citation=Citation(service=plan.service, about=found.about, url=str(response.url)),
            )

        # Deliberately not what was being looked up: the log is not a second
        # copy of the conversation.
        logger.warning("A live lookup failed: %s — %s", plan.service, trouble)
        return ToolResult(
            content=_untrusted(f"This lookup failed: {plan.service} was asked and {trouble}."),
            citation=None,
        )


# ---- Current weather, from Open-Meteo ------------------------------------- #


def _read_weather(given: Mapping[str, Any]) -> Errand | Unusable:
    latitude = _degrees(given.get("latitude"), limit=90.0)
    longitude = _degrees(given.get("longitude"), limit=180.0)
    if latitude is None or longitude is None:
        return Unusable(
            activity="Checking current weather",
            complaint="The weather lookup needs a latitude and a longitude as numbers.",
        )
    # The label is for the traveler's eyes only and goes nowhere near the
    # request below. Where there is nothing usable to call the place, the
    # coordinates name it — which is the honest thing to show anyway.
    place = _label(given.get("place")) or f"{latitude:g}, {longitude:g}"
    return Errand(
        activity=f"Checking current weather in {place}",
        service="Open-Meteo",
        url="https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": f"{latitude:g}",
            "longitude": f"{longitude:g}",
            "current": ",".join(_WEATHER_FIELDS),
            "timezone": "auto",
        },
        read=lambda answered: _weather_found(answered, place),
    )


#: What "current weather" means here. Asked for by name so the answer is the
#: same shape every time rather than whatever the service defaults to.
_WEATHER_FIELDS = (
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "weather_code",
)


def _weather_found(answered: Any, place: str) -> Found:
    now = answered["current"]
    units = answered.get("current_units", {})
    described = _WEATHER_CODES.get(now.get("weather_code"), "conditions not described")
    readings = ", ".join(
        f"{label} {now[field]}{units.get(field, '')}"
        for label, field in (
            ("temperature", "temperature_2m"),
            ("feels like", "apparent_temperature"),
            ("humidity", "relative_humidity_2m"),
            ("precipitation", "precipitation"),
            ("wind", "wind_speed_10m"),
        )
        if now.get(field) is not None
    )
    return Found(
        content=(
            f"Current weather in {place} at {now['time']} local time "
            f"({answered.get('timezone', 'local time zone unknown')}): "
            f"{described}; {readings}."
        ),
        about=f"Current weather in {place}",
    )


#: The WMO codes Open-Meteo answers with, in words. Without this the advisor
#: would be handed a number and left to remember what it stands for.
_WEATHER_CODES = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "freezing fog",
    51: "light drizzle",
    53: "drizzle",
    55: "heavy drizzle",
    56: "light freezing drizzle",
    57: "freezing drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    66: "light freezing rain",
    67: "freezing rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    77: "snow grains",
    80: "light rain showers",
    81: "rain showers",
    82: "violent rain showers",
    85: "light snow showers",
    86: "snow showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "thunderstorm with heavy hail",
}


# ---- Exchange rates, from Frankfurter ------------------------------------- #


def _read_exchange_rate(given: Mapping[str, Any]) -> Errand | Unusable:
    base = _alpha_code(given.get("base_currency"), letters=3)
    quote = _alpha_code(given.get("quote_currency"), letters=3)
    if base is None or quote is None:
        return Unusable(
            activity="Checking an exchange rate",
            complaint="An exchange rate needs two three-letter ISO 4217 currency codes.",
        )
    return Errand(
        activity=f"Checking the {base} to {quote} exchange rate",
        service="Frankfurter (European Central Bank)",
        url="https://api.frankfurter.dev/v1/latest",
        params={"base": base, "symbols": quote},
        read=lambda answered: _rate_found(answered, base, quote),
    )


def _rate_found(answered: Any, base: str, quote: str) -> Found:
    rate = answered["rates"][quote]
    published = answered["date"]
    return Found(
        # Said in the result rather than left to the advisor to remember: the
        # figure is the ECB's daily reference rate, and an answer that implies
        # a live market quote is wrong even when the number is right (ADR-0003).
        content=(
            f"1 {base} = {rate} {quote}. This is the European Central Bank's daily "
            f"reference rate, published on {published}. It is not a live market quote, "
            f"and a bank, a card or a bureau will give a different figure."
        ),
        about=f"ECB daily reference rate, {base} to {quote}, published {published}",
    )


# ---- Country facts, from the World Bank --------------------------------- #


def _read_country_facts(given: Mapping[str, Any]) -> Errand | Unusable:
    code = _alpha_code(given.get("country_code"), letters=2)
    if code is None:
        return Unusable(
            activity="Looking up country facts",
            complaint="Country facts need a two-letter ISO 3166-1 country code.",
        )
    return Errand(
        activity=f"Looking up country facts for {code}",
        service="World Bank",
        url=f"https://api.worldbank.org/v2/country/{code}",
        params={"format": "json"},
        read=_country_found,
    )


def _country_found(answered: Any) -> Found:
    # The World Bank answers with a page of results: a header, then the rows.
    facts = answered[1][0]
    name = facts["name"]
    parts = [
        f"{name} ({facts['id']})",
        f"Capital: {facts.get('capitalCity') or 'not recorded'}",
        f"World region: {(facts.get('region') or {}).get('value') or 'not recorded'}",
        (
            "Income level as the World Bank classifies it: "
            f"{(facts.get('incomeLevel') or {}).get('value') or 'not recorded'}"
        ),
        f"Roughly at {facts.get('latitude') or '?'}, {facts.get('longitude') or '?'}",
    ]
    return Found(content=". ".join(parts) + ".", about=f"World Bank country facts for {name}")


# ---- Reading arguments ----------------------------------------------------- #


def _degrees(value: object, *, limit: float) -> float | None:
    """A coordinate, or None when what arrived was not one."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        degrees = float(value)
    except ValueError:
        return None
    return degrees if -limit <= degrees <= limit else None


def _alpha_code(value: object, *, letters: int) -> str | None:
    """A standards-body code, or None. That many letters and nothing else, ever.

    ISO 4217 for a currency, ISO 3166-1 alpha-2 for a country. Both are closed
    alphabets, which is exactly what stops either argument carrying anything a
    traveler said.
    """
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    return code if len(code) == letters and code.isalpha() and code.isascii() else None


def _label(value: object) -> str | None:
    """A place name fit to show, or None when what arrived was not one.

    The one string any of these tools takes, and it goes nowhere: it names the
    lookup in the status line and in the Citation. A label carrying a digit is
    refused outright, so a number the traveler happened to mention cannot end
    up on their screen wearing the name of a place.

    It stays the model's claim about the coordinates rather than a fact —
    nothing here can tell whether those coordinates are Lisbon. That is why the
    Citation carries the request itself, coordinates and all: the traveler can
    check the claim against what was actually asked.
    """
    if not isinstance(value, str):
        return None
    tidied = " ".join(value.split())
    if tidied == "" or len(tidied) > MAX_PLACE or any(letter.isdigit() for letter in tidied):
        return None
    return tidied


def _untrusted(content: str) -> str:
    """A tool result, marked as data rather than as anything anyone is asking for.

    The markers are stripped out of the content first, so a service that
    answers with a closing marker cannot end the envelope early and write in
    the advisor's own voice outside it.
    """
    inside = content.replace(UNTRUSTED_OPEN, "").replace(UNTRUSTED_CLOSE, "")
    return f"{UNTRUSTED_OPEN}\n{inside}\n{UNTRUSTED_CLOSE}"


def _unreadable(complaint: str) -> Unusable:
    """A call that will not be made, and what to tell the advisor instead."""
    return Unusable(activity="Checking a live source", complaint=complaint)


def _settled(failure: httpx2.HTTPError) -> bool:
    """Whether asking again could plausibly answer any differently.

    A timeout, a dropped connection or a service briefly overloaded could. A
    404 for a country code that does not exist will be a 404 again, and asking
    twice only makes the traveler wait twice for the same no.
    """
    if not isinstance(failure, httpx2.HTTPStatusError):
        return False
    refused = failure.response.status_code
    return refused < 500 and refused != 429


def _plainly(failure: httpx2.HTTPError) -> str:
    """What went wrong, in words the advisor can repeat to the traveler."""
    if isinstance(failure, httpx2.TimeoutException):
        return "it did not answer in time"
    if isinstance(failure, httpx2.HTTPStatusError):
        return f"it answered {failure.response.status_code}"
    return "it could not be reached"


CATALOGUE: Sequence[LiveDataTool] = (
    LiveDataTool(
        name="current_weather",
        description=(
            "The weather right now at a point on the earth, from Open-Meteo. Call this "
            "for any question about current or today's conditions; never answer one from "
            "memory. Give the coordinates of the place yourself — there is no search."
        ),
        arguments={
            "type": "object",
            "properties": {
                "latitude": {
                    "type": "number",
                    "minimum": -90,
                    "maximum": 90,
                    "description": "Degrees north of the equator, negative for south.",
                },
                "longitude": {
                    "type": "number",
                    "minimum": -180,
                    "maximum": 180,
                    "description": "Degrees east of Greenwich, negative for west.",
                },
                "place": {
                    "type": "string",
                    "maxLength": MAX_PLACE,
                    # Declared as well as enforced, so what the model is offered
                    # is the same narrow thing `_label` will accept.
                    "pattern": "^[^0-9]+$",
                    "description": (
                        "What to call the place while the traveler waits, such as "
                        "'Lisbon'. Shown on their screen and never sent to the weather "
                        "service. Letters only: it must contain no digits."
                    ),
                },
            },
            "required": ["latitude", "longitude", "place"],
            "additionalProperties": False,
        },
        read=_read_weather,
    ),
    LiveDataTool(
        name="exchange_rate",
        description=(
            "Today's reference rate between two currencies, from the European Central "
            "Bank by way of Frankfurter. Call this for any figure in a currency the "
            "traveler does not hold; never recall a rate from memory."
        ),
        arguments={
            "type": "object",
            "properties": {
                "base_currency": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 3,
                    "pattern": "^[A-Za-z]{3}$",
                    "description": "ISO 4217 code of the currency being converted from, e.g. EUR.",
                },
                "quote_currency": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 3,
                    "pattern": "^[A-Za-z]{3}$",
                    "description": "ISO 4217 code of the currency being converted to, e.g. JPY.",
                },
            },
            "required": ["base_currency", "quote_currency"],
            "additionalProperties": False,
        },
        read=_read_exchange_rate,
    ),
    LiveDataTool(
        name="country_facts",
        description=(
            "A country's basics from the World Bank — its official name, capital city, "
            "world region, income classification and rough coordinates. Call this rather "
            "than recalling which region a country sits in or what its capital is, and "
            "for the coordinates to hand to current_weather. It is not a source for visa "
            "or entry rules."
        ),
        arguments={
            "type": "object",
            "properties": {
                "country_code": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 2,
                    "pattern": "^[A-Za-z]{2}$",
                    "description": "ISO 3166-1 alpha-2 country code, e.g. PT for Portugal.",
                },
            },
            "required": ["country_code"],
            "additionalProperties": False,
        },
        read=_read_country_facts,
    ),
)

_BY_NAME = {tool.name: tool for tool in CATALOGUE}
