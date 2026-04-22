import datetime

import streamlit as st
from sqlalchemy import text

from core.assets import get_accounts, get_asset_transactions, get_asset_types, get_assets
from core.db import engine


def render():
    st.title("🧱 Investissements & actifs")

    type_df = get_asset_types()
    account_df = get_accounts()
    asset_df = get_assets()

    tab1, tab2, tab3, tab4 = st.tabs(["Types", "Comptes", "Actifs", "Transactions"])

    with tab1:
        st.caption("Bourse, crypto, achat-revente et patrimoine utilisent la meme base d'actifs.")
        edited_types = st.data_editor(
            type_df[["code", "label", "category_group", "is_market_quoted", "track_latest_price"]],
            num_rows="dynamic",
            use_container_width=True,
            key="asset_type_editor",
        )
        if st.button("💾 Enregistrer les types d'actifs"):
            with engine.begin() as conn:
                for i, row in edited_types.iterrows():
                    code = str(row["code"]).strip().upper()
                    label = str(row["label"]).strip()
                    if not code or not label:
                        continue
                    payload = {
                        "code": code,
                        "label": label,
                        "group": str(row["category_group"]).strip() or "other",
                        "quoted": bool(row["is_market_quoted"]),
                        "latest": bool(row["track_latest_price"]),
                    }
                    if i < len(type_df):
                        payload["id"] = int(type_df.iloc[i]["asset_type_id"])
                        conn.execute(
                            text(
                                """
                                UPDATE asset_type
                                SET code = :code,
                                    label = :label,
                                    category_group = :group,
                                    is_market_quoted = :quoted,
                                    track_latest_price = :latest
                                WHERE asset_type_id = :id
                                """
                            ),
                            payload,
                        )
                    else:
                        conn.execute(
                            text(
                                """
                                INSERT INTO asset_type (code, label, category_group, is_market_quoted, track_latest_price)
                                VALUES (:code, :label, :group, :quoted, :latest)
                                """
                            ),
                            payload,
                        )
            st.success("✅ Types d'actifs enregistres")

    with tab2:
        edited_accounts = st.data_editor(
            account_df[["name_account", "account_type", "provider", "currency"]],
            num_rows="dynamic",
            use_container_width=True,
            key="asset_account_editor",
        )
        if st.button("💾 Enregistrer les comptes"):
            with engine.begin() as conn:
                for i, row in edited_accounts.iterrows():
                    name = str(row["name_account"]).strip()
                    if not name:
                        continue
                    payload = {
                        "name": name,
                        "type": str(row["account_type"]).strip() or "Compte-titres",
                        "provider": str(row["provider"]).strip(),
                        "currency": str(row["currency"]).strip() or "EUR",
                    }
                    if i < len(account_df):
                        payload["id"] = int(account_df.iloc[i]["account_id"])
                        conn.execute(
                            text(
                                """
                                UPDATE asset_account
                                SET name_account = :name,
                                    account_type = :type,
                                    provider = :provider,
                                    currency = :currency
                                WHERE account_id = :id
                                """
                            ),
                            payload,
                        )
                    else:
                        conn.execute(
                            text(
                                """
                                INSERT INTO asset_account (name_account, account_type, provider, currency)
                                VALUES (:name, :type, :provider, :currency)
                                """
                            ),
                            payload,
                        )
            st.success("✅ Comptes enregistres")

    with tab3:
        type_options = {row["label"]: int(row["asset_type_id"]) for _, row in type_df.iterrows()}
        type_labels = list(type_options.keys())
        asset_display = asset_df.copy()
        edited_assets = st.data_editor(
            asset_display[["name_asset", "ticker", "asset_type", "currency", "data_source", "is_active", "notes"]],
            column_config={"asset_type": st.column_config.SelectboxColumn("Type d'actif", options=type_labels)},
            num_rows="dynamic",
            use_container_width=True,
            key="asset_editor",
        )
        if st.button("💾 Enregistrer les actifs"):
            type_reverse = {label: asset_type_id for label, asset_type_id in type_options.items()}
            with engine.begin() as conn:
                for i, row in edited_assets.iterrows():
                    name = str(row["name_asset"]).strip()
                    if not name or row["asset_type"] not in type_reverse:
                        continue
                    payload = {
                        "name": name,
                        "ticker": str(row["ticker"]).strip() or None,
                        "type_id": int(type_reverse[row["asset_type"]]),
                        "currency": str(row["currency"]).strip() or "EUR",
                        "source": str(row["data_source"]).strip() or "manual",
                        "active": bool(row["is_active"]),
                        "notes": str(row["notes"]).strip() or None,
                    }
                    if i < len(asset_df):
                        payload["id"] = int(asset_df.iloc[i]["asset_id"])
                        conn.execute(
                            text(
                                """
                                UPDATE asset
                                SET name_asset = :name,
                                    ticker = :ticker,
                                    asset_type_id = :type_id,
                                    currency = :currency,
                                    data_source = :source,
                                    is_active = :active,
                                    notes = :notes
                                WHERE asset_id = :id
                                """
                            ),
                            payload,
                        )
                    else:
                        conn.execute(
                            text(
                                """
                                INSERT INTO asset (name_asset, ticker, asset_type_id, currency, data_source, is_active, notes)
                                VALUES (:name, :ticker, :type_id, :currency, :source, :active, :notes)
                                """
                            ),
                            payload,
                        )
            st.success("✅ Actifs enregistres")

        st.markdown("---")
        st.markdown("### 🪙 Ajout rapide d'un actif physique")
        st.caption("Pour un objet de patrimoine, tu peux saisir directement une valeur estimee sans creer de transaction.")

        physical_type_df = type_df[~type_df["is_market_quoted"]].copy()
        physical_type_labels = physical_type_df["label"].tolist()
        default_physical_index = physical_type_labels.index("Patrimoine physique") if "Patrimoine physique" in physical_type_labels else 0

        if physical_type_labels:
            with st.form("quick_physical_asset_form"):
                col1, col2 = st.columns(2)
                with col1:
                    asset_name = st.text_input("Nom de l'actif physique")
                    asset_type_label = st.selectbox("Type", physical_type_labels, index=default_physical_index)
                    currency = st.text_input("Devise", value="EUR")
                with col2:
                    estimated_value = st.number_input("Valeur estimee", min_value=0.0, step=1.0, format="%.2f")
                    valuation_date = st.date_input("Date de valorisation", datetime.date.today(), key="physical_asset_valuation_date")
                    notes = st.text_input("Notes", key="physical_asset_notes")

                if st.form_submit_button("✅ Ajouter l'actif physique"):
                    if not asset_name.strip():
                        st.error("Le nom de l'actif est obligatoire.")
                    elif estimated_value <= 0:
                        st.error("Renseigne une valeur estimee superieure a 0.")
                    else:
                        asset_type_id = int(
                            physical_type_df.loc[physical_type_df["label"] == asset_type_label, "asset_type_id"].iloc[0]
                        )
                        with engine.begin() as conn:
                            asset_id = conn.execute(
                                text(
                                    """
                                    INSERT INTO asset (name_asset, ticker, asset_type_id, currency, data_source, is_active, notes)
                                    VALUES (:name, NULL, :type_id, :currency, 'manual', TRUE, :notes)
                                    RETURNING asset_id
                                    """
                                ),
                                {
                                    "name": asset_name.strip(),
                                    "type_id": asset_type_id,
                                    "currency": currency.strip() or "EUR",
                                    "notes": notes.strip() or None,
                                },
                            ).scalar_one()

                            conn.execute(
                                text(
                                    """
                                    INSERT INTO asset_valuation (asset_id, valuation_date, unit_price, total_value, value_source)
                                    VALUES (:asset_id, :valuation_date, 0, :total_value, 'manual')
                                    ON CONFLICT (asset_id, valuation_date, value_source)
                                    DO UPDATE SET total_value = EXCLUDED.total_value
                                    """
                                ),
                                {
                                    "asset_id": int(asset_id),
                                    "valuation_date": valuation_date,
                                    "total_value": float(estimated_value),
                                },
                            )
                        st.success("✅ Actif physique ajoute avec sa valeur estimee")

    with tab4:
        if asset_df.empty:
            st.info("Ajoute d'abord au moins un actif.")
        else:
            transaction_asset_df = asset_df[asset_df["asset_type"] != "Patrimoine physique"].copy()
            asset_options = {row["name_asset"]: int(row["asset_id"]) for _, row in transaction_asset_df.iterrows()}
            account_options = {row["name_account"]: int(row["account_id"]) for _, row in account_df.iterrows()}
            if not asset_options:
                st.info("Aucun actif eligible aux transactions. Les actifs de patrimoine physique se valorisent directement sans transaction.")
            else:
                with st.form("asset_transaction_form"):
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        asset_name = st.selectbox("Actif", list(asset_options.keys()))
                        transaction_type = st.selectbox(
                            "Type d'operation",
                            ["BUY", "SELL", "DIVIDEND", "FEE", "DEPOSIT", "WITHDRAWAL"],
                        )
                        transaction_date = st.date_input("Date", datetime.date.today())
                    with col2:
                        quantity = st.number_input("Quantite", min_value=0.0, step=0.0001, format="%.4f")
                        unit_price = st.number_input("Prix unitaire", min_value=0.0, step=0.01, format="%.4f")
                        fees = st.number_input("Frais", min_value=0.0, step=0.01, format="%.2f")
                    with col3:
                        total_amount = st.number_input("Montant total", min_value=0.0, step=0.01, format="%.2f")
                        account_name = st.selectbox("Compte", list(account_options.keys()) if account_options else ["Aucun"])
                        notes = st.text_input("Notes")

                    if st.form_submit_button("✅ Ajouter la transaction"):
                        with engine.begin() as conn:
                            conn.execute(
                                text(
                                    """
                                    INSERT INTO asset_transaction (
                                        asset_id, account_id, transaction_type, quantity, unit_price,
                                        total_amount, fees, transaction_date, notes
                                    )
                                    VALUES (
                                        :asset_id, :account_id, :transaction_type, :quantity, :unit_price,
                                        :total_amount, :fees, :transaction_date, :notes
                                    )
                                    """
                                ),
                                {
                                    "asset_id": int(asset_options[asset_name]),
                                    "account_id": int(account_options[account_name]) if account_name in account_options else None,
                                    "transaction_type": transaction_type,
                                    "quantity": float(quantity),
                                    "unit_price": float(unit_price),
                                    "total_amount": float(total_amount),
                                    "fees": float(fees),
                                    "transaction_date": transaction_date,
                                    "notes": notes or None,
                                },
                            )
                        st.success("✅ Transaction enregistree")

        tx_df = get_asset_transactions()
        if not tx_df.empty:
            st.dataframe(
                tx_df[
                    [
                        "transaction_date",
                        "name_asset",
                        "asset_type",
                        "name_account",
                        "transaction_type",
                        "quantity",
                        "unit_price",
                        "total_amount",
                        "fees",
                        "notes",
                    ]
                ],
                use_container_width=True,
            )
