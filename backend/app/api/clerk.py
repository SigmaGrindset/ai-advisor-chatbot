"""Accounts: which Clerk user a session token was issued to, checked offline.

Clerk signs a short-lived token for whoever is signed in, and the browser sends
it as a bearer token on every request. It is checked here with no call to
Clerk, against the instance's public key held in settings: the signature, the
minute or so it is good for, and that it was issued to one of our own
frontends rather than to another site signing in through the same instance.
"""

from collections.abc import Collection

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import Request

from ..config import Settings

#: How far Clerk's clock and ours may disagree, as Clerk's own SDKs allow.
_CLOCK_SKEW_SECONDS = 5


class ClerkVerifier:
    """Checks a Clerk session token, and says which Clerk user it was issued to."""

    def __init__(self, public_key: str, authorized_parties: Collection[str]) -> None:
        # Loaded once, so a malformed key stops the application at startup
        # rather than refusing every sign-in one request at a time.
        key = load_pem_public_key(public_key.encode())
        if not isinstance(key, RSAPublicKey):
            raise ValueError("CLERK_PUBLIC_KEY is not an RSA public key")
        self._key = key
        self._authorized_parties = frozenset(authorized_parties)

    def user_of(self, token: str) -> str | None:
        """The Clerk user this token was issued to, or None if it proves nothing:
        forged, expired, not yet valid, or issued to a frontend that is not ours."""
        try:
            claims = jwt.decode(
                token,
                self._key,
                algorithms=["RS256"],
                leeway=_CLOCK_SKEW_SECONDS,
                options={"require": ["exp", "nbf", "sub", "azp"]},
            )
        except jwt.InvalidTokenError:
            return None
        if claims["azp"] not in self._authorized_parties:
            return None
        user: object = claims["sub"]
        return user if isinstance(user, str) and user else None


def clerk_verifier_for(settings: Settings) -> ClerkVerifier | None:
    """What reads sign-ins, if Clerk is configured. None serves Guests only."""
    if not (settings.clerk_public_key and settings.clerk_secret_key):
        return None
    return ClerkVerifier(settings.clerk_public_key, settings.frontend_origins)


def get_clerk_verifier(request: Request) -> ClerkVerifier | None:
    """What reads sign-ins in the running application, for use as a FastAPI dependency."""
    verifier: ClerkVerifier | None = request.app.state.clerk_verifier
    return verifier
