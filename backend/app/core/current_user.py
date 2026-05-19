from sqlalchemy.orm import Session


CURRENT_USER_ID_KEY = "current_user_id"
CURRENT_USER_EMAIL_KEY = "current_user_email"


def set_current_user(db: Session, user_id: int, email: str | None = None) -> None:
    db.info[CURRENT_USER_ID_KEY] = user_id
    db.info[CURRENT_USER_EMAIL_KEY] = email


def clear_current_user(db: Session) -> None:
    db.info.pop(CURRENT_USER_ID_KEY, None)
    db.info.pop(CURRENT_USER_EMAIL_KEY, None)


def get_current_user_id(db: Session) -> int:
    user_id = db.info.get(CURRENT_USER_ID_KEY)
    if user_id is None:
        raise RuntimeError("Current user is not set in request context.")
    return int(user_id)


def get_current_user_email(db: Session) -> str | None:
    email = db.info.get(CURRENT_USER_EMAIL_KEY)
    return None if email is None else str(email)
