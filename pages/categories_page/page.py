import streamlit as st
from sqlalchemy import text

from core.db import engine, sql_df


def render():
    st.title("📂 Gestion des categories")

    tab1, tab2 = st.tabs(["🗃️ Categories", "📑 Sous-categories"])

    with tab1:
        df_cat = sql_df("SELECT * FROM category ORDER BY category_id")
        edited_cat = st.data_editor(
            df_cat[["name_cat"]].copy(),
            num_rows="dynamic",
            use_container_width=True,
            key="cat_editor",
        )

        if st.button("💾 Enregistrer les categories"):
            with engine.begin() as conn:
                for i, row in edited_cat.iterrows():
                    name = str(row["name_cat"]).strip()
                    if not name:
                        continue
                    if i < len(df_cat):
                        conn.execute(
                            text("UPDATE category SET name_cat = :name WHERE category_id = :id"),
                            {"name": name, "id": int(df_cat.iloc[i]["category_id"])},
                        )
                    else:
                        conn.execute(text("INSERT INTO category (name_cat) VALUES (:name)"), {"name": name})
            st.success("✅ Categories mises a jour")

    with tab2:
        df_subcat = sql_df("SELECT subcategory_id, name_subcat, category_id FROM subcategory ORDER BY subcategory_id")
        df_cat_map = dict(sql_df("SELECT category_id, name_cat FROM category").values)
        cat_reverse = {value: key for key, value in df_cat_map.items()}
        subcat_display = df_subcat.copy()
        subcat_display["category"] = subcat_display["category_id"].map(df_cat_map)

        edited_subcat = st.data_editor(
            subcat_display[["name_subcat", "category"]],
            column_config={"category": st.column_config.SelectboxColumn("Categorie", options=list(df_cat_map.values()))},
            num_rows="dynamic",
            use_container_width=True,
            key="subcat_editor",
        )

        if st.button("💾 Enregistrer les sous-categories"):
            with engine.begin() as conn:
                for i, row in edited_subcat.iterrows():
                    name = str(row["name_subcat"]).strip()
                    if not name or row["category"] not in cat_reverse:
                        continue
                    cat_id = int(cat_reverse[row["category"]])
                    if i < len(df_subcat):
                        conn.execute(
                            text(
                                """
                                UPDATE subcategory
                                SET name_subcat = :name, category_id = :cat
                                WHERE subcategory_id = :id
                                """
                            ),
                            {"name": name, "cat": cat_id, "id": int(df_subcat.iloc[i]["subcategory_id"])},
                        )
                    else:
                        conn.execute(
                            text(
                                """
                                INSERT INTO subcategory (name_subcat, category_id)
                                VALUES (:name, :cat)
                                """
                            ),
                            {"name": name, "cat": cat_id},
                        )
            st.success("✅ Sous-categories mises a jour")

