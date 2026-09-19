# Country facts come from the World Bank, not REST Countries

ADR-0003 named REST Countries as the third keyless Live-data Tool. While ticket 07 was
being built it stopped being keyless: `restcountries.com/v3.1/*` answers `301` to a
deprecation notice, and `api.restcountries.com/v5/*` answers `401 authKeyMissing`. That
collides with ADR-0003's constraint of one credential on the machine, so the country tool
calls `api.worldbank.org/v2/country/{code}?format=json` instead — keyless, unmetered, and
run by an institution that is not going to put it behind a paywall.

It answers with official name, capital, world region, income classification and rough
coordinates, and no longer with currency, languages or time zones; those are stable
knowledge the advisor may answer from its own, while the *rate* between two currencies
stays a tool call. The coordinates earn their place: they are what the advisor hands to
the weather tool, which has no search of its own.
