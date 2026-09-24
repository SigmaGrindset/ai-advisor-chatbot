"""Clerk, as far as a test needs it: a key standing in for the instance's, and
the session tokens it would sign.

The public half goes into the test settings, so a token signed here is checked
by the application's own verification, not waved through by a stub.
"""

from datetime import UTC, datetime, timedelta

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

#: The frontend the test settings accept sign-ins from.
FRONTEND = "https://advisor.example"


def signing_key() -> rsa.RSAPrivateKey:
    """A key of the kind Clerk signs session tokens with."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def public_pem(key: rsa.RSAPrivateKey) -> str:
    """Its public half, as the Clerk dashboard shows it for `CLERK_PUBLIC_KEY`."""
    return key.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo).decode()


def session_token(
    key: rsa.RSAPrivateKey,
    clerk_user: str,
    *,
    party: str = FRONTEND,
    issued: datetime | None = None,
    lifetime: timedelta = timedelta(minutes=10),
) -> str:
    """What Clerk would hand the browser of `clerk_user`, signed in on `party`.

    Longer-lived than Clerk's minute, so no test outlives its own sign-in.
    """
    at = issued or datetime.now(UTC)
    claims = {"sub": clerk_user, "azp": party, "iat": at, "nbf": at, "exp": at + lifetime}
    return jwt.encode(claims, key, algorithm="RS256")
