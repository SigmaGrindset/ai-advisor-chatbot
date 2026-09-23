"""The Traveler Profile: read for the prompt, and written by its tools.

`advisor/remembering.py` reads a tool call into a typed change and knows
nothing about storage; this applies one.

The rule that lives here rather than in a tool description: three of the four
subjects hold a single fact each, so recording one again replaces it. A
correction has to land as one whether or not the model meant it (ADR-0001).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import remembering
from ..advisor.remembering import Fact, Forget, Learned, ProfileChange, Remember
from ..db import traveler as travelers
from ..db.tables import FactSubject, ProfileFact, Traveler


async def read_profile(session: AsyncSession, traveler: Traveler) -> list[Fact]:
    """Everything the advisor knows about the traveler, as one thing to show or send."""
    return [_as_fact(fact) for fact in await travelers.facts_of(session, traveler)]


def _as_fact(fact: ProfileFact) -> Fact:
    return Fact(id=fact.id, ref=fact.ref, subject=fact.subject.value, detail=fact.detail)


class Remembering:
    """The advisor's profile tools, applied to this traveler's profile.

    Nothing to be built around, unlike the plan's, but it exists for the same
    reason: the loop is handed something that can apply a change, and what a
    session is stays on this side of that line.
    """

    def __init__(self, session: AsyncSession, traveler: Traveler) -> None:
        self._session = session
        self._traveler = traveler

    async def change(self, asked: ProfileChange) -> Learned:
        """Apply one change, and answer with what to tell the advisor."""
        if isinstance(asked, Forget):
            return await self._forgotten(asked)
        return await self._remembered(asked)

    async def _remembered(self, asked: Remember) -> Learned:
        said = remembering.LABELS[asked.subject]
        standing = await self._standing(asked)
        if standing is None:
            fact = await travelers.record_fact(
                self._session,
                self._traveler,
                subject=FactSubject(asked.subject),
                detail=asked.detail,
            )
            return Learned(
                told=(
                    f"The profile now says [{fact.ref}] {said}: {asked.detail}. "
                    f"Forget it with forget_profile_fact fact={fact.ref}."
                ),
                revised=True,
            )
        if standing.detail == asked.detail:
            # The same words again is not a change, and the traveler watching
            # the profile must not see one happen.
            return Learned(told=f"The profile already says {said}: {asked.detail}.")
        was = standing.detail
        await travelers.amend_fact(self._session, standing, asked.detail)
        return Learned(
            told=f"[{standing.ref}] {said} is now {asked.detail}, where it said {was}.",
            revised=True,
        )

    async def _standing(self, asked: Remember) -> ProfileFact | None:
        """The fact this one is a correction to, if it is a correction to one.

        For the three single-valued subjects, whatever is recorded under the
        subject. For a note, only one already saying the same thing — which
        stops a sentence accumulating rather than stopping a second note.
        """
        about = await travelers.facts_about(
            self._session, self._traveler, FactSubject(asked.subject)
        )
        if asked.subject in remembering.ONE_EACH:
            return next(iter(about), None)
        return next((fact for fact in about if fact.detail == asked.detail), None)

    async def _forgotten(self, asked: Forget) -> Learned:
        fact = await travelers.fact_by_ref(self._session, self._traveler, asked.fact)
        if fact is None:
            return Learned(
                told=(
                    f"There is no fact [{asked.fact}] on the profile. It may have been "
                    "deleted already, by you or by the traveler."
                )
            )
        said = remembering.LABELS[fact.subject.value]
        detail = fact.detail
        await travelers.forget_fact(self._session, fact)
        return Learned(told=f"[{asked.fact}] {said}: {detail} is off the profile.", revised=True)
