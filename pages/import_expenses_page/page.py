import pandas as pd
import streamlit as st
from sqlalchemy import text

from core.db import DB_URL, engine, sql_df
from import_expenses import clean_expense_dataframe, insert_expenses


def render():
    st.title("📥 Import de depenses")

    with engine.connect() as conn:
        subcat_list = conn.execute(text("SELECT subcategory_id, name_subcat FROM subcategory ORDER BY name_subcat")).fetchall()
        payment_list = conn.execute(text("SELECT id, name_payment FROM payment_method ORDER BY name_payment")).fetchall()

    subcat_options = {name: id for id, name in subcat_list}
    payment_options = {name: id for id, name in payment_list}

    uploaded_file = st.file_uploader("📂 Charger un fichier Excel (.xlsx)", type=["xlsx"])
    if uploaded_file:
        df_clean = clean_expense_dataframe(uploaded_file)
        st.subheader("📄 Donnees nettoyees")
        st.dataframe(df_clean, use_container_width=True)

        default_subcat = st.selectbox("🗂️ Sous-categorie par defaut", list(subcat_options.keys()))
        default_payment = st.selectbox("💳 Moyen de paiement par defaut", list(payment_options.keys()))

        if st.button("🚀 Importer les depenses"):
            insert_expenses(df_clean, subcat_options[default_subcat], payment_options[default_payment], DB_URL)
            st.success("✅ Import termine avec succes")

    st.markdown("---")
    st.header("➕ Ajouter une depense manuellement")

    with st.form("manual_add_form"):
        col1, col2 = st.columns(2)
        with col1:
            new_label = st.text_input("📝 Description")
            new_price = st.number_input("💰 Montant (€)", min_value=0.0, step=0.1, format="%.2f")
            new_date = st.date_input("📅 Date")
        with col2:
            new_subcat = st.selectbox("📂 Sous-categorie", list(subcat_options.keys()))
            new_payment = st.selectbox("💳 Methode de paiement", list(payment_options.keys()))

        submitted = st.form_submit_button("✅ Ajouter cette depense")
        if submitted:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO expenses (description_expense, price, expense_date, subcategory_id, payment_method_id)
                        VALUES (:desc, :price, :date, :subcat, :pay)
                        """
                    ),
                    {
                        "desc": new_label,
                        "price": float(new_price),
                        "date": new_date,
                        "subcat": subcat_options[new_subcat],
                        "pay": payment_options[new_payment],
                    },
                )
            st.success("✅ Depense ajoutee avec succes")

    st.markdown("---")
    st.header("📊 Modifier les depenses")

    with engine.connect() as conn:
        subcat_result = conn.execute(text("SELECT subcategory_id, name_subcat FROM subcategory")).fetchall()
        pay_result = conn.execute(text("SELECT id, name_payment FROM payment_method")).fetchall()

    subcat_map = {row[0]: row[1] for row in subcat_result}
    pay_map = {row[0]: row[1] for row in pay_result}
    subcat_rev = {value: key for key, value in subcat_map.items()}
    pay_rev = {value: key for key, value in pay_map.items()}

    df = sql_df("SELECT * FROM expenses ORDER BY expense_date DESC, expense_id DESC")
    df["subcategory"] = df["subcategory_id"].map(subcat_map)
    df["payment_method"] = df["payment_method_id"].map(pay_map)

    df_display = df[["expense_id", "description_expense", "price", "expense_date", "subcategory", "payment_method"]].copy()
    edited_df = st.data_editor(
        df_display,
        column_config={
            "subcategory": st.column_config.SelectboxColumn("Sous-categorie", options=list(subcat_map.values())),
            "payment_method": st.column_config.SelectboxColumn("Moyen de paiement", options=list(pay_map.values())),
        },
        disabled=["expense_id"],
        use_container_width=True,
        key="editor_expense",
    )

    if st.button("💾 Enregistrer les modifications des depenses"):
        updates = 0
        with engine.begin() as conn:
            for _, new_row in edited_df.iterrows():
                old_row = df_display[df_display["expense_id"] == new_row["expense_id"]].iloc[0]
                if not old_row.equals(new_row):
                    conn.execute(
                        text(
                            """
                            UPDATE expenses
                            SET description_expense = :desc,
                                price = :price,
                                expense_date = :date,
                                subcategory_id = :subcat_id,
                                payment_method_id = :pay_id
                            WHERE expense_id = :eid
                            """
                        ),
                        {
                            "desc": str(new_row["description_expense"]),
                            "price": float(new_row["price"]),
                            "date": pd.to_datetime(new_row["expense_date"]).date(),
                            "subcat_id": int(subcat_rev[new_row["subcategory"]]),
                            "pay_id": int(pay_rev[new_row["payment_method"]]),
                            "eid": int(new_row["expense_id"]),
                        },
                    )
                    updates += 1
        st.success(f"✅ {updates} ligne(s) mise(s) a jour")
