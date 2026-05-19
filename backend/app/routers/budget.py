from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.current_user import get_current_user_id
from app.core.db import get_db
from app.schemas.budget import (
    AllocationCreate,
    AllocationRead,
    AllocationUpdate,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    IncomeCreate,
    IncomeRead,
    IncomeUpdate,
    OptionItem,
)
from app.services.budget import has_budget_allocation_table, list_budget_years, years_clause


router = APIRouter(tags=["budget"])


def get_expense_row(db: Session, expense_id: int):
    return db.execute(
        text(
            """
            SELECT
                e.expense_id,
                e.description_expense,
                e.price,
                e.expense_date,
                e.subcategory_id,
                s.name_subcat AS subcategory,
                c.name_cat AS category,
                e.payment_method_id,
                pm.name_payment AS payment_method
            FROM expenses e
            JOIN subcategory s ON s.subcategory_id = e.subcategory_id
            JOIN category c ON c.category_id = s.category_id
            JOIN payment_method pm ON pm.id = e.payment_method_id
            WHERE e.expense_id = :expense_id
              AND e.user_id = :user_id
            """
        ),
        {"expense_id": expense_id, "user_id": get_current_user_id(db)},
    ).mappings().first()


@router.get("/budget/options/subcategories", response_model=list[OptionItem])
def list_subcategories(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT subcategory_id AS id, name_subcat AS name FROM subcategory ORDER BY name_subcat")).mappings()
    return list(rows)


@router.get("/budget/options/payment-methods", response_model=list[OptionItem])
def list_payment_methods(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, name_payment AS name FROM payment_method ORDER BY name_payment")).mappings()
    return list(rows)


@router.get("/budget/years", response_model=list[int])
def list_years(db: Session = Depends(get_db)):
    return list_budget_years(db)


@router.get("/budget/incomes", response_model=list[IncomeRead])
def list_incomes(years: list[int] | None = Query(default=None), db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    rows = db.execute(
        text(
            f"""
            SELECT income_id, description_income, amount, income_date, income_type
            FROM incomes
            {years_clause('income_date', years)}
            ORDER BY income_date DESC, income_id DESC
            """
        ),
        {"years": years or [], "user_id": user_id},
    ).mappings()
    return list(rows)


@router.get("/budget/allocations", response_model=list[AllocationRead])
def list_allocations(years: list[int] | None = Query(default=None), db: Session = Depends(get_db)):
    if not has_budget_allocation_table(db):
        return []
    user_id = get_current_user_id(db)
    rows = db.execute(
        text(
            f"""
            SELECT allocation_id, description_allocation, amount, allocation_date, allocation_group, allocation_target, notes
            FROM budget_allocation
            {years_clause('allocation_date', years)}
            ORDER BY allocation_date DESC, allocation_id DESC
            """
        ),
        {"years": years or [], "user_id": user_id},
    ).mappings()
    return list(rows)


@router.post("/budget/incomes", response_model=IncomeRead, status_code=status.HTTP_201_CREATED)
def create_income(payload: IncomeCreate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    row = db.execute(
        text(
            """
            INSERT INTO incomes (user_id, description_income, amount, income_date, income_type)
            VALUES (:user_id, :description_income, :amount, :income_date, :income_type)
            RETURNING income_id, description_income, amount, income_date, income_type
            """
        ),
        {**payload.model_dump(), "user_id": user_id},
    ).mappings().one()
    db.commit()
    return row


@router.post("/budget/allocations", response_model=AllocationRead, status_code=status.HTTP_201_CREATED)
def create_allocation(payload: AllocationCreate, db: Session = Depends(get_db)):
    if not has_budget_allocation_table(db):
        raise HTTPException(status_code=400, detail="La table budget_allocation n'existe pas encore. Relance init.sql.")
    user_id = get_current_user_id(db)
    row = db.execute(
        text(
            """
            INSERT INTO budget_allocation (
                user_id,
                description_allocation,
                amount,
                allocation_date,
                allocation_group,
                allocation_target,
                notes
            )
            VALUES (
                :user_id,
                :description_allocation,
                :amount,
                :allocation_date,
                :allocation_group,
                :allocation_target,
                :notes
            )
            RETURNING allocation_id, description_allocation, amount, allocation_date, allocation_group, allocation_target, notes
            """
        ),
        {**payload.model_dump(), "user_id": user_id},
    ).mappings().one()
    db.commit()
    return row


@router.patch("/budget/incomes/{income_id}", response_model=IncomeRead)
def update_income(income_id: int, payload: IncomeUpdate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    current = db.execute(text("SELECT * FROM incomes WHERE income_id = :id AND user_id = :user_id"), {"id": income_id, "user_id": user_id}).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="Income not found")
    data = dict(current)
    data.update({key: value for key, value in payload.model_dump(exclude_unset=True).items() if value is not None})
    row = db.execute(
        text(
            """
            UPDATE incomes
            SET description_income = :description_income,
                amount = :amount,
                income_date = :income_date,
                income_type = :income_type
            WHERE income_id = :income_id
            RETURNING income_id, description_income, amount, income_date, income_type
            """
        ),
        {**data, "income_id": income_id},
    ).mappings().one()
    db.commit()
    return row


@router.patch("/budget/allocations/{allocation_id}", response_model=AllocationRead)
def update_allocation(allocation_id: int, payload: AllocationUpdate, db: Session = Depends(get_db)):
    if not has_budget_allocation_table(db):
        raise HTTPException(status_code=400, detail="La table budget_allocation n'existe pas encore. Relance init.sql.")
    user_id = get_current_user_id(db)
    current = db.execute(text("SELECT * FROM budget_allocation WHERE allocation_id = :id AND user_id = :user_id"), {"id": allocation_id, "user_id": user_id}).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="Allocation not found")
    data = dict(current)
    data.update({key: value for key, value in payload.model_dump(exclude_unset=True).items()})
    row = db.execute(
        text(
            """
            UPDATE budget_allocation
            SET description_allocation = :description_allocation,
                amount = :amount,
                allocation_date = :allocation_date,
                allocation_group = :allocation_group,
                allocation_target = :allocation_target,
                notes = :notes
            WHERE allocation_id = :allocation_id
            RETURNING allocation_id, description_allocation, amount, allocation_date, allocation_group, allocation_target, notes
            """
        ),
        {**data, "allocation_id": allocation_id},
    ).mappings().one()
    db.commit()
    return row


@router.delete("/budget/incomes/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    result = db.execute(text("DELETE FROM incomes WHERE income_id = :id AND user_id = :user_id"), {"id": income_id, "user_id": get_current_user_id(db)})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Income not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/budget/allocations/{allocation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allocation(allocation_id: int, db: Session = Depends(get_db)):
    if not has_budget_allocation_table(db):
        raise HTTPException(status_code=400, detail="La table budget_allocation n'existe pas encore. Relance init.sql.")
    result = db.execute(text("DELETE FROM budget_allocation WHERE allocation_id = :id AND user_id = :user_id"), {"id": allocation_id, "user_id": get_current_user_id(db)})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/budget/expenses", response_model=list[ExpenseRead])
def list_expenses(years: list[int] | None = Query(default=None), db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    rows = db.execute(
        text(
            f"""
            SELECT
                e.expense_id,
                e.description_expense,
                e.price,
                e.expense_date,
                e.subcategory_id,
                s.name_subcat AS subcategory,
                c.name_cat AS category,
                e.payment_method_id,
                pm.name_payment AS payment_method
            FROM expenses e
            JOIN subcategory s ON s.subcategory_id = e.subcategory_id
            JOIN category c ON c.category_id = s.category_id
            JOIN payment_method pm ON pm.id = e.payment_method_id
            {years_clause('e.expense_date', years)}
            ORDER BY e.expense_date DESC, e.expense_id DESC
            """
        ),
        {"years": years or [], "user_id": user_id},
    ).mappings()
    return list(rows)


@router.post("/budget/expenses", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    expense_id = db.execute(
        text(
            """
            INSERT INTO expenses (user_id, description_expense, price, expense_date, subcategory_id, payment_method_id)
            VALUES (:user_id, :description_expense, :price, :expense_date, :subcategory_id, :payment_method_id)
            RETURNING expense_id
            """
        ),
        {**payload.model_dump(), "user_id": user_id},
    ).scalar_one()
    db.commit()
    row = get_expense_row(db, expense_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return row


@router.patch("/budget/expenses/{expense_id}", response_model=ExpenseRead)
def update_expense(expense_id: int, payload: ExpenseUpdate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    current = db.execute(text("SELECT * FROM expenses WHERE expense_id = :id AND user_id = :user_id"), {"id": expense_id, "user_id": user_id}).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    data = dict(current)
    data.update({key: value for key, value in payload.model_dump(exclude_unset=True).items() if value is not None})
    db.execute(
        text(
            """
            UPDATE expenses
            SET description_expense = :description_expense,
                price = :price,
                expense_date = :expense_date,
                subcategory_id = :subcategory_id,
                payment_method_id = :payment_method_id
            WHERE expense_id = :expense_id
            """
        ),
        {**data, "expense_id": expense_id},
    )
    db.commit()
    row = get_expense_row(db, expense_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return row


@router.delete("/budget/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    result = db.execute(text("DELETE FROM expenses WHERE expense_id = :id AND user_id = :user_id"), {"id": expense_id, "user_id": get_current_user_id(db)})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
