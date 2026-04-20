"""Authentication router — login & token verification."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import create_token, get_current_user
from app.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_in: int  # seconds


class VerifyResponse(BaseModel):
    valid: bool


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Authenticate with the single shared password and receive a JWT."""
    try:
        token = create_token(body.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    return LoginResponse(
        token=token,
        expires_in=settings.JWT_EXPIRE_HOURS * 3600,
    )


@router.get("/verify", response_model=VerifyResponse)
async def verify(_user: str = Depends(get_current_user)):
    """Check whether the current Bearer token is still valid."""
    return VerifyResponse(valid=True)
