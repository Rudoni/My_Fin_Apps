import pandas as pd
import streamlit as st

from core.assets import get_asset_transactions
from core.db import fmt_eur, sql_df


def render():
    st.title("🧮 Pilotage mensuel")

    df_income = sql_df("SELECT amount, income_date, income_type FROM incomes")
    df_expense = sql_df("SELECT price, expense_date FROM expenses")
    df_tx = get_asset_transactions()

    months = pd.period_range(start="2024-01", end=pd.Timestamp.today().to_period("M"), freq="M")
    pilotage = pd.DataFrame({"month": months.to_timestamp()})

    if not df_income.empty:
        df_income["month"] = pd.to_datetime(df_income["income_date"]).dt.to_period("M").dt.to_timestamp()
        income_month = df_income.groupby("month", as_index=False)["amount"].sum().rename(columns={"amount": "revenus"})
        pilotage = pilotage.merge(income_month, how="left", on="month")
    else:
        pilotage["revenus"] = 0.0

    if not df_expense.empty:
        df_expense["month"] = pd.to_datetime(df_expense["expense_date"]).dt.to_period("M").dt.to_timestamp()
        expense_month = df_expense.groupby("month", as_index=False)["price"].sum().rename(columns={"price": "depenses"})
        pilotage = pilotage.merge(expense_month, how="left", on="month")
    else:
        pilotage["depenses"] = 0.0

    if not df_tx.empty:
        df_tx["month"] = pd.to_datetime(df_tx["transaction_date"]).dt.to_period("M").dt.to_timestamp()
        df_tx["cash_invested"] = df_tx.apply(
            lambda row: (row["total_amount"] + row["fees"]) if row["transaction_type"] == "BUY" else 0.0,
            axis=1,
        )
        df_tx["cash_released"] = df_tx.apply(
            lambda row: (row["total_amount"] - row["fees"]) if row["transaction_type"] == "SELL" else 0.0,
            axis=1,
        )
        invest_month = (
            df_tx.groupby("month", as_index=False)[["cash_invested", "cash_released"]]
            .sum()
            .rename(columns={"cash_invested": "investi", "cash_released": "desinvesti"})
        )
        pilotage = pilotage.merge(invest_month, how="left", on="month")
    else:
        pilotage["investi"] = 0.0
        pilotage["desinvesti"] = 0.0

    for col in ["revenus", "depenses", "investi", "desinvesti"]:
        if col not in pilotage.columns:
            pilotage[col] = 0.0
        pilotage[col] = pilotage[col].fillna(0.0)

    pilotage["epargne_brute"] = pilotage["revenus"] - pilotage["depenses"]
    pilotage["cash_disponible_apres_invest"] = pilotage["revenus"] - pilotage["depenses"] - pilotage["investi"] + pilotage["desinvesti"]
    pilotage["taux_investissement"] = pilotage.apply(
        lambda row: (row["investi"] / row["revenus"] * 100.0) if row["revenus"] > 0 else 0.0,
        axis=1,
    )
    pilotage["taux_depense"] = pilotage.apply(
        lambda row: (row["depenses"] / row["revenus"] * 100.0) if row["revenus"] > 0 else 0.0,
        axis=1,
    )

    non_empty = pilotage[(pilotage[["revenus", "depenses", "investi", "desinvesti"]].sum(axis=1)) > 0]
    if non_empty.empty:
        st.info("Ajoute des revenus, depenses ou investissements pour voir l'allocation mensuelle.")
        return

    latest = non_empty.iloc[-1]
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Revenus du mois", fmt_eur(latest["revenus"]))
    col2.metric("Depenses du mois", fmt_eur(latest["depenses"]))
    col3.metric("Investi ce mois", fmt_eur(latest["investi"]))
    col4.metric("Cash restant", fmt_eur(latest["cash_disponible_apres_invest"]))

    st.markdown("### 📊 Allocation mensuelle")
    chart_df = non_empty.set_index("month")[["revenus", "depenses", "investi", "desinvesti", "cash_disponible_apres_invest"]]
    st.line_chart(chart_df)

    st.markdown("### 📋 Tableau de pilotage")
    st.dataframe(
        non_empty.rename(
            columns={
                "month": "Mois",
                "revenus": "Revenus",
                "depenses": "Depenses",
                "investi": "Investi",
                "desinvesti": "Desinvesti",
                "epargne_brute": "Epargne brute",
                "cash_disponible_apres_invest": "Cash apres investissement",
                "taux_investissement": "% revenus investis",
                "taux_depense": "% revenus depenses",
            }
        ),
        use_container_width=True,
    )
