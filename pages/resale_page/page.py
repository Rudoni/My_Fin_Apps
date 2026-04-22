import pandas as pd
import streamlit as st
from sqlalchemy import text

from core.db import DB_URL, engine, fmt_eur, sql_df
from core.resale_categories import RESALE_CATEGORIES
from core.resale import get_resale_summary
from import_resale import clean_resale_dataframe, insert_resale_items


def render():
    st.title("👟 Achat-revente")
    st.caption("Suivi detaille de tes paires, objets ou lots d'achat-revente.")

    tab_input, tab_stats = st.tabs(["✍️ Saisie & Import", "📊 Stats & Tableau"])

    with tab_input:
        st.markdown("### 📥 Importer un fichier")
        uploaded_file = st.file_uploader(
            "Charge un fichier Excel ou CSV avec une structure proche de ton tableau",
            type=["xlsx", "xls", "csv"],
            key="resale_file_uploader",
        )

        if uploaded_file:
            try:
                df_import = clean_resale_dataframe(uploaded_file, uploaded_file.name)
                st.caption("Apercu des donnees nettoyees avant insertion")
                st.dataframe(df_import, use_container_width=True)

                if df_import.empty:
                    st.warning("Aucune ligne exploitable trouvee dans le fichier.")
                elif st.button("🚀 Importer les lignes achat-revente"):
                    insert_resale_items(df_import, DB_URL)
                    st.success(f"✅ {len(df_import)} ligne(s) importee(s)")
            except Exception as exc:
                st.error(f"Import impossible: {exc}")

        st.markdown("---")

        with st.form("resale_add_form"):
            col1, col2, col3 = st.columns(3)
            with col1:
                pair_name = st.text_input("Nom de la paire / objet")
                resale_category = st.selectbox("Categorie", RESALE_CATEGORIES, index=0)
                purchase_price = st.number_input("Prix paye", min_value=0.0, step=1.0, format="%.2f")
                purchase_date = st.date_input("Date d'achat", value=None)
            with col2:
                purchase_site = st.text_input("Site d'achat")
                size = st.text_input("Size")
                pair_count = st.number_input("Nb de paires", min_value=1, step=1)
                pair_received = st.checkbox("Paire recue")
            with col3:
                sale_price = st.number_input("Prix de vente", min_value=0.0, step=1.0, format="%.2f")
                sale_date = st.date_input("Date de vente", value=None)
                sale_site = st.text_input("Site de vente")
                payment_method = st.text_input("Mode de paiement")
                expected_price = st.number_input("Prix attendu", min_value=0.0, step=1.0, format="%.2f")

            notes = st.text_input("Notes")

            if st.form_submit_button("✅ Ajouter la ligne"):
                if not pair_name.strip():
                    st.error("Le nom est obligatoire.")
                else:
                    with engine.begin() as conn:
                        conn.execute(
                            text(
                                """
                                INSERT INTO resale_item (
                                    pair_name, resale_category, retail_price, purchase_price, purchase_date, purchase_site,
                                    size, pair_received, sale_price, sale_date, sale_site,
                                    pair_count, payment_method, expected_price, notes
                                )
                                VALUES (
                                    :pair_name, :resale_category, :retail_price, :purchase_price, :purchase_date, :purchase_site,
                                    :size, :pair_received, :sale_price, :sale_date, :sale_site,
                                    :pair_count, :payment_method, :expected_price, :notes
                                )
                                """
                            ),
                            {
                                "pair_name": pair_name.strip(),
                                "resale_category": resale_category,
                                "retail_price": None,
                                "purchase_price": float(purchase_price),
                                "purchase_date": purchase_date,
                                "purchase_site": purchase_site.strip() or None,
                                "size": size.strip() or None,
                                "pair_received": bool(pair_received),
                                "sale_price": float(sale_price) if sale_price > 0 else None,
                                "sale_date": sale_date,
                                "sale_site": sale_site.strip() or None,
                                "pair_count": int(pair_count),
                                "payment_method": payment_method.strip() or None,
                                "expected_price": float(expected_price) if expected_price > 0 else None,
                                "notes": notes.strip() or None,
                            },
                        )
                    st.success("✅ Ligne achat-revente ajoutee")

        summary = get_resale_summary()
        df = summary["all"]
        if not df.empty:
            st.markdown("### ✏️ Modifier les lignes")
            search_keyword = st.text_input(
                "🔎 Recherche par mot-cle",
                placeholder="Nom, site de vente, notes...",
                key="resale_search_keyword",
            ).strip()

            table_df = df[
                [
                    "resale_item_id",
                    "pair_name",
                    "resale_category",
                    "purchase_price",
                    "purchase_date",
                    "sale_price",
                    "sale_date",
                    "expected_price",
                    "benefit",
                    "expected_benefit",
                    "pair_count",
                    "status",
                    "sale_site",
                    "notes",
                ]
            ].copy()
            table_df["delete_row"] = False

            if search_keyword:
                search_series = (
                    table_df[["pair_name", "sale_site", "status", "notes"]]
                    .fillna("")
                    .astype(str)
                    .agg(" ".join, axis=1)
                    .str.lower()
                )
                table_df = table_df[search_series.str.contains(search_keyword.lower(), na=False)].copy()
                st.caption(f"{len(table_df)} resultat(s) pour `{search_keyword}`")

            edited_df = st.data_editor(
                table_df,
                disabled=["resale_item_id", "benefit", "expected_benefit", "status"],
                use_container_width=True,
                key="resale_editor",
                column_config={
                    "delete_row": st.column_config.CheckboxColumn("Supprimer"),
                    "resale_category": st.column_config.SelectboxColumn("Categorie", options=RESALE_CATEGORIES),
                    "purchase_price": st.column_config.NumberColumn("Prix paye", format="%.2f"),
                    "sale_price": st.column_config.NumberColumn("Prix de vente", format="%.2f"),
                    "expected_price": st.column_config.NumberColumn("Prix attendu", format="%.2f"),
                    "benefit": st.column_config.NumberColumn("Benefice", format="%.2f"),
                    "expected_benefit": st.column_config.NumberColumn("Benefice attendu", format="%.2f"),
                    "pair_count": st.column_config.NumberColumn("Nb de paires", step=1, format="%d"),
                },
            )

            if st.button("💾 Enregistrer les modifications achat-revente"):
                updates = 0
                deleted = 0
                with engine.begin() as conn:
                    for _, row in edited_df.iterrows():
                        if bool(row["delete_row"]):
                            conn.execute(
                                text("DELETE FROM resale_item WHERE resale_item_id = :resale_item_id"),
                                {"resale_item_id": int(row["resale_item_id"])},
                            )
                            deleted += 1
                            continue

                        original = df[df["resale_item_id"] == row["resale_item_id"]].iloc[0]
                        compare_cols = [
                            "pair_name",
                            "resale_category",
                            "purchase_price",
                            "purchase_date",
                            "sale_price",
                            "sale_date",
                            "pair_count",
                            "expected_price",
                            "sale_site",
                            "notes",
                        ]
                        if not original[compare_cols].equals(row[compare_cols]):
                            conn.execute(
                                text(
                                    """
                                    UPDATE resale_item
                                    SET pair_name = :pair_name,
                                        resale_category = :resale_category,
                                        retail_price = NULL,
                                        purchase_price = :purchase_price,
                                        purchase_date = :purchase_date,
                                        sale_price = :sale_price,
                                        sale_date = :sale_date,
                                        pair_count = :pair_count,
                                        expected_price = :expected_price,
                                        sale_site = :sale_site,
                                        notes = :notes
                                    WHERE resale_item_id = :resale_item_id
                                    """
                                ),
                                {
                                    "pair_name": str(row["pair_name"]).strip(),
                                    "resale_category": str(row["resale_category"]).strip() if pd.notna(row["resale_category"]) else "Autres",
                                    "purchase_price": float(row["purchase_price"]) if pd.notna(row["purchase_price"]) else 0.0,
                                    "purchase_date": pd.to_datetime(row["purchase_date"]).date() if pd.notna(row["purchase_date"]) else None,
                                    "sale_price": float(row["sale_price"]) if pd.notna(row["sale_price"]) and float(row["sale_price"]) > 0 else None,
                                    "sale_date": pd.to_datetime(row["sale_date"]).date() if pd.notna(row["sale_date"]) else None,
                                    "pair_count": int(row["pair_count"]) if pd.notna(row["pair_count"]) else 1,
                                    "expected_price": float(row["expected_price"]) if pd.notna(row["expected_price"]) and float(row["expected_price"]) > 0 else None,
                                    "sale_site": str(row["sale_site"]).strip() or None,
                                    "notes": str(row["notes"]).strip() or None,
                                    "resale_item_id": int(row["resale_item_id"]),
                                },
                            )
                            updates += 1
                st.success(f"✅ {updates} ligne(s) mise(s) a jour, {deleted} supprimee(s)")

    summary = get_resale_summary()
    df = summary["all"]
    if df.empty:
        st.info("Aucune ligne d'achat-revente pour le moment.")
        return

    sold_df = summary["sold"]
    stock_df = summary["stock"]

    with tab_stats:
        st.markdown("### 📊 KPI achat-revente")
        col1, col2, col3 = st.columns(3)
        col1.metric("CA total", fmt_eur(summary["ca_total"]))
        col2.metric("Nombre d'achats", str(summary["purchase_count"]))
        col3.metric("Benefice total", fmt_eur(summary["benefit_total"]))

        col4, col5 = st.columns(2)
        col4.metric("Valeur estimee du non vendu", fmt_eur(summary["unsold_value"]))
        col5.metric("Articles non vendus", str(len(stock_df)))

        st.markdown("### 📆 CA par an")
        if summary["ca_by_year"].empty:
            st.write("Aucune vente enregistree.")
        else:
            st.dataframe(summary["ca_by_year"].rename(columns={"year": "Annee", "ca_total": "CA"}), use_container_width=True)
            st.bar_chart(summary["ca_by_year"].set_index("year"))

        st.markdown("### 💰 Benefice par an")
        if summary["benefit_by_year"].empty:
            st.write("Aucune vente enregistree.")
        else:
            st.dataframe(
                summary["benefit_by_year"].rename(columns={"year": "Annee", "benefit_total": "Benefice"}),
                use_container_width=True,
            )
            st.bar_chart(summary["benefit_by_year"].set_index("year"))

        st.markdown("### 🗓️ Benefice par mois")
        if summary["benefit_by_month"].empty:
            st.write("Aucune vente enregistree.")
        else:
            monthly_display = summary["benefit_by_month"].copy()
            monthly_display["month_label"] = monthly_display["month"].dt.strftime("%Y-%m")
            st.dataframe(
                monthly_display[["month_label", "benefit_total"]].rename(columns={"month_label": "Mois", "benefit_total": "Benefice"}),
                use_container_width=True,
            )
            st.line_chart(summary["benefit_by_month"].set_index("month"))

        st.markdown("### 🏷️ Stats par categorie")
        col_cat_1, col_cat_2 = st.columns(2)

        with col_cat_1:
            st.markdown("#### CA par categorie")
            if summary["sales_by_category"].empty:
                st.write("Aucune vente enregistree.")
            else:
                st.dataframe(
                    summary["sales_by_category"].rename(columns={"category": "Categorie", "ca_total": "CA"}),
                    use_container_width=True,
                )
                st.bar_chart(summary["sales_by_category"].set_index("category"))

        with col_cat_2:
            st.markdown("#### Benefice par categorie")
            if summary["benefit_by_category"].empty:
                st.write("Aucune vente enregistree.")
            else:
                st.dataframe(
                    summary["benefit_by_category"].rename(columns={"category": "Categorie", "benefit_total": "Benefice"}),
                    use_container_width=True,
                )
                st.bar_chart(summary["benefit_by_category"].set_index("category"))

        st.markdown("### 🧩 Repartition par categorie")
        if summary["stock_by_category"].empty and summary["sales_by_category"].empty:
            st.write("Pas encore assez de donnees pour la repartition par categorie.")
        else:
            repartition_df = summary["stock_by_category"].copy()
            if repartition_df.empty:
                repartition_df = pd.DataFrame(columns=["category", "stock_estimated_value"])
            if not repartition_df.empty:
                st.dataframe(
                    repartition_df.rename(
                        columns={"category": "Categorie", "stock_estimated_value": "Stock non vendu estime"}
                    ),
                    use_container_width=True,
                )
                st.bar_chart(repartition_df.set_index("category"))

        st.markdown("### 📦 Stock en cours")
        if stock_df.empty:
            st.write("Aucun article en stock.")
        else:
            st.dataframe(
                stock_df[
                    [
                        "pair_name",
                        "resale_category",
                        "purchase_date",
                        "purchase_site",
                        "size",
                        "pair_count",
                        "purchase_price",
                        "expected_price",
                        "expected_benefit",
                        "status",
                    ]
                ],
                use_container_width=True,
            )

        st.markdown("### 💸 Historique des ventes")
        if sold_df.empty:
            st.write("Aucune vente enregistree.")
        else:
            st.dataframe(
                sold_df[
                    [
                        "pair_name",
                        "resale_category",
                        "sale_date",
                        "sale_site",
                        "pair_count",
                        "purchase_price",
                        "sale_price",
                        "benefit",
                    ]
                ],
                use_container_width=True,
            )
