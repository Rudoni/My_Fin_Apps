import plotly.graph_objects as go
import pandas as pd
import streamlit as st
from sqlalchemy import text

from core.db import engine, sql_df


def render():
    st.title("📏 Gestion des limites de depenses")
    subcat_df = sql_df("SELECT subcategory_id, name_subcat FROM subcategory ORDER BY name_subcat")
    subcat_map = dict(subcat_df.values)
    subcat_rev = {value: key for key, value in subcat_map.items()}

    limits_df = sql_df("SELECT * FROM limits ORDER BY year, subcategory_id")
    limits_df["subcategory"] = limits_df["subcategory_id"].map(subcat_map)
    edited_limits = st.data_editor(
        limits_df[["subcategory", "year", "limit_amount"]],
        column_config={
            "subcategory": st.column_config.SelectboxColumn("Sous-categorie", options=list(subcat_map.values())),
            "year": st.column_config.NumberColumn("Annee", step=1, format="%d"),
            "limit_amount": st.column_config.NumberColumn("Limite (€)", step=10.0, format="%.2f"),
        },
        num_rows="dynamic",
        use_container_width=True,
        key="limits_editor",
    )

    if st.button("💾 Enregistrer les limites"):
        with engine.begin() as conn:
            for _, row in edited_limits.iterrows():
                if pd.isna(row["subcategory"]) or pd.isna(row["year"]) or pd.isna(row["limit_amount"]):
                    continue
                conn.execute(
                    text(
                        """
                        INSERT INTO limits (subcategory_id, year, limit_amount)
                        VALUES (:subcat, :yr, :amt)
                        ON CONFLICT (subcategory_id, year)
                        DO UPDATE SET limit_amount = EXCLUDED.limit_amount
                        """
                    ),
                    {
                        "subcat": int(subcat_rev[row["subcategory"]]),
                        "yr": int(row["year"]),
                        "amt": float(row["limit_amount"]),
                    },
                )
        st.success("✅ Limites mises a jour")

    df_exp = sql_df("SELECT price, expense_date, subcategory_id FROM expenses")
    if df_exp.empty or limits_df.empty:
        return

    df_exp["year"] = pd.to_datetime(df_exp["expense_date"]).dt.year
    actual = df_exp.groupby(["subcategory_id", "year"], as_index=False)["price"].sum().rename(columns={"price": "actual"})
    plot_df = limits_df.merge(actual, how="left", on=["subcategory_id", "year"]).fillna({"actual": 0.0})
    plot_df["reste"] = (plot_df["limit_amount"] - plot_df["actual"]).clip(lower=0.0)
    plot_df["subcategory"] = plot_df["subcategory_id"].map(subcat_map)

    st.markdown("### 📊 Limites vs depenses")
    for year in sorted(plot_df["year"].dropna().unique()):
        year_df = plot_df[plot_df["year"] == year]
        fig = go.Figure(
            data=[
                go.Bar(name="Depenses", x=year_df["subcategory"], y=year_df["actual"]),
                go.Bar(name="Reste", x=year_df["subcategory"], y=year_df["reste"]),
            ]
        )
        fig.update_layout(barmode="stack", height=420, title=f"Annee {year}")
        st.plotly_chart(fig, use_container_width=True)
