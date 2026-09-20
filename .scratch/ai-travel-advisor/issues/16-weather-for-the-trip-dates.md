# 16: Weather for the dates of the trip

**What to build:** The advisor can answer what the weather will be like on the dates
someone is actually travelling, not just what it is doing outside right now. Near enough
and that is a forecast; far enough out and no forecast exists, so it is what those dates
have really been like — said plainly as that, never dressed up as a prediction.

**Blocked by:** 07.

**Status:** ready-for-human

- [x] A `weather_outlook` Live-data Tool takes coordinates and a start and end date, with
      no free-text argument — the place is a label for the status line, as in ticket 07
- [x] Dates within the forecast horizon are answered from Open-Meteo's forecast, day by
      day, with highs, lows, rain and wind
- [x] Dates beyond it are answered from the last ten years of the same calendar days,
      as an average, a range and a count of the days it rained
- [x] The result says which of the two it is, and the Advisor Instructions tell the
      advisor to pass that on rather than flatten a ten-year average into a claim about a
      day
- [x] A stretch that starts inside the horizon and runs past it is forecast as far as the
      forecast goes, and says where it stopped
- [x] Dates already gone by are refused before anything leaves the machine
- [x] A stretch that runs over new year is measured against the ten winters before it, not
      ten stretches of the wrong months
- [x] The advisor is told today's date, so a relative date becomes the right year
- [x] Citations name which source answered, and the archive one is distinguishable from
      the forecast one
- [x] A test drives a whole turn down each branch through real dispatch; the far-dates
      test proves the days of other months in the same response are filtered out rather
      than averaged in

## Comments

**The Climate API was the road not taken.** It covers 1950–2050 and would have answered
about the actual future dates in one request, which is the tidier-looking design. Its daily
values for a future date are one realisation of a climate model rather than a prediction of
that day, and there is no honest sentence to put them in. Asked for 10–20 June 2027 in
Lisbon it gave a 23.5°C mean high, where the ten observed years give 25.1°C and 2025 alone
was 27.6°C — three numbers for one question, which is the whole trouble with answering it
from a single run of anything.

**The far-dates request is deliberately wasteful.** Ten years of the same calendar window is
not a contiguous range, so the request asks for ten whole years and the reader throws away
the days that are not the trip's — about a hundred kilobytes and half a second. The
alternative was ten requests, which would have meant ten ways for one lookup to half-fail
inside the retry and timeout machinery ticket 07 built for a single `Errand`.

**Two tools rather than one with an optional date.** `current_weather` answers with a
reading taken; this answers with a forecast made or a decade averaged. One tool returning
any of the three would be one whose answer the advisor could repeat without knowing which it
had, which is the exact failure the whole design is trying to avoid.

**Nothing verifies the browser end automatically,** as in ticket 07: the status line for
both branches was read from the SSE events in the turn tests rather than from a rendered
page.

**Ready for human rather than done:** the advisor's wording when it gets a ten-year answer
is a judgement call that wants reading against a few real turns, not just the canned ones.
The instruction telling it to pass on the range and the rain-day count rather than the
average alone is the part most likely to need another pass.
