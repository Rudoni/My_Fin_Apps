import pandas as pd
import streamlit as st

from core.db import sql_df


def render():
    st.title("📚 Analyse des depenses par categorie")
    df = sql_df(
        """
        SELECT e.price, e.expense_date, s.name_subcat, c.name_cat
        FROM expenses e
        JOIN subcategory s ON e.subcategory_id = s.subcategory_id
        JOIN category c ON s.category_id = c.category_id
        """
    )
    if df.empty:
        st.info("Aucune depense pour le moment.")
        return

    df["expense_date"] = pd.to_datetime(df["expense_date"])
    df["year"] = df["expense_date"].dt.year
    df["month"] = df["expense_date"].dt.to_period("M").dt.strftime("%Y-%m")

    years = sorted(df["year"].dropna().unique())
    months = sorted(df["month"].dropna().unique())
    selected_years = st.multiselect("📅 Annee(s)", years, default=years)
    selected_months = st.multiselect("🗓️ Mois", months, default=months)

    filtered = df[df["year"].isin(selected_years) & df["month"].isin(selected_months)]
    by_cat = filtered.groupby("name_cat", as_index=False)["price"].sum().sort_values("price", ascending=False)
    by_subcat = filtered.groupby("name_subcat", as_index=False)["price"].sum().sort_values("price", ascending=False)

    st.dataframe(by_cat, use_container_width=True)
    if not by_cat.empty:
        st.bar_chart(by_cat.set_index("name_cat"))

    st.markdown("### 🧾 Depenses par sous-categorie")
    st.dataframe(by_subcat, use_container_width=True)
    if not by_subcat.empty:
        st.bar_chart(by_subcat.set_index("name_subcat"))

