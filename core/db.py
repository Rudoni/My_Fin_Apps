import os
from decimal import Decimal

import pandas as pd
from sqlalchemy import create_engine, text


DB_URL = os.getenv("MY_FIN_APPS_DB_URL", "postgresql+psycopg2://postgres:admin@localhost/postgres")
engine = create_engine(DB_URL)


def sql_df(query: str, params: dict | None = None) -> pd.DataFrame:
    with engine.connect() as conn:
        result = conn.execute(text(query), params or {})
        rows = result.fetchall()
        cols = result.keys()

    df = pd.DataFrame(rows, columns=cols)
    for col in df.columns:
        if df[col].dtype == "object" and df[col].map(lambda value: isinstance(value, Decimal)).any():
            df[col] = df[col].apply(lambda value: float(value) if isinstance(value, Decimal) else value)
    return df


def table_exists(table_name: str) -> bool:
    query = """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :table_name
        ) AS exists
    """
    df = sql_df(query, {"table_name": table_name})
    return bool(df.iloc[0]["exists"])


def tables_exist(table_names: list[str]) -> bool:
    return all(table_exists(table_name) for table_name in table_names)


def fmt_eur(value: float) -> str:
    return f"{float(value):,.2f} €".replace(",", " ")

