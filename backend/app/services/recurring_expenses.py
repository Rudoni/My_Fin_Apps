from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session


def current_month() -> date:
    return datetime.now(ZoneInfo("Europe/Paris")).date().replace(day=1)


def next_month(value: date) -> date:
    return date(value.year + (value.month == 12), value.month % 12 + 1, 1)


def due_months(start: date, end: date | None, today: date):
    month = start.replace(day=1)
    limit = min(today.replace(day=1), end.replace(day=1) if end else today.replace(day=1))
    while month <= limit:
        yield month
        month = next_month(month)


def materialize(db: Session, user_id: int, today: date | None = None) -> None:
    """Lock each rule; write the expense, occurrence and cursor in one transaction."""
    month = (today or current_month()).replace(day=1)
    rules = db.execute(text("""
        SELECT * FROM recurring_expense
        WHERE user_id = :user_id AND is_active = TRUE AND next_month <= :month
        ORDER BY recurring_expense_id FOR UPDATE
    """), {"user_id": user_id, "month": month}).mappings().all()
    for rule in rules:
        cursor = rule["next_month"]
        for due in due_months(cursor, rule["end_month"], month):
            params = {**dict(rule), "month": due}
            existing = db.execute(text("""
                SELECT 1 FROM recurring_expense_occurrence
                WHERE recurring_expense_id = :recurring_expense_id AND month = :month
            """), params).scalar()
            if not existing:
                expense_id = db.execute(text("""
                    INSERT INTO expenses (user_id, description_expense, price, expense_date, subcategory_id, payment_method_id)
                    VALUES (:user_id, :description_expense, :price, :month, :subcategory_id, :payment_method_id)
                    RETURNING expense_id
                """), params).scalar_one()
                db.execute(text("""
                    INSERT INTO recurring_expense_occurrence (recurring_expense_id, month, expense_id)
                    VALUES (:recurring_expense_id, :month, :expense_id)
                """), {**params, "expense_id": expense_id})
            cursor = next_month(due)
        db.execute(text("""
            UPDATE recurring_expense SET next_month = :next_month,
                is_active = CASE WHEN end_month IS NOT NULL AND :next_month > end_month THEN FALSE ELSE is_active END
            WHERE recurring_expense_id = :id AND user_id = :user_id
        """), {"next_month": cursor, "id": rule["recurring_expense_id"], "user_id": user_id})
    db.commit()


def run_all() -> None:
    from app.core.db import SessionLocal
    with SessionLocal() as db:
        users = db.execute(text("SELECT DISTINCT user_id FROM recurring_expense WHERE is_active = TRUE")).scalars().all()
        for user_id in users:
            materialize(db, user_id)


if __name__ == "__main__":
    run_all()
