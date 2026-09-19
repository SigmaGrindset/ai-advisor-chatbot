"""The Traveler Profile: read for the prompt, and written by the tool that fills it.

The advisor's side lives in `advisor/remembering.py` and knows nothing about
storage: a tool call is read there into a typed change, and this is what knows
how to apply one. What comes back is what the advisor is told, and whether the
profile the traveler is looking at has moved.

The one rule that lives here rather than in the tool's description: three of
the four subjects hold a single fact each, so recording one of them again
replaces what was there. A correction made in conversation has to land as a
correction whether or not the model meant it as one (ADR-0001).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import remembering
from ..advisor.remembering import Fact, Forget, Learned, ProfileChange, Remember
from ..db import traveler
from ..db.tables import FactSubject, ProfileFact


async def read_profile(session: AsyncSession) -> list[Fact]:
    """Everything the advisor knows about the traveler, as one thing to show or send."""
    return [_as_fact(fact) for fact in await traveler.facts_of(session)]


def _as_fact(fact: ProfileFact) -> Fact:
    return Fact(id=fact.id, ref=fact.ref, subject=fact.subject.value, detail=fact.detail)


class Remembering:
    """The advisor's profile tools, applied to the one traveler's profile.

    There is one Traveler and one Traveler Profile, so unlike the plan's there
    is nothing for this to be built around — it exists for the same reason:
    the loop is handed something that can apply a change, and what a session is
    stays on this side of that line.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def change(self, asked: ProfileChange) -> Learned:
        """Apply one change, and answer with what to tell the advisor."""
        if isinstance(asked, Forget):
            return await self._forgotten(asked)
        return await self._remembered(asked)

    async def _remembered(self, asked: Remember) -> Learned:
        said = remembering.LABELS[asked.subject]
        standing = await self._standing(asked)
        if standing is None:
            fact = await traveler.record_fact(
                self._session, subject=FactSubject(asked.subject), detail=asked.detail
            )
            return Learned(
                told=(
                    f"The profile now says [{fact.ref}] {said}: {asked.detail}. "
                    f"Forget it with forget_profile_fact fact={fact.ref}."
                ),
                revised=True,
            )
        if standing.detail == asked.detail:
            # A fact written again with the same words is not a change, and the
            # traveler watching the profile must not see one happen.
            return Learned(told=f"The profile already says {said}: {asked.detail}.")
        was = standing.detail
        await traveler.amend_fact(self._session, standing, asked.detail)
        return Learned(
            told=f"[{standing.ref}] {said} is now {asked.detail}, where it said {was}.",
            revised=True,
        )

    async def _standing(self, asked: Remember) -> ProfileFact | None:
        """The fact this one is a correction to, if it is a correction to one.

        For the three single-valued subjects that is whatever is recorded under
        the subject. For a note it is only a note that already says the same
        thing, which is there to stop the same sentence accumulating rather
        than to stop a second note being kept.
        """
        about = await traveler.facts_about(self._session, FactSubject(asked.subject))
        if asked.subject in remembering.ONE_EACH:
            return next(iter(about), None)
        return next((fact for fact in about if fact.detail == asked.detail), None)

    async def _forgotten(self, asked: Forget) -> Learned:
        fact = await traveler.fact_by_ref(self._session, asked.fact)
        if fact is None:
            return Learned(
                told=(
                    f"There is no fact [{asked.fact}] on the profile. It may have been "
                    "deleted already, by you or by the traveler."
                )
            )
        said = remembering.LABELS[fact.subject.value]
        detail = fact.detail
        await traveler.forget_fact(self._session, fact)
        return Learned(told=f"[{asked.fact}] {said}: {detail} is off the profile.", revised=True)
