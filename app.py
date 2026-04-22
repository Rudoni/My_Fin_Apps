import streamlit as st

from core.db import table_exists
from pages.assets_page.page import render as render_assets_page
from pages.cashflow_page.page import render as render_cashflow_page
from pages.categories_page.page import render as render_categories_page
from pages.dashboard_page.page import render as render_dashboard_page
from pages.expenses_by_category_page.page import render as render_expenses_by_category_page
from pages.expenses_by_month_page.page import render as render_expenses_by_month_page
from pages.import_expenses_page.page import render as render_import_expenses_page
from pages.income_page.page import render as render_income_page
from pages.limits_page.page import render as render_limits_page
from pages.monthly_pilotage_page.page import render as render_monthly_pilotage_page
from pages.net_worth_page.page import render as render_net_worth_page
from pages.resale_page.page import render as render_resale_page
from pages.subscriptions_page.page import render as render_subscriptions_page


st.set_page_config(page_title="My Fin Apps", layout="wide")
st.sidebar.title("My Fin Apps")
st.sidebar.caption("Budget, patrimoine et investissements")

page = st.sidebar.radio(
    "Navigation",
    [
        "🏠 Dashboard",
        "📥 Import & Depenses",
        "📂 Categories & Sous-categories",
        "📅 Depenses par Mois",
        "📚 Depenses par Categorie",
        "💰 Revenus",
        "📏 Limites par Sous-categorie",
        "📺 Abonnements",
        "📈 Cashflow",
        "👟 Achat-revente",
        "🧱 Investissements & Actifs",
        "🏦 Patrimoine",
        "🧮 Pilotage mensuel",
    ],
)

legacy_required_tables = [
    "category",
    "subcategory",
    "payment_method",
    "expenses",
    "incomes",
    "limits",
    "abonnement",
]
asset_required_tables = [
    "asset_type",
    "asset_account",
    "asset",
    "asset_transaction",
    "asset_valuation",
]
resale_required_tables = ["resale_item"]

missing_legacy_tables = [table for table in legacy_required_tables if not table_exists(table)]

if missing_legacy_tables:
    st.error(
        "Il manque des tables historiques en base. L'application ne peut pas tourner correctement tant qu'elles ne sont pas creees.\n\n"
        f"Tables manquantes: {', '.join(missing_legacy_tables)}"
    )
elif page == "🏠 Dashboard":
    render_dashboard_page()
elif page == "📥 Import & Depenses":
    render_import_expenses_page()
elif page == "📂 Categories & Sous-categories":
    render_categories_page()
elif page == "📅 Depenses par Mois":
    render_expenses_by_month_page()
elif page == "📚 Depenses par Categorie":
    render_expenses_by_category_page()
elif page == "💰 Revenus":
    render_income_page()
elif page == "📏 Limites par Sous-categorie":
    render_limits_page()
elif page == "📺 Abonnements":
    render_subscriptions_page()
elif page == "📈 Cashflow":
    render_cashflow_page()
elif page == "👟 Achat-revente":
    missing_resale_tables = [table for table in resale_required_tables if not table_exists(table)]
    if missing_resale_tables:
        st.warning(
            "La table dediee a l'achat-revente n'est pas encore installee.\n\n"
            "Relance `init.sql` pour activer cette page.\n\n"
            f"Tables manquantes: {', '.join(missing_resale_tables)}"
        )
    else:
        render_resale_page()
elif page in {"🧱 Investissements & Actifs", "🏦 Patrimoine", "🧮 Pilotage mensuel"}:
    missing_asset_tables = [table for table in asset_required_tables if not table_exists(table)]
    if missing_asset_tables:
        st.warning(
            "Les nouvelles tables patrimoine/investissements ne sont pas encore installees.\n\n"
            "Tes donnees existantes ne sont pas touchees. Quand tu veux activer cette partie, execute `init.sql`.\n\n"
            f"Tables manquantes: {', '.join(missing_asset_tables)}"
        )
    elif page == "🧱 Investissements & Actifs":
        render_assets_page()
    elif page == "🏦 Patrimoine":
        render_net_worth_page()
    elif page == "🧮 Pilotage mensuel":
        render_monthly_pilotage_page()
