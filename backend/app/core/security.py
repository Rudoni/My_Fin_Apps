import secrets

from fastapi import Header, HTTPException, status

from app.core.config import API_KEY


def validate_api_key(x_api_key: str | None) -> bool:
    if not API_KEY:
        return True

    if x_api_key and secrets.compare_digest(x_api_key, API_KEY):
        return True

    return False


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if validate_api_key(x_api_key):
        return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
