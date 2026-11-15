from fastapi import HTTPException
from sqlalchemy import text


def validate_category(db, user_id: int, category_id: int, allow_hidden: bool = False):
    row = db.execute(text("""
        SELECT s.subcategory_id FROM subcategory s
        WHERE s.subcategory_id = :id AND (s.user_id IS NULL OR s.user_id = :user_id)
        AND (:allow_hidden OR NOT EXISTS (
            SELECT 1 FROM hidden_expense_category h
            WHERE h.user_id = :user_id AND h.subcategory_id = s.subcategory_id
        ))
    """), {"id": category_id, "user_id": user_id, "allow_hidden": allow_hidden}).scalar()
    if not row:
        raise HTTPException(status_code=422, detail="Catégorie indisponible. Choisis une catégorie active de ton compte.")
