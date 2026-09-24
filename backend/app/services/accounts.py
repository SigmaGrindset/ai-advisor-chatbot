"""Deleting an Account: the Traveler here and the Clerk user they sign in as,
both or neither.

Clerk is asked through the application's one outbound client, like every
other call that leaves it, with the instance's secret key.
"""

import logging

import httpx2
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import traveler as travelers
from ..db.tables import Traveler

logger = logging.getLogger(__name__)

#: Clerk's Backend API.
CLERK_API = "https://api.clerk.com/v1"


class ClerkRefused(Exception):
    """Clerk did not say the user is gone, so nothing was deleted here either."""


async def delete_account(
    session: AsyncSession,
    traveler: Traveler,
    clerk_user: str,
    *,
    http_client: httpx2.AsyncClient,
    secret_key: str,
) -> None:
    """Delete the Traveler, everything they own, and the Clerk user they sign in as.

    Clerk has to answer that the user is gone before the Traveler's deletion
    is committed. A refusal, an error or no answer leaves both where they
    were, which the Traveler can try again from. The other way round, an
    Account with nothing behind it or data nobody can sign in to, they could not.
    """

    async def gone_from_clerk() -> None:
        try:
            response = await http_client.delete(
                f"{CLERK_API}/users/{clerk_user}",
                headers={"Authorization": f"Bearer {secret_key}"},
            )
            # Already gone is gone: Clerk said yes to an earlier attempt whose
            # commit here then failed, and this one finishes it.
            if response.status_code == 404:
                return
            response.raise_for_status()
        except httpx2.HTTPError as failure:
            # Only what kind of failure: the request carries the secret key.
            why = (
                str(failure.response.status_code)
                if isinstance(failure, httpx2.HTTPStatusError)
                else type(failure).__name__
            )
            logger.warning("Clerk did not delete a user: %s", why)
            raise ClerkRefused from failure

    await travelers.forget_account(session, traveler, gone_from_clerk)
