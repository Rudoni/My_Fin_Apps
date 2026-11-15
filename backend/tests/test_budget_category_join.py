import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.current_user import set_current_user
from app.routers import budget as routes
from app.services import budget


class BudgetCategoryJoinTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        self.db = Session(self.engine)
        set_current_user(self.db, 1)
        for sql in [
            "CREATE TABLE incomes (amount INTEGER, income_date DATE, income_type TEXT, user_id INTEGER)",
            "CREATE TABLE expenses (expense_id INTEGER, price INTEGER, expense_date DATE, description_expense TEXT, subcategory_id INTEGER, payment_method_id INTEGER, user_id INTEGER)",
            "CREATE TABLE subcategory (subcategory_id INTEGER, category_id INTEGER, name_subcat TEXT, user_id INTEGER)",
            "CREATE TABLE category (category_id INTEGER, name_cat TEXT)",
            "CREATE TABLE payment_method (id INTEGER, name_payment TEXT)",
            "CREATE TABLE recurring_expense_occurrence (expense_id INTEGER)",
            "INSERT INTO category VALUES (1, 'Loisirs')",
            "INSERT INTO subcategory VALUES (1, 1, 'Shared', NULL), (2, 1, 'Personal', 1)",
            "INSERT INTO payment_method VALUES (1, 'Carte')",
            "INSERT INTO expenses VALUES (1, 25, NULL, 'Shared expense', 1, 1, 1), (2, 30, NULL, 'Personal expense', 2, 1, 1), (3, 999, NULL, 'Other user', 1, 1, 2)",
        ]:
            self.db.execute(text(sql))

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_summary_with_shared_and_personal_categories(self):
        with (
            patch.object(budget, "materialize"),
            patch.object(budget, "get_resale_summary", return_value=SimpleNamespace(benefit_total=Decimal(0), benefit_by_month=[])),
            patch.object(budget, "list_resale_items", return_value=[]),
            patch.object(budget, "get_brocante_realized_pnl_by_month", return_value={}),
            patch.object(budget, "has_budget_allocation_table", return_value=False),
        ):
            result = budget.get_budget_summary(self.db)
        self.assertEqual(result["expense_total"], Decimal("55"))
        self.assertEqual(result["expense_by_category"][0].value, Decimal("55"))

    def test_history_filters_expense_owner_not_category_owner(self):
        with patch.object(routes, "materialize"):
            rows = routes.list_expenses(years=None, db=self.db)
        self.assertEqual({row["expense_id"] for row in rows}, {1, 2})

    def test_year_filter_keeps_qualified_owner(self):
        for years in [None, [], [2026]]:
            clause = budget.years_clause("e.expense_date", years, user_column="e.user_id")
            self.assertIn("WHERE e.user_id = :user_id", clause)
            if years:
                self.assertIn("EXTRACT(YEAR FROM e.expense_date)", clause)
        self.assertEqual(budget.years_clause("income_date", None), " WHERE user_id = :user_id")
