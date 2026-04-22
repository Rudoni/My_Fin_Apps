import pandas as pd
import streamlit as st

from core.assets import compute_asset_snapshot, get_asset_transactions
from core.db import fmt_eur, table_exists, sql_df
from core.resale import get_resale_summary


def render():
    st.title("🏠 Dashboard")
    st.caption("Vue d'ensemble revenus, depenses, investissements, achat-revente et patrimoine.")

    df_income = sql_df("SELECT amount, income_date FROM incomes") if table_exists("incomes") else pd.DataFrame()
    df_expense = sql_df("SELECT price, expense_date FROM expenses") if table_exists("expenses") else pd.DataFrame()
    snapshot = compute_asset_snapshot() if all(table_exists(table) for table in ["asset", "asset_transaction", "asset_valuation", "asset_type"]) else pd.DataFrame()
    resale_summary = get_resale_summary() if table_exists("resale_item") else None
    df_tx = get_asset_transactions() if all(table_exists(table) for table in ["asset_transaction", "asset", "asset_type"]) else pd.DataFrame()

    current_year = pd.Timestamp.today().year
    current_month = pd.Timestamp.today().to_period("M").to_timestamp()

    revenus_annee = 0.0
    depenses_annee = 0.0
    revenus_mois = 0.0
    depenses_mois = 0.0

    if not df_income.empty:
        df_income["income_date"] = pd.to_datetime(df_income["income_date"])
        revenus_annee = float(df_income[df_income["income_date"].dt.year == current_year]["amount"].sum())
        revenus_mois = float(df_income[df_income["income_date"].dt.to_period("M").dt.to_timestamp() == current_month]["amount"].sum())

    if not df_expense.empty:
        df_expense["expense_date"] = pd.to_datetime(df_expense["expense_date"])
        depenses_annee = float(df_expense[df_expense["expense_date"].dt.year == current_year]["price"].sum())
        depenses_mois = float(df_expense[df_expense["expense_date"].dt.to_period("M").dt.to_timestamp() == current_month]["price"].sum())

    invested_year = 0.0
    if not df_tx.empty:
        df_tx["transaction_date"] = pd.to_datetime(df_tx["transaction_date"])
        df_tx["cash_invested"] = df_tx.apply(
            lambda row: (row["total_amount"] + row["fees"]) if row["transaction_type"] == "BUY" else 0.0,
            axis=1,
        )
        invested_year = float(df_tx[df_tx["transaction_date"].dt.year == current_year]["cash_invested"].sum())

    patrimoine_total_assets = float(snapshot["market_value"].sum()) if not snapshot.empty else 0.0
    capital_investi = float(snapshot["invested_net"].sum()) if not snapshot.empty else 0.0
    pnl_latent = float(snapshot["unrealized_pnl"].sum()) if not snapshot.empty else 0.0

    resale_ca = float(resale_summary["ca_total"]) if resale_summary else 0.0
    resale_benefit = float(resale_summary["benefit_total"]) if resale_summary else 0.0
    resale_unsold = float(resale_summary["unsold_value"]) if resale_summary else 0.0
    patrimoine_total = patrimoine_total_assets + resale_unsold

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Patrimoine total", fmt_eur(patrimoine_total))
    col2.metric("Revenus annee", fmt_eur(revenus_annee))
    col3.metric("Depenses annee", fmt_eur(depenses_annee))
    col4.metric("Investi annee", fmt_eur(invested_year))

    col5, col6, col7, col8 = st.columns(4)
    col5.metric("CA achat-revente", fmt_eur(resale_ca))
    col6.metric("Benefice achat-revente", fmt_eur(resale_benefit))
    col7.metric("Non vendu estime", fmt_eur(resale_unsold))
    col8.metric("P/L latent", fmt_eur(pnl_latent))

    st.markdown("### 📊 Ce mois-ci")
    month_cash_left = revenus_mois - depenses_mois
    month_cols = st.columns(3)
    month_cols[0].metric("Revenus du mois", fmt_eur(revenus_mois))
    month_cols[1].metric("Depenses du mois", fmt_eur(depenses_mois))
    month_cols[2].metric("Cash restant du mois", fmt_eur(month_cash_left))

    if not snapshot.empty:
        st.markdown("### 🧭 Repartition du patrimoine")
        allocation = snapshot.groupby("category_group", as_index=False)["market_value"].sum().sort_values("market_value", ascending=False)
        if resale_unsold > 0:
            allocation = pd.concat(
                [allocation, pd.DataFrame([{"category_group": "resale", "market_value": resale_unsold}])],
                ignore_index=True,
            )
        if not allocation.empty:
            st.bar_chart(allocation.set_index("category_group"))
    elif resale_unsold > 0:
        st.markdown("### 🧭 Repartition du patrimoine")
        st.bar_chart(pd.DataFrame([{"category_group": "resale", "market_value": resale_unsold}]).set_index("category_group"))

    chart_df = pd.DataFrame()
    if not df_income.empty:
        income_month = (
            df_income.assign(month=df_income["income_date"].dt.to_period("M").dt.to_timestamp())
            .groupby("month", as_index=False)["amount"]
            .sum()
            .rename(columns={"amount": "Revenus"})
        )
        chart_df = income_month
    if not df_expense.empty:
        expense_month = (
            df_expense.assign(month=df_expense["expense_date"].dt.to_period("M").dt.to_timestamp())
            .groupby("month", as_index=False)["price"]
            .sum()
            .rename(columns={"price": "Depenses"})
        )
        chart_df = expense_month if chart_df.empty else chart_df.merge(expense_month, how="outer", on="month")
    if resale_summary and not resale_summary["benefit_by_month"].empty:
        resale_month = resale_summary["benefit_by_month"].rename(columns={"benefit_total": "Benefice achat-revente"})
        chart_df = resale_month if chart_df.empty else chart_df.merge(resale_month, how="outer", on="month")

    if not chart_df.empty:
        chart_df = chart_df.sort_values("month").fillna(0.0)
        st.markdown("### 📈 Evolution mensuelle")
        st.line_chart(chart_df.set_index("month"))

    st.markdown("### 📌 Resume global")
    summary_df = pd.DataFrame(
        [
            {"Bloc": "Budget", "Valeur": revenus_annee - depenses_annee},
            {"Bloc": "Capital investi", "Valeur": capital_investi},
            {"Bloc": "Patrimoine", "Valeur": patrimoine_total},
            {"Bloc": "CA achat-revente", "Valeur": resale_ca},
            {"Bloc": "Benefice achat-revente", "Valeur": resale_benefit},
            {"Bloc": "Stock achat-revente estime", "Valeur": resale_unsold},
        ]
    )
    st.dataframe(summary_df, use_container_width=True)
