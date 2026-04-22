import datetime

import pandas as pd
from sqlalchemy import text

from core.db import engine, sql_df

try:
    import yfinance as yf
except ImportError:  # pragma: no cover - optional dependency at runtime
    yf = None


def transaction_signed_quantity(transaction_type: str, quantity: float) -> float:
    if transaction_type in {"BUY", "DEPOSIT"}:
        return quantity
    if transaction_type in {"SELL", "WITHDRAWAL"}:
        return -quantity
    return 0.0


def ensure_datetime_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        if col in df.columns and not df.empty:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def get_asset_types() -> pd.DataFrame:
    return sql_df(
        """
        SELECT asset_type_id, code, label, category_group, is_market_quoted, track_latest_price
        FROM asset_type
        ORDER BY label
        """
    )


def get_accounts() -> pd.DataFrame:
    return sql_df(
        """
        SELECT account_id, name_account, account_type, provider, currency
        FROM asset_account
        ORDER BY name_account
        """
    )


def get_assets() -> pd.DataFrame:
    return sql_df(
        """
        SELECT
            a.asset_id,
            a.name_asset,
            a.ticker,
            a.currency,
            a.data_source,
            a.notes,
            a.is_active,
            t.asset_type_id,
            t.label AS asset_type,
            t.category_group,
            t.is_market_quoted,
            t.track_latest_price
        FROM asset a
        JOIN asset_type t ON t.asset_type_id = a.asset_type_id
        ORDER BY a.name_asset
        """
    )


def get_asset_transactions() -> pd.DataFrame:
    df = sql_df(
        """
        SELECT
            tr.transaction_id,
            tr.asset_id,
            tr.account_id,
            tr.transaction_type,
            tr.quantity,
            tr.unit_price,
            tr.total_amount,
            tr.fees,
            tr.transaction_date,
            tr.notes,
            a.name_asset,
            acc.name_account,
            t.label AS asset_type,
            t.category_group
        FROM asset_transaction tr
        JOIN asset a ON a.asset_id = tr.asset_id
        LEFT JOIN asset_account acc ON acc.account_id = tr.account_id
        JOIN asset_type t ON t.asset_type_id = a.asset_type_id
        ORDER BY tr.transaction_date DESC, tr.transaction_id DESC
        """
    )
    return ensure_datetime_columns(df, ["transaction_date"])


def get_asset_valuations() -> pd.DataFrame:
    df = sql_df(
        """
        SELECT
            v.valuation_id,
            v.asset_id,
            v.valuation_date,
            v.unit_price,
            v.total_value,
            v.value_source,
            a.name_asset
        FROM asset_valuation v
        JOIN asset a ON a.asset_id = v.asset_id
        ORDER BY v.valuation_date DESC, v.valuation_id DESC
        """
    )
    return ensure_datetime_columns(df, ["valuation_date"])


