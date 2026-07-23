from datetime import datetime, timezone
import hashlib
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
import jwt

from .config import Settings, get_settings
from .database import Database, get_database
from .repositories import SessionRepository


def _bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1]:
        return parts[1]
    return None


def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    database: Database = Depends(get_database),
):
    if not settings.auth_required:
        if settings.environment != "test":
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unsafe authentication configuration")
        return {"id": "anonymous", "email": "anonymous@example.invalid", "name": "Anonymous", "role": "Admin"}

    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        claims = jwt.decode(
            token,
            settings.session_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "sid", "userId"]},
        )
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token") from error

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with database.connect() as connection:
        user = SessionRepository(connection).get_user_for_token_hash(token_hash)

    if not user or user["revoked"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    claim_user_id = str(claims.get("userId", ""))
    if not claim_user_id or claims.get("sub") != claim_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
    try:
        if UUID(str(claims.get("sid", ""))).version != 4:
            raise ValueError("Session id must be a version 4 UUID")
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token") from error
    if claim_user_id != str(user["id"]) or claim_user_id != str(user["session_user_id"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
    if not user["active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    expires_at = user["expires_at"]
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if user["must_change_password"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password change required")

    return {
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }
