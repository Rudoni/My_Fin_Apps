import pandas as pd
import streamlit as st
from sqlalchemy import text

from core.db import engine, sql_df


def render():
    st.title("💰 Suivi des revenus")

    with st.form("add_income_form"):
        col1, col2 = st.columns(2)
        with col1:
            desc = st.text_input("📝 Description")
            amount = st.number_input("💸 Montant", min_value=0.0, step=0.1, format="%.2f")
        with col2:
            income_date = st.date_input("📅 Date de reception")
            income_type = st.selectbox("🏷️ Type de revenu", ["Salaire", "Achat-revente", "Prime", "Dividende", "Autre"])

        if st.form_submit_button("✅ Ajouter le revenu"):
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO incomes (description_income, amount, income_date, income_type)
                        VALUES (:desc, :amt, :date, :type)
                        """
                    ),
                    {"desc": desc, "amt": amount, "date": income_date, "type": income_type},
                )
            st.success("✅ Revenu ajoute")

    st.markdown("---")
    df_income = sql_df("SELECT * FROM incomes ORDER BY income_date DESC, income_id DESC")
    if df_income.empty:
        st.info("Aucun revenu pour le moment.")
        return

    st.dataframe(df_income[["description_income", "amount", "income_date", "income_type"]], use_container_width=True)

    edited_df = st.data_editor(
        df_income[["income_id", "description_income", "amount", "income_date", "income_type"]],
        disabled=["income_id"],
        num_rows="dynamic",
        use_container_width=True,
        key="editor_income",
    )
    if st.button("💾 Enregistrer les revenus"):
        updates = 0
        with engine.begin() as conn:
            for _, row in edited_df.iterrows():
                original = df_income[df_income["income_id"] == row["income_id"]].iloc[0]
                if not original[["description_income", "amount", "income_date", "income_type"]].equals(
                    row[["description_income", "amount", "income_date", "income_type"]]
                ):
                    conn.execute(
                        text(
                            """
                            UPDATE incomes
                            SET description_income = :desc,
                                amount = :amt,
                                income_date = :date,
                                income_type = :type
                            WHERE income_id = :id
                            """
                        ),
                        {
                            "desc": row["description_income"],
                            "amt": float(row["amount"]),
                            "date": pd.to_datetime(row["income_date"]).date(),
                            "type": row["income_type"],
                            "id": int(row["income_id"]),
                        },
                    )
                    updates += 1
        st.success(f"✅ {updates} revenu(s) mis a jour")

