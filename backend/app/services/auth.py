from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac, sha256
from hmac import compare_digest
from secrets import token_bytes, token_urlsafe

from sqlalchemy import text
from sqlalchemy.orm import Session


SESSION_DURATION_DAYS = 30
PBKDF2_ITERATIONS = 390000


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt_bytes = salt or token_bytes(16)
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_bytes.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = _hash_password(password, bytes.fromhex(salt_hex))
    return compare_digest(candidate, f"{algorithm}${iterations}${salt_hex}${digest_hex}")


def hash_password(password: str) -> str:
    return _hash_password(password)


def hash_session_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def ensure_auth_tables(db: Session) -> None:
    required_tables = ["app_user", "user_session"]
    rows = db.execute(
        text(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = ANY(:table_names)
            """
        ),
        {"table_names": required_tables},
    ).scalars().all()
    missing_tables = sorted(set(required_tables) - set(rows))
    if missing_tables:
        raise RuntimeError(f"Missing auth tables: {', '.join(missing_tables)}. Run init.sql.")


def get_user_by_email(db: Session, email: str):
    return db.execute(
        text(
            """
            SELECT user_id, email, display_name, password_hash, is_active, created_at
            FROM app_user
            WHERE LOWER(email) = LOWER(:email)
            """
        ),
        {"email": email},
    ).mappings().first()


def get_user_by_id(db: Session, user_id: int):
    return db.execute(
        text(
            """
            SELECT user_id, email, display_name, password_hash, is_active, created_at
            FROM app_user
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().first()


def count_users(db: Session) -> int:
    return int(db.execute(text("SELECT COUNT(*) FROM app_user")).scalar_one())


def claim_legacy_rows_for_user(db: Session, user_id: int) -> None:
    tables_and_columns = [
        ("incomes", "user_id"),
        ("expenses", "user_id"),
        ("budget_allocation", "user_id"),
        ("resale_item", "user_id"),
        ("brocante_category", "user_id"),
        ("brocante_item", "user_id"),
        ("asset_account", "user_id"),
        ("asset", "user_id"),
    ]
    for table_name, column_name in tables_and_columns:
        exists = db.execute(text("SELECT to_regclass(:table_name) IS NOT NULL"), {"table_name": f"public.{table_name}"}).scalar()
        if not exists:
            continue
        db.execute(
            text(f"UPDATE {table_name} SET {column_name} = :user_id WHERE {column_name} IS NULL"),
            {"user_id": user_id},
        )


def create_user(db: Session, email: str, password: str, display_name: str):
    ensure_auth_tables(db)
    existing = get_user_by_email(db, email)
    if existing is not None:
        raise ValueError("Un compte existe deja avec cet email.")

    first_user = count_users(db) == 0
    row = db.execute(
        text(
            """
            INSERT INTO app_user (email, display_name, password_hash, is_active)
            VALUES (:email, :display_name, :password_hash, TRUE)
            RETURNING user_id, email, display_name, created_at
            """
        ),
        {
            "email": email.strip().lower(),
            "display_name": display_name.strip(),
            "password_hash": hash_password(password),
        },
    ).mappings().one()

    if first_user:
        claim_legacy_rows_for_user(db, int(row["user_id"]))

    db.commit()
    return row


def create_session(db: Session, user_id: int):
    token = token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    db.execute(
        text(
            """
            INSERT INTO user_session (user_id, token_hash, expires_at)
            VALUES (:user_id, :token_hash, :expires_at)
            """
        ),
        {"user_id": user_id, "token_hash": hash_session_token(token), "expires_at": expires_at},
    )
    db.commit()
    return token, expires_at


def authenticate_user(db: Session, email: str, password: str):
    ensure_auth_tables(db)
    user = get_user_by_email(db, email)
    if user is None or not user["is_active"]:
        return None
    if not verify_password(password, str(user["password_hash"])):
        return None
    return user


def get_user_from_token(db: Session, token: str):
    ensure_auth_tables(db)
    return db.execute(
        text(
            """
            SELECT u.user_id, u.email, u.display_name, u.password_hash, u.is_active, u.created_at
            FROM user_session s
            JOIN app_user u ON u.user_id = s.user_id
            WHERE s.token_hash = :token_hash
              AND s.expires_at > NOW()
              AND u.is_active = TRUE
            ORDER BY s.user_session_id DESC
            LIMIT 1
            """
        ),
        {"token_hash": hash_session_token(token)},
    ).mappings().first()


def delete_session(db: Session, token: str) -> None:
    ensure_auth_tables(db)
    db.execute(
        text("DELETE FROM user_session WHERE token_hash = :token_hash"),
        {"token_hash": hash_session_token(token)},
    )
    db.commit()
