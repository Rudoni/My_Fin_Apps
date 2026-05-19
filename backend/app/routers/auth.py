from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.current_user import get_current_user_email, get_current_user_id, set_current_user
from app.core.db import get_db
from app.schemas.auth import AuthSessionRead, LoginPayload, MessageResponse, RegisterPayload, UserRead
from app.services import auth as auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


def require_authenticated_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    user = auth_service.get_user_from_token(db, token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    set_current_user(db, int(user["user_id"]), str(user["email"]))
    return user


@router.post("/register", response_model=AuthSessionRead, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    try:
        user = auth_service.create_user(db, payload.email, payload.password, payload.display_name)
    except ValueError as err:
        raise HTTPException(status_code=409, detail=str(err)) from err
    except RuntimeError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    token, expires_at = auth_service.create_session(db, int(user["user_id"]))
    return {
        "token": token,
        "expires_at": expires_at,
        "user": user,
    }


@router.post("/login", response_model=AuthSessionRead)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    try:
        user = auth_service.authenticate_user(db, payload.email, payload.password)
    except RuntimeError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe invalide.")
    token, expires_at = auth_service.create_session(db, int(user["user_id"]))
    return {
        "token": token,
        "expires_at": expires_at,
        "user": user,
    }


@router.get("/me", response_model=UserRead)
def me(_user=Depends(require_authenticated_user), db: Session = Depends(get_db)):
    try:
        user = auth_service.get_user_by_id(db, get_current_user_id(db))
    except RuntimeError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return user


@router.post("/logout", response_model=MessageResponse)
def logout(
    authorization: str | None = Header(default=None),
    _user=Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    del _user
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() == "bearer" and token:
        try:
            auth_service.delete_session(db, token)
        except RuntimeError as err:
            raise HTTPException(status_code=400, detail=str(err)) from err
    return {"message": f"Session fermee pour {get_current_user_email(db) or 'utilisateur'}."}
