import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.services.recurring_expenses import due_months, materialize


class MonthTests(unittest.TestCase):
    def test_year_boundary_and_end_month(self):
        self.assertEqual(list(due_months(date(2025, 12, 1), date(2026, 2, 1), date(2026, 4, 15))),
                         [date(2025, 12, 1), date(2026, 1, 1), date(2026, 2, 1)])

    def test_future_start_is_not_due(self):
        self.assertEqual(list(due_months(date(2027, 1, 1), None, date(2026, 11, 8))), [])


@unittest.skipUnless(os.getenv("MY_FIN_TEST_DB_URL"), "Isolated PostgreSQL test database required")
class RecurringIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(os.environ["MY_FIN_TEST_DB_URL"])
        with Session(self.engine) as db:
            self.user_id = db.execute(text("""
                INSERT INTO app_user(email, display_name, password_hash)
                VALUES (:email, 'Test', 'not-a-password') RETURNING user_id
            """), {"email": f"recurring-{os.urandom(6).hex()}@example.test"}).scalar_one()
            self.subcat = db.execute(text("SELECT MIN(subcategory_id) FROM subcategory")).scalar_one()
            self.payment = db.execute(text("SELECT MIN(id) FROM payment_method")).scalar_one()
            self.rule = db.execute(text("""
                INSERT INTO recurring_expense(user_id, description_expense, price, subcategory_id, payment_method_id, start_month, next_month)
                VALUES (:user, 'Rent', 700, :subcat, :payment, '2026-01-01', '2026-01-01')
                RETURNING recurring_expense_id
            """), {"user": self.user_id, "subcat": self.subcat, "payment": self.payment}).scalar_one()
            db.commit()

    def tearDown(self):
        with Session(self.engine) as db:
            db.execute(text("DELETE FROM recurring_expense_occurrence WHERE recurring_expense_id=:id"), {"id": self.rule})
            db.execute(text("DELETE FROM recurring_expense WHERE user_id=:id"), {"id": self.user_id})
            db.execute(text("DELETE FROM expenses WHERE user_id=:id"), {"id": self.user_id})
            db.execute(text("DELETE FROM app_user WHERE user_id=:id"), {"id": self.user_id})
            db.commit()
        self.engine.dispose()

    def generate(self):
        with Session(self.engine) as db:
            materialize(db, self.user_id, date(2026, 3, 10))

    def test_concurrent_generation_and_deleted_occurrence(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: self.generate(), range(2)))
        with Session(self.engine) as db:
            rows = db.execute(text("SELECT expense_id, price, expense_date FROM expenses WHERE user_id=:id ORDER BY expense_date"), {"id": self.user_id}).mappings().all()
            self.assertEqual(len(rows), 3)
            self.assertEqual(sum(row["price"] for row in rows), Decimal("2100"))
            db.execute(text("DELETE FROM expenses WHERE expense_id=:id"), {"id": rows[0]["expense_id"]})
            db.commit()
        self.generate()
        with Session(self.engine) as db:
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM expenses WHERE user_id=:id"), {"id": self.user_id}).scalar_one(), 2)

    def test_inactive_and_user_isolation(self):
        with Session(self.engine) as db:
            materialize(db, -1, date(2026, 3, 1))
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM expenses WHERE user_id=:id"), {"id": self.user_id}).scalar_one(), 0)
            db.execute(text("UPDATE recurring_expense SET is_active=FALSE WHERE recurring_expense_id=:id"), {"id": self.rule})
            db.commit()
        self.generate()
        with Session(self.engine) as db:
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM expenses WHERE user_id=:id"), {"id": self.user_id}).scalar_one(), 0)

    def test_budget_totals_include_recurrences_once(self):
        from app.core.current_user import set_current_user
        from app.services.budget import get_budget_summary
        with Session(self.engine) as db:
            set_current_user(db, self.user_id)
            db.execute(text("UPDATE recurring_expense SET end_month='2026-03-01' WHERE recurring_expense_id=:id"), {"id": self.rule})
            db.execute(text("""
                INSERT INTO expenses(user_id, description_expense, price, expense_date, subcategory_id, payment_method_id)
                VALUES (:user, 'Restaurant', 25, '2026-02-10', :subcat, :payment)
            """), {"user": self.user_id, "subcat": self.subcat, "payment": self.payment})
            db.commit()
            for _ in range(2):
                summary = get_budget_summary(db, years=[2026])
                self.assertEqual(summary["expense_total"], Decimal("2125"))
                self.assertEqual(summary["recurring_expense_total"], Decimal("2100"))
                self.assertEqual(summary["regular_expense_total"], Decimal("25"))

    def test_pause_resume_skips_paused_months_and_rejects_other_user(self):
        from app.core.current_user import set_current_user
        from app.routers.budget import toggle_recurring
        from app.schemas.budget import RecurringExpenseUpdate
        from fastapi import HTTPException
        with Session(self.engine) as db:
            set_current_user(db, self.user_id)
            with patch("app.services.recurring_expenses.current_month", return_value=date(2026, 3, 1)):
                toggle_recurring(self.rule, RecurringExpenseUpdate(is_active=False), db)
            with (
                patch("app.services.recurring_expenses.current_month", return_value=date(2026, 5, 1)),
                patch("app.routers.budget.current_month", return_value=date(2026, 5, 1)),
            ):
                toggle_recurring(self.rule, RecurringExpenseUpdate(is_active=True), db)
                dates = db.execute(text("SELECT expense_date FROM expenses WHERE user_id=:id ORDER BY expense_date"), {"id": self.user_id}).scalars().all()
                self.assertEqual(dates, [date(2026, 1, 1), date(2026, 2, 1), date(2026, 3, 1), date(2026, 5, 1)])
                set_current_user(db, -1)
                with self.assertRaises(HTTPException) as err:
                    toggle_recurring(self.rule, RecurringExpenseUpdate(is_active=False), db)
                self.assertEqual(err.exception.status_code, 404)

    def test_monthly_sales_use_sale_date_quantity_and_common_share(self):
        from app.core.current_user import set_current_user
        from app.services.resale import get_summary as resale_summary
        from app.services.brocante import get_summary as brocante_summary
        with Session(self.engine) as db:
            set_current_user(db, self.user_id)
            db.execute(text("""
                INSERT INTO resale_item(user_id, pair_name, purchase_price, purchase_date, sale_price, sale_date, pair_count)
                VALUES (:user, 'Test', 20, '2025-12-01', 35, '2026-02-10', 2)
            """), {"user": self.user_id})
            resale = resale_summary(db, years=[2026])
            self.assertEqual([(r.label, r.value) for r in resale.ca_by_month], [("2026-02", Decimal("70"))])
            self.assertEqual(resale.benefit_by_month[0].value, Decimal("30"))
            category = db.execute(text("SELECT MIN(brocante_category_id) FROM brocante_category")).scalar_one()
            item = db.execute(text("""
                INSERT INTO brocante_item(user_id, name, brocante_category_id, ownership_mode, ownership_share)
                VALUES (:user, 'Test', :category, 'common', 0.5) RETURNING brocante_item_id
            """), {"user": self.user_id, "category": category}).scalar_one()
            db.execute(text("""
                INSERT INTO brocante_movement(brocante_item_id, movement_type, quantity, total_amount, movement_date)
                VALUES (:item, 'PURCHASE', 2, 40, '2026-01-01'),
                       (:item, 'SALE', 1, 30, '2026-02-01'),
                       (:item, 'SALE', 1, 10, '2026-03-01')
            """), {"item": item})
            brocante = brocante_summary(db, inventory_group="bulk")
            self.assertEqual([r.value for r in brocante["ca_by_month"]], [Decimal("15"), Decimal("5")])
            self.assertEqual([r.value for r in brocante["benefit_by_month"]], [Decimal("5"), Decimal("-5")])
            # Session closes without commit: the sales fixtures are rolled back.
