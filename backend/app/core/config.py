import os
from pathlib import Path


def load_dotenv() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    candidate_files = [repo_root / ".env", repo_root / "backend" / ".env"]

    for dotenv_path in candidate_files:
        if not dotenv_path.exists():
            continue
        for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def normalize_database_url(db_url: str) -> str:
    if db_url.startswith("postgresql+psycopg2://"):
        return db_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return db_url


def read_database_url() -> str:
    raw_value = os.getenv("MY_FIN_APPS_DB_URL") or os.getenv("DATABASE_URL")
    if not raw_value:
        raise RuntimeError(
            "Missing database URL. Define MY_FIN_APPS_DB_URL or DATABASE_URL in your environment or .env file."
        )
    return normalize_database_url(raw_value)


def read_cors_origins() -> list[str]:
    raw_value = os.getenv("MY_FIN_APPS_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


def read_cors_origin_regex() -> str | None:
    raw_value = os.getenv("MY_FIN_APPS_CORS_ORIGIN_REGEX", "").strip()
    if raw_value:
        return raw_value
    return r"^https://.*\.vercel\.app$"


load_dotenv()

DATABASE_URL = read_database_url()
API_KEY = os.getenv("MY_FIN_APPS_API_KEY") or os.getenv("VITE_API_KEY") or ""
CORS_ORIGINS = read_cors_origins()
CORS_ORIGIN_REGEX = read_cors_origin_regex()
API_TITLE = "My Fin Apps API"
MAX_UPLOAD_SIZE_MB = int(os.getenv("MY_FIN_APPS_MAX_UPLOAD_SIZE_MB", "5"))
