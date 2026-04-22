import pandas as pd
import streamlit as st

from core.db import fmt_eur, sql_df


def render():
    st.title("📈 Cashflow")
    df_income = sql_df("SELECT amount, income_date FROM incomes")
    df_expense = sql_df("SELECT price, expense_date FROM expenses")
    if df_income.empty and df_expense.empty:
        st.info("Ajoute des revenus et des depenses pour voir le cashflow.")
        return

    if not df_income.empty:
        df_income["year"] = pd.to_datetime(df_income["income_date"]).dt.year
        df_income["month"] = pd.to_datetime(df_income["income_date"]).dt.to_period("M").dt.to_timestamp()
    if not df_expense.empty:
        df_expense["year"] = pd.to_datetime(df_expense["expense_date"]).dt.year
        df_expense["month"] = pd.to_datetime(df_expense["expense_date"]).dt.to_period("M").dt.to_timestamp()

    all_years = sorted(set(df_income.get("year", pd.Series(dtype=int)).dropna().unique()) | set(df_expense.get("year", pd.Series(dtype=int)).dropna().unique()))
    if not all_years:
        st.info("Aucune annee exploitable pour le moment.")
        return

    selected_year = st.selectbox("📅 Choisir une annee", all_years, index=len(all_years) - 1)
    revenus_total = df_income[df_income["year"] == selected_year]["amount"].sum() if not df_income.empty else 0.0
    depenses_total = df_expense[df_expense["year"] == selected_year]["price"].sum() if not df_expense.empty else 0.0
    cashflow = revenus_total - depenses_total

    col1, col2, col3 = st.columns(3)
    col1.metric("💰 Revenus", fmt_eur(revenus_total))
    col2.metric("💸 Depenses", fmt_eur(depenses_total))
    col3.metric("📊 Cashflow", fmt_eur(cashflow))

    revenus_mensuels = df_income[df_income["year"] == selected_year].groupby("month")["amount"].sum() if not df_income.empty else pd.Series(dtype=float)
    depenses_mensuelles = df_expense[df_expense["year"] == selected_year].groupby("month")["price"].sum() if not df_expense.empty else pd.Series(dtype=float)
    compare_df = pd.DataFrame({"Revenus": revenus_mensuels, "Depenses": depenses_mensuelles}).fillna(0.0)
    if not compare_df.empty:
        st.line_chart(compare_df)