def compute_asset_snapshot() -> pd.DataFrame:
    assets = get_assets()
    if assets.empty:
        return pd.DataFrame()

    transactions = get_asset_transactions()
    valuations = get_asset_valuations()

    if transactions.empty:
        qty_df = pd.DataFrame(columns=["asset_id", "quantity_held", "total_cost", "fees_paid", "total_proceeds"])
    else:
        tx = transactions.copy()
        tx["quantity"] = tx["quantity"].fillna(0.0).astype(float)
        tx["fees"] = tx["fees"].fillna(0.0).astype(float)
        tx["total_amount"] = tx["total_amount"].fillna(0.0).astype(float)
        tx["signed_quantity"] = tx.apply(
            lambda row: transaction_signed_quantity(row["transaction_type"], row["quantity"]),
            axis=1,
        )
        tx["buy_cash"] = tx.apply(
            lambda row: row["total_amount"] + row["fees"] if row["transaction_type"] == "BUY" else 0.0,
            axis=1,
        )
        tx["sell_cash"] = tx.apply(
            lambda row: row["total_amount"] - row["fees"] if row["transaction_type"] == "SELL" else 0.0,
            axis=1,
        )
        qty_df = (
            tx.groupby("asset_id", as_index=False)
            .agg(
                quantity_held=("signed_quantity", "sum"),
                total_cost=("buy_cash", "sum"),
                fees_paid=("fees", "sum"),
                total_proceeds=("sell_cash", "sum"),
            )
        )

    if valuations.empty:
        latest_val = pd.DataFrame(columns=["asset_id", "valuation_date", "unit_price", "total_value", "value_source"])
    else:
        latest_val = (
            valuations.sort_values(["asset_id", "valuation_date", "valuation_id"])
            .groupby("asset_id", as_index=False)
            .tail(1)[["asset_id", "valuation_date", "unit_price", "total_value", "value_source"]]
        )

    if transactions.empty:
        last_buy = pd.DataFrame(columns=["asset_id", "unit_price"])
    else:
        last_buy = (
            transactions[transactions["transaction_type"] == "BUY"]
            .sort_values(["asset_id", "transaction_date", "transaction_id"])
            .groupby("asset_id", as_index=False)
            .tail(1)[["asset_id", "unit_price"]]
            .rename(columns={"unit_price": "last_buy_price"})
        )

    snapshot = assets.merge(qty_df, how="left", on="asset_id")
    snapshot = snapshot.merge(latest_val, how="left", on="asset_id")
    snapshot = snapshot.merge(last_buy, how="left", on="asset_id")

    for column, default_value in {
        "quantity_held": 0.0,
        "total_cost": 0.0,
        "fees_paid": 0.0,
        "total_proceeds": 0.0,
        "unit_price": 0.0,
        "total_value": 0.0,
        "last_buy_price": 0.0,
        "valuation_date": pd.NaT,
    }.items():
        if column not in snapshot.columns:
            snapshot[column] = default_value

    for column in ["quantity_held", "total_cost", "fees_paid", "total_proceeds", "unit_price", "total_value", "last_buy_price"]:
        if column in snapshot.columns:
            snapshot[column] = snapshot[column].fillna(0.0)

    snapshot["quantity_held"] = snapshot["quantity_held"].astype(float)
    snapshot["effective_unit_price"] = snapshot["unit_price"].where(snapshot["unit_price"] > 0, snapshot["last_buy_price"])
    snapshot["market_value"] = snapshot.apply(
        lambda row: row["total_value"] if row["total_value"] > 0 else row["quantity_held"] * row["effective_unit_price"],
        axis=1,
    )
    snapshot["invested_net"] = snapshot["total_cost"] - snapshot["total_proceeds"]
    snapshot["unrealized_pnl"] = snapshot["market_value"] - snapshot["invested_net"]
    snapshot["valuation_date"] = pd.to_datetime(snapshot["valuation_date"], errors="coerce")

    return snapshot.sort_values(["category_group", "asset_type", "name_asset"])


def fetch_latest_price(ticker: str) -> tuple[float | None, str]:
    if yf is None:
        return None, "Le package yfinance n'est pas installe."
    if not ticker:
        return None, "Ticker manquant."

    try:
        history = yf.Ticker(ticker).history(period="5d", interval="1d")
    except Exception as exc:  # pragma: no cover - runtime network/API case
        return None, f"Echec de recuperation: {exc}"

    if history.empty or "Close" not in history.columns:
        return None, "Aucune donnee de marche disponible."

    close_series = history["Close"].dropna()
    if close_series.empty:
        return None, "Le flux de prix ne contient pas de cloture exploitable."

    return float(close_series.iloc[-1]), "OK"


def refresh_market_prices() -> tuple[int, list[str]]:
    assets = get_assets()
    quoted_assets = assets[(assets["track_latest_price"]) & (assets["ticker"].notna())]
    if quoted_assets.empty:
        return 0, ["Aucun actif cote configure pour la mise a jour automatique."]

    updated = 0
    messages: list[str] = []
    today = datetime.date.today()

    with engine.begin() as conn:
        for _, asset in quoted_assets.iterrows():
            price, message = fetch_latest_price(str(asset["ticker"]).strip())
            if price is None:
                messages.append(f"{asset['name_asset']}: {message}")
                continue

            conn.execute(
                text(
                    """
                    INSERT INTO asset_valuation (asset_id, valuation_date, unit_price, total_value, value_source)
                    VALUES (:asset_id, :valuation_date, :unit_price, NULL, :value_source)
                    ON CONFLICT (asset_id, valuation_date, value_source)
                    DO UPDATE SET unit_price = EXCLUDED.unit_price
                    """
                ),
                {
                    "asset_id": int(asset["asset_id"]),
                    "valuation_date": today,
                    "unit_price": price,
                    "value_source": "yfinance",
                },
            )
            updated += 1
            messages.append(f"{asset['name_asset']}: {price:.2f} {asset['currency']}")

    return updated, messages
