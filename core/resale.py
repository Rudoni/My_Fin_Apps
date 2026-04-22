import pandas as pd

from core.db import sql_df
from core.resale_categories import RESALE_CATEGORIES


def get_resale_items() -> pd.DataFrame:
    df = sql_df("SELECT * FROM resale_item ORDER BY COALESCE(purchase_date, sale_date) DESC NULLS LAST, resale_item_id DESC")
    if df.empty:
        return df

    for col in ["purchase_date", "sale_date", "created_at"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    df["purchase_price"] = df["purchase_price"].fillna(0.0).astype(float)
    if "resale_category" not in df.columns:
        df["resale_category"] = "Autres"
    df["resale_category"] = df["resale_category"].fillna("Autres").astype(str)
    df["resale_category"] = df["resale_category"].where(df["resale_category"].isin(RESALE_CATEGORIES), "Autres")
    df["pair_count"] = df["pair_count"].fillna(1).astype(int).clip(lower=1)
    df["sale_price"] = df["sale_price"].fillna(0.0).astype(float)
    df["expected_price"] = df["expected_price"].fillna(0.0).astype(float)
    df["retail_price"] = df["retail_price"].fillna(0.0).astype(float)

    df["purchase_total"] = df["purchase_price"] * df["pair_count"]
    df["sale_total"] = df["sale_price"] * df["pair_count"]
    df["expected_total"] = df["expected_price"] * df["pair_count"]
    df["benefit"] = df["sale_total"] - df["purchase_total"]
    df["expected_benefit"] = (df["expected_price"] - df["purchase_price"]) * df["pair_count"]
    df["status"] = df.apply(
        lambda row: "Vendu" if row["sale_price"] > 0 else ("Recu" if row["pair_received"] else "En attente"),
        axis=1,
    )
    df["sale_year"] = df["sale_date"].dt.year
    df["sale_month"] = df["sale_date"].dt.to_period("M").dt.to_timestamp()
    df["purchase_year"] = df["purchase_date"].dt.year
    df["purchase_month"] = df["purchase_date"].dt.to_period("M").dt.to_timestamp()

    return df


def get_resale_summary() -> dict:
    df = get_resale_items()
    if df.empty:
        empty = pd.DataFrame()
        return {
            "all": df,
            "sold": df,
            "stock": df,
            "ca_total": 0.0,
            "purchase_count": 0,
            "benefit_total": 0.0,
            "unsold_value": 0.0,
            "ca_by_year": empty,
            "benefit_by_year": empty,
            "benefit_by_month": empty,
            "sales_by_category": empty,
            "stock_by_category": empty,
            "benefit_by_category": empty,
        }

    sold_df = df[df["sale_price"] > 0].copy()
    stock_df = df[df["sale_price"] <= 0].copy()

    ca_by_year = (
        sold_df.groupby("sale_year", as_index=False)["sale_total"]
        .sum()
        .rename(columns={"sale_year": "year", "sale_total": "ca_total"})
        .sort_values("year")
    )
    benefit_by_year = (
        sold_df.groupby("sale_year", as_index=False)["benefit"]
        .sum()
        .rename(columns={"sale_year": "year", "benefit": "benefit_total"})
        .sort_values("year")
    )
    benefit_by_month = (
        sold_df.groupby("sale_month", as_index=False)["benefit"]
        .sum()
        .rename(columns={"sale_month": "month", "benefit": "benefit_total"})
        .sort_values("month")
    )
    sales_by_category = (
        sold_df.groupby("resale_category", as_index=False)["sale_total"]
        .sum()
        .rename(columns={"resale_category": "category", "sale_total": "ca_total"})
        .sort_values("ca_total", ascending=False)
    )
    benefit_by_category = (
        sold_df.groupby("resale_category", as_index=False)["benefit"]
        .sum()
        .rename(columns={"resale_category": "category", "benefit": "benefit_total"})
        .sort_values("benefit_total", ascending=False)
    )
    stock_by_category = (
        stock_df.groupby("resale_category", as_index=False)["expected_total"]
        .sum()
        .rename(columns={"resale_category": "category", "expected_total": "stock_estimated_value"})
        .sort_values("stock_estimated_value", ascending=False)
    )

    return {
        "all": df,
        "sold": sold_df,
        "stock": stock_df,
        "ca_total": float(sold_df["sale_total"].sum()),
        "purchase_count": int(len(df)),
        "benefit_total": float(sold_df["benefit"].sum()),
        "unsold_value": float(stock_df["expected_total"].sum()),
        "ca_by_year": ca_by_year,
        "benefit_by_year": benefit_by_year,
        "benefit_by_month": benefit_by_month,
        "sales_by_category": sales_by_category,
        "stock_by_category": stock_by_category,
        "benefit_by_category": benefit_by_category,
    }
