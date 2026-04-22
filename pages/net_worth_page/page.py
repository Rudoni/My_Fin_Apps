import datetime

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from sqlalchemy import text

from core.assets import compute_asset_snapshot, get_assets, refresh_market_prices
from core.db import engine, fmt_eur
from core.resale import get_resale_summary


def render():
    st.title("🏦 Patrimoine")
    snapshot = compute_asset_snapshot()
    resale_summary = get_resale_summary()
    resale_unsold = float(resale_summary["unsold_value"])

    if snapshot.empty and resale_unsold <= 0:
        st.info("Ajoute des actifs et des transactions pour commencer a suivre ton patrimoine.")
        return

    total_value_assets = float(snapshot["market_value"].sum()) if not snapshot.empty else 0.0
    total_value = total_value_assets + resale_unsold
    total_invested = float(snapshot["invested_net"].sum()) if not snapshot.empty else 0.0
    total_pnl = float(snapshot["unrealized_pnl"].sum()) if not snapshot.empty else 0.0
    invested_assets = snapshot[snapshot["invested_net"] > 0] if not snapshot.empty else snapshot

    col1, col2, col3 = st.columns(3)
    col1.metric("Valeur totale", fmt_eur(total_value))
    col2.metric("Capital immobilise", fmt_eur(total_invested))
    col3.metric("Plus-value latente", fmt_eur(total_pnl))

    allocation = (
        snapshot.groupby("category_group", as_index=False)["market_value"].sum().sort_values("market_value", ascending=False)
        if not snapshot.empty
        else pd.DataFrame(columns=["category_group", "market_value"])
    )
    if resale_unsold > 0:
        resale_row = {"category_group": "resale", "market_value": resale_unsold}
        if allocation.empty:
            allocation = pd.DataFrame([resale_row])
        else:
            allocation = pd.concat([allocation, pd.DataFrame([resale_row])], ignore_index=True)

    if not allocation.empty:
        fig = go.Figure(data=[go.Pie(labels=allocation["category_group"], values=allocation["market_value"], hole=0.45)])
        fig.update_layout(height=420, title="Repartition du patrimoine")
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("### 📋 Detail des actifs")
    if not snapshot.empty:
        display = snapshot[
            [
                "name_asset",
                "asset_type",
                "category_group",
                "quantity_held",
                "effective_unit_price",
                "market_value",
                "invested_net",
                "unrealized_pnl",
                "valuation_date",
            ]
        ].rename(
            columns={
                "name_asset": "Actif",
                "asset_type": "Type",
                "category_group": "Famille",
                "quantity_held": "Quantite detenue",
                "effective_unit_price": "Prix unitaire retenu",
                "market_value": "Valeur actuelle",
                "invested_net": "Capital investi net",
                "unrealized_pnl": "P/L latent",
                "valuation_date": "Derniere valorisation",
            }
        )
        if resale_unsold > 0:
            display = pd.concat(
                [
                    display,
                    pd.DataFrame(
                        [
                            {
                                "Actif": "Stock achat-revente",
                                "Type": "Achat-revente",
                                "Famille": "resale",
                                "Quantite detenue": None,
                                "Prix unitaire retenu": None,
                                "Valeur actuelle": resale_unsold,
                                "Capital investi net": None,
                                "P/L latent": None,
                                "Derniere valorisation": None,
                            }
                        ]
                    ),
                ],
                ignore_index=True,
            )
        st.dataframe(display, use_container_width=True)
    else:
        st.dataframe(
            [
                {
                    "Actif": "Stock achat-revente",
                    "Type": "Achat-revente",
                    "Famille": "resale",
                    "Valeur actuelle": resale_unsold,
                }
            ],
            use_container_width=True,
        )

    st.markdown("### 🏷️ Ajouter une valorisation manuelle")
    asset_options = {row["name_asset"]: int(row["asset_id"]) for _, row in get_assets().iterrows()}
    if asset_options:
        with st.form("manual_valuation_form"):
            col1, col2, col3 = st.columns(3)
            with col1:
                asset_name = st.selectbox("Actif a valoriser", list(asset_options.keys()))
            with col2:
                valuation_date = st.date_input("Date de valorisation", datetime.date.today(), key="valuation_date_picker")
            with col3:
                unit_price = st.number_input("Prix unitaire", min_value=0.0, step=0.01, format="%.4f", key="manual_unit_price")
            total_value = st.number_input("Valeur totale optionnelle", min_value=0.0, step=0.01, format="%.2f")

            if st.form_submit_button("💾 Enregistrer la valorisation"):
                with engine.begin() as conn:
                    conn.execute(
                        text(
                            """
                            INSERT INTO asset_valuation (asset_id, valuation_date, unit_price, total_value, value_source)
                            VALUES (:asset_id, :valuation_date, :unit_price, :total_value, 'manual')
                            ON CONFLICT (asset_id, valuation_date, value_source)
                            DO UPDATE
                            SET unit_price = EXCLUDED.unit_price,
                                total_value = EXCLUDED.total_value
                            """
                        ),
                        {
                            "asset_id": int(asset_options[asset_name]),
                            "valuation_date": valuation_date,
                            "unit_price": float(unit_price),
                            "total_value": float(total_value) if total_value > 0 else None,
                        },
                    )
                st.success("✅ Valorisation manuelle enregistree")

    st.markdown("### 🔄 Actualiser les prix de marche")
    st.caption("Pour les actions, ETF ou crypto, renseigne un ticker compatible Yahoo Finance comme `MC.PA` ou `BTC-EUR`.")
    if st.button("Mettre a jour les actifs cotes"):
        updated, messages = refresh_market_prices()
        if updated:
            st.success(f"✅ {updated} actif(s) valorise(s) automatiquement")
        for message in messages:
            st.write(f"- {message}")

    if not invested_assets.empty:
        by_type = invested_assets.groupby("asset_type", as_index=False)["invested_net"].sum().sort_values("invested_net", ascending=False)
        st.markdown("### 🧭 Repartition du capital investi")
        st.bar_chart(by_type.set_index("asset_type"))
