import streamlit as st
from sqlalchemy import text

from core.db import engine, fmt_eur, sql_df


def render():
    st.title("📺 Gestion des abonnements")
    df_abos = sql_df("SELECT * FROM abonnement ORDER BY is_active DESC, name")
    if df_abos.empty:
        df_abos = sql_df("SELECT NULL::text AS name, 0::numeric AS monthly_amount, ''::text AS category, TRUE::boolean AS is_active LIMIT 0")

    edited_df = st.data_editor(
        df_abos[["name", "monthly_amount", "category", "is_active"]],
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "monthly_amount": st.column_config.NumberColumn("Montant mensuel (€)", step=1.0, format="%.2f"),
            "is_active": st.column_config.CheckboxColumn("Actif"),
        },
        key="abos_editor",
    )

    if st.button("💾 Enregistrer les abonnements"):
        with engine.begin() as conn:
            for i, row in edited_df.iterrows():
                if not str(row["name"]).strip():
                    continue
                payload = {
                    "n": str(row["name"]).strip(),
                    "m": float(row["monthly_amount"]),
                    "c": row["category"] or "",
                    "a": bool(row["is_active"]),
                }
                if i < len(df_abos):
                    payload["id"] = int(df_abos.iloc[i]["abonnement_id"])
                    conn.execute(
                        text(
                            """
                            UPDATE abonnement
                            SET name = :n, monthly_amount = :m, category = :c, is_active = :a
                            WHERE abonnement_id = :id
                            """
                        ),
                        payload,
                    )
                else:
                    conn.execute(
                        text(
                            """
                            INSERT INTO abonnement (name, monthly_amount, category, is_active)
                            VALUES (:n, :m, :c, :a)
                            """
                        ),
                        payload,
                    )
        st.success("✅ Abonnements enregistres")

    active_df = sql_df("SELECT * FROM abonnement WHERE is_active = TRUE")
    if active_df.empty:
        return
    active_df["total_annuel"] = active_df["monthly_amount"] * 12
    st.dataframe(active_df[["name", "monthly_amount", "total_annuel", "category"]], use_container_width=True)
    st.metric("💰 Total mensuel", fmt_eur(active_df["monthly_amount"].sum()))
    st.metric("📅 Total annuel", fmt_eur(active_df["total_annuel"].sum()))

