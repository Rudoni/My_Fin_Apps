import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.routers import budget
from app.services.expense_categories import validate_category


class ExpenseCategoryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        self.db = Session(self.engine)
        for sql in [
            "CREATE TABLE category (category_id INTEGER PRIMARY KEY, name_cat TEXT)",
            "CREATE TABLE subcategory (subcategory_id INTEGER PRIMARY KEY, name_subcat TEXT, category_id INTEGER, user_id INTEGER)",
            "CREATE TABLE hidden_expense_category (user_id INTEGER, subcategory_id INTEGER, PRIMARY KEY(user_id, subcategory_id))",
            "CREATE TABLE recurring_expense (user_id INTEGER, subcategory_id INTEGER, is_active BOOLEAN)",
            "CREATE TABLE expenses (user_id INTEGER, subcategory_id INTEGER, price INTEGER)",
            "INSERT INTO category VALUES (1, 'Loisirs')",
            "INSERT INTO subcategory VALUES (1, 'Restaurant', 1, NULL)",
            "INSERT INTO expenses VALUES (1, 1, 25)",
        ]:
            self.db.execute(text(sql))
        self.db.commit()
        self.user = patch.object(budget, "get_current_user_id", return_value=1)
        self.user.start()

    def tearDown(self):
        self.user.stop()
        self.db.close()
        self.engine.dispose()

    def test_personal_creation_and_cross_account_access(self):
        result = budget.create_expense_category(budget.ExpenseCategoryCreate(name=" Sport ", category_id=1), self.db)
        self.assertEqual(result["name"], "Sport")
        validate_category(self.db, 1, result["id"])
        with self.assertRaises(HTTPException):
            validate_category(self.db, 2, result["id"])
        with patch.object(budget, "get_current_user_id", return_value=2):
            self.assertEqual([row["name"] for row in budget.list_subcategories(self.db)], ["Restaurant"])
            with self.assertRaises(HTTPException):
                budget.hide_expense_category(result["id"], self.db)

    def test_hiding_preserves_history_and_other_users_options(self):
        budget.hide_expense_category(1, self.db)
        self.assertEqual(budget.list_subcategories(self.db), [])
        self.assertEqual(self.db.execute(text("SELECT SUM(price) FROM expenses")).scalar(), 25)
        with patch.object(budget, "get_current_user_id", return_value=2):
            self.assertEqual(len(budget.list_subcategories(self.db)), 1)
        with self.assertRaises(HTTPException):
            validate_category(self.db, 1, 1)
        validate_category(self.db, 1, 1, allow_hidden=True)
        budget.restore_expense_category(1, self.db)
        self.assertEqual(len(budget.list_subcategories(self.db)), 1)

    def test_active_recurring_category_cannot_be_hidden(self):
        self.db.execute(text("INSERT INTO recurring_expense VALUES (1, 1, TRUE)"))
        with self.assertRaises(HTTPException) as error:
            budget.hide_expense_category(1, self.db)
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(len(budget.list_subcategories(self.db)), 1)

    def test_duplicate_and_blank_names_rejected(self):
        with self.assertRaises(ValidationError):
            budget.ExpenseCategoryCreate(name="   ", category_id=1)
        with self.assertRaises(HTTPException) as error:
            budget.create_expense_category(budget.ExpenseCategoryCreate(name="restaurant", category_id=1), self.db)
        self.assertEqual(error.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
