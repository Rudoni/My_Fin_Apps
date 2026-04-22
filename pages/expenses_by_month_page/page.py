import pandas as pd
import streamlit as st

from core.db import sql_df


def render():
    st.title("📅 Analyse des depenses mensuelles")
    df = sql_df("SELECT * FROM expenses")
    if df.empty:
        st.info("Aucune depense pour le moment.")
        return

    subcat_map = dict(sql_df("SELECT subcategory_id, name_subcat FROM subcategory").values)
    df["subcategory"] = df["subcategory_id"].map(subcat_map)
    df["expense_date"] = pd.to_datetime(df["expense_date"])
    df["month"] = df["expense_date"].dt.to_period("M").dt.to_timestamp()
    df["year"] = df["expense_date"].dt.year

    selected_years = st.multiselect("📅 Annee(s)", sorted(df["year"].dropna().unique()), default=sorted(df["year"].dropna().unique()))
    selected_subcats = st.multiselect(
        "📂 Sous-categorie(s)",
        sorted(df["subcategory"].dropna().unique()),
        default=sorted(df["subcategory"].dropna().unique()),
    )

    filtered = df[df["year"].isin(selected_years) & df["subcategory"].isin(selected_subcats)]
    by_month = filtered.groupby("month", as_index=False)["price"].sum()
    by_year = filtered.groupby("year", as_index=False)["price"].sum()

    st.dataframe(by_month, use_container_width=True)
    if not by_month.empty:
        st.line_chart(by_month.rename(columns={"month": "index"}).set_index("index"))

    st.markdown("### 🗓️ Depenses par annee")
    st.dataframe(by_year, use_container_width=True)
    if not by_year.empty:
        st.bar_chart(by_year.set_index("year"))
