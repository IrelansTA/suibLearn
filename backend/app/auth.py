"""Authentication utilities — single-password JWT auth."""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer_scheme = HTTPBearer()


def create_token(password: str) -> str:
    """Verify *password* matches the configured AUTH_PASSWORD and return a signed JWT.

    Raises ValueError if the password is wrong.
    """
    if password != settings.AUTH_PASSWORD:
        raise ValueError("Invalid password")

    payload = {
        "sub": "user",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> bool:
    """Return True if *token* is a valid, non-expired JWT."""
    try:
        jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return True
    except jwt.PyJWTError:
        return False


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> str:
    """FastAPI dependency — extracts and validates the Bearer token.

    Returns the static string ``"user"`` on success; raises 401 otherwise.
    """
    if not verify_token(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return "user"
