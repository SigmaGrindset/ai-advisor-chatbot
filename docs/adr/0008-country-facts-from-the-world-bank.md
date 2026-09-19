# Country facts come from the World Bank, not REST Countries

ADR-0003 named REST Countries as the third keyless Live-data Tool. While ticket 07 was
being built it stopped being keyless: every `restcountries.com/v3.1/*` path now answers
`301` to a deprecation notice, and the replacement at `api.restcountries.com/v5/*` answers
`401 authKeyMissing`. That collides with ADR-0003's binding constraint — the evaluating
machine holds exactly one credential, so no source may require a second signup. The
country tool calls `api.worldbank.org/v2/country/{code}?format=json` instead, which is
keyless, unmetered, and run by an institution that is not going to put it behind a
paywall.

## Considered Options

- **REST Countries v5 with a key.** Rejected on ADR-0003's constraint: a second signup for
  the one fact set that matters least of the three.
- **The dataset behind REST Countries, served from a CDN** (`mledoze/countries` on
  jsDelivr). Richer — currencies, languages, time zones — but published as one 3 MB file
  rather than a file per country, so a lookup means fetching the world to read one row. It
  is also a file rather than a service.
- **Nager.Date's `CountryInfo`, and FIRST.org's country list.** Both keyless and both
  thinner than the World Bank's answer.

## Consequences

The tool answers with official name, capital, world region, income classification and
rough coordinates, and no longer with currency, languages or time zones. That loss is
real, but those are stable knowledge rather than live data, so the advisor answers them
from its own as the Advisor Instructions already permit; the *rate* between two currencies
stays a tool call. The coordinates earn their place: they are what the advisor hands to
the weather tool, which takes a latitude and a longitude and has no search of its own.
