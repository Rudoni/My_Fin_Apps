from collections import defaultdict
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.current_user import get_current_user_id
from app.schemas.common import NameMetric, TimeMetric
from app.services.resale import get_summary as get_resale_summary, list_items as list_resale_items


def money(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def years_clause(column_name: str, years: list[int] | None) -> str:
    if not years:
        return f" WHERE user_id = :user_id"
    return f" WHERE user_id = :user_id AND EXTRACT(YEAR FROM {column_name})::int = ANY(:years)"


def has_budget_allocation_table(db: Session) -> bool:
    return bool(db.execute(text("SELECT to_regclass('public.budget_allocation') IS NOT NULL")).scalar())


def get_brocante_realized_pnl_by_month(db: Session, years: list[int] | None = None) -> dict[str, Decimal]:
    params = {"years": years or [], "user_id": get_current_user_id(db)}
    rows = db.execute(
        text(
            f"""
            WITH purchase_totals AS (
                SELECT
                    bm.brocante_item_id,
                    COALESCE(SUM(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.quantity ELSE 0 END), 0) AS purchased_quantity,
                    COALESCE(SUM(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.total_amount * bi.ownership_share ELSE 0 END), 0) AS purchase_total
                FROM brocante_movement bm
                JOIN brocante_item bi ON bi.brocante_item_id = bm.brocante_item_id
                WHERE bi.user_id = :user_id
                GROUP BY bm.brocante_item_id
            )
            SELECT
                TO_CHAR(bm.movement_date, 'YYYY-MM') AS month_label,
                SUM(
                    (bm.total_amount * bi.ownership_share) -
                    CASE
                        WHEN COALESCE(pt.purchased_quantity, 0) > 0
                            THEN bm.quantity * (COALESCE(pt.purchase_total, 0) / pt.purchased_quantity)
                        ELSE 0
                    END
                ) AS realized_pnl
            FROM brocante_movement bm
            JOIN brocante_item bi ON bi.brocante_item_id = bm.brocante_item_id
            LEFT JOIN purchase_totals pt ON pt.brocante_item_id = bm.brocante_item_id
            WHERE bi.is_active = TRUE
              AND bi.user_id = :user_id
              AND bm.movement_type = 'SALE'
              {"AND EXTRACT(YEAR FROM bm.movement_date)::int = ANY(:years)" if years else ""}
            GROUP BY month_label
            ORDER BY month_label ASC
            """
        ),
        params,
    ).mappings().all()
    return {str(row["month_label"]): money(row["realized_pnl"]) for row in rows}


def get_budget_summary(db: Session, years: list[int] | None = None) -> dict:
    params = {"years": years or []}
    user_id = get_current_user_id(db)
    resale_summary = get_resale_summary(db, years=years)
    resale_items = list_resale_items(db, years=years)
    brocante_realized_by_month = get_brocante_realized_pnl_by_month(db, years=years)
    incomes = db.execute(
        text(f"SELECT amount, income_date, income_type FROM incomes{years_clause('income_date', years)}"),
        {**params, "user_id": user_id},
    ).mappings().all()
    allocations = []
    if has_budget_allocation_table(db):
        allocations = db.execute(
            text(
                f"""
                SELECT amount, allocation_date, allocation_group, allocation_target
                FROM budget_allocation
                {years_clause('allocation_date', years)}
                """
            ),
            {**params, "user_id": user_id},
        ).mappings().all()
    expenses = db.execute(
        text(
            f"""
            SELECT e.price, e.expense_date, s.name_subcat, c.name_cat
            FROM expenses e
            JOIN subcategory s ON e.subcategory_id = s.subcategory_id
            JOIN category c ON s.category_id = c.category_id
            {years_clause('e.expense_date', years)}
            """
        ),
        {**params, "user_id": user_id},
    ).mappings().all()

    income_total = sum((money(row["amount"]) for row in incomes), Decimal("0"))
    brocante_complementary_income_total = sum(brocante_realized_by_month.values(), Decimal("0"))
    complementary_income_total = resale_summary.benefit_total + brocante_complementary_income_total
    total_income_with_complementary = income_total + complementary_income_total
    expense_total = sum((money(row["price"]) for row in expenses), Decimal("0"))
    allocation_total = sum((money(row["amount"]) for row in allocations), Decimal("0"))
    resale_purchase_total = sum((item.purchase_total for item in resale_items), Decimal("0"))
    investment_effort_total = allocation_total + resale_purchase_total

    income_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    complementary_income_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    income_with_complementary_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    expense_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    expense_by_category: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    allocation_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    resale_purchase_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    investment_effort_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    allocation_by_group: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for row in incomes:
        if row["income_date"]:
            income_by_month[row["income_date"].strftime("%Y-%m")] += money(row["amount"])

    for row in resale_summary.benefit_by_month:
        complementary_income_by_month[row.label] += money(row.value)

    for month, value in brocante_realized_by_month.items():
        complementary_income_by_month[month] += value

    all_income_months = set(income_by_month.keys()) | set(complementary_income_by_month.keys())
    for month in all_income_months:
        income_with_complementary_by_month[month] = income_by_month[month] + complementary_income_by_month[month]

    for row in expenses:
        if row["expense_date"]:
            expense_by_month[row["expense_date"].strftime("%Y-%m")] += money(row["price"])
        expense_by_category[row["name_cat"]] += money(row["price"])

    for row in allocations:
        if row["allocation_date"]:
            allocation_by_month[row["allocation_date"].strftime("%Y-%m")] += money(row["amount"])
        allocation_by_group[row["allocation_group"]] += money(row["amount"])

    for item in resale_items:
        if item.purchase_date:
            resale_purchase_by_month[item.purchase_date.strftime("%Y-%m")] += item.purchase_total

    all_investment_months = set(allocation_by_month.keys()) | set(resale_purchase_by_month.keys())
    for month in all_investment_months:
        investment_effort_by_month[month] = allocation_by_month[month] + resale_purchase_by_month[month]

    return {
        "income_total": income_total,
        "complementary_income_total": complementary_income_total,
        "total_income_with_complementary": total_income_with_complementary,
        "expense_total": expense_total,
        "allocation_total": allocation_total,
        "resale_purchase_total": resale_purchase_total,
        "investment_effort_total": investment_effort_total,
        "cashflow_total": income_total - expense_total,
        "cashflow_with_complementary": total_income_with_complementary - expense_total,
        "cashflow_after_allocations": total_income_with_complementary - expense_total - allocation_total,
        "income_by_month": [TimeMetric(label=key, value=value) for key, value in sorted(income_by_month.items())],
        "complementary_income_by_month": [
            TimeMetric(label=key, value=value) for key, value in sorted(complementary_income_by_month.items())
        ],
        "income_with_complementary_by_month": [
            TimeMetric(label=key, value=value) for key, value in sorted(income_with_complementary_by_month.items())
        ],
        "expense_by_month": [TimeMetric(label=key, value=value) for key, value in sorted(expense_by_month.items())],
        "allocation_by_month": [TimeMetric(label=key, value=value) for key, value in sorted(allocation_by_month.items())],
        "resale_purchase_by_month": [
            TimeMetric(label=key, value=value) for key, value in sorted(resale_purchase_by_month.items())
        ],
        "investment_effort_by_month": [
            TimeMetric(label=key, value=value) for key, value in sorted(investment_effort_by_month.items())
        ],
        "expense_by_category": [
            NameMetric(name=key, value=value)
            for key, value in sorted(expense_by_category.items(), key=lambda row: row[1], reverse=True)
        ],
        "allocation_by_group": [
            NameMetric(name=key, value=value)
            for key, value in sorted(allocation_by_group.items(), key=lambda row: row[1], reverse=True)
        ],
    }


def list_budget_years(db: Session) -> list[int]:
    user_id = get_current_user_id(db)
    years = set(
        db.execute(
            text(
                """
                SELECT DISTINCT EXTRACT(YEAR FROM income_date)::int AS year
                FROM incomes
                WHERE income_date IS NOT NULL
                  AND user_id = :user_id
                UNION
                SELECT DISTINCT EXTRACT(YEAR FROM expense_date)::int AS year
                FROM expenses
                WHERE expense_date IS NOT NULL
                  AND user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).scalars().all()
    )

    if has_budget_allocation_table(db):
        allocation_years = db.execute(
            text(
                """
                SELECT DISTINCT EXTRACT(YEAR FROM allocation_date)::int AS year
                FROM budget_allocation
                WHERE allocation_date IS NOT NULL
                  AND user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).scalars().all()
        years.update(allocation_years)

    return sorted(years, reverse=True)
