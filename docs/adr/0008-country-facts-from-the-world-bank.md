# Country facts come from the World Bank, not REST Countries

ADR-0003 named REST Countries as the third keyless Live-data Tool. While ticket 07 was
being built it stopped being keyless: every `restcountries.com/v3.1/*` path now answers
`301` to a static file saying the version is deprecated, and the replacement at
`api.restcountries.com/v5/*` answers `401 authKeyMissing`. The v5 documentation is a
product with a "Get an API key" button on it.

That collides with ADR-0003's binding constraint — the evaluating machine holds exactly
one credential, the OpenRouter key, so no source may require a second signup. The country
tool therefore calls `api.worldbank.org/v2/country/{code}?format=json`, which is keyless,
unmetered, and run by an institution that is not going to put it behind a paywall.

## Considered Options

- **REST Countries v5 with a key.** Rejected on ADR-0003's constraint: a second signup for
  the one fact set that matters least of the three.
- **The dataset behind REST Countries, served from a CDN** (`mledoze/countries` on
  jsDelivr). It carries currencies, languages and time zones, which is the richer answer —
  but the repository publishes one 3 MB file rather than a file per country, so a lookup
  would mean fetching the world to read one row. It is also a file rather than a service,
  which is a different kind of dependency from the other two tools.
- **Nager.Date's `CountryInfo`, and FIRST.org's country list.** Both keyless and both
  thinner than the World Bank's answer.

## Consequences

The tool answers with the country's official name, capital city, world region, the World
Bank's income classification and rough coordinates. It no longer answers with currency,
languages or time zones — those were the interesting part of the REST Countries answer,
and the loss is real.

Currency codes and languages are stable knowledge rather than live data, so the advisor
answers them from its own knowledge as the Advisor Instructions already permit for things
that do not change quickly; the *rate* between two currencies stays a tool call. The
coordinates turn out to earn their place: they are what the advisor hands to the weather
tool, which takes a latitude and a longitude and has no search of its own.
