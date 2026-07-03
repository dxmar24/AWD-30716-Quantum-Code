from datetime import datetime, timezone
import hashlib

from fastapi import Depends, HTTPException, Request, status
import jwt

from .config import Settings, get_settings
from .database import Database, get_database
from .repositories import SessionRepository


def _bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    database: Database = Depends(get_database),
):
    if not settings.auth_required:
        return {"id": "anonymous", "email": "anonymous@local", "name": "Anonymous", "role": "Admin"}

    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        jwt.decode(token, settings.session_secret, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token") from error

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with database.connect() as connection:
        user = SessionRepository(connection).get_user_for_token_hash(token_hash)

    if not user or user["revoked"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    expires_at = user["expires_at"]
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    return {
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }
