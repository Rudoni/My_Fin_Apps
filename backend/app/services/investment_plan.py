from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session


def money(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def get_average_monthly_budget(db: Session) -> tuple[Decimal, Decimal]:
    rows = db.execute(
        text(
            """
            WITH monthly_income AS (
                SELECT DATE_TRUNC('month', income_date)::date AS month, SUM(amount) AS amount
                FROM incomes
                WHERE income_date IS NOT NULL
                GROUP BY month
            ),
            monthly_expense AS (
                SELECT DATE_TRUNC('month', expense_date)::date AS month, SUM(price) AS amount
                FROM expenses
                WHERE expense_date IS NOT NULL
                GROUP BY month
            ),
            months AS (
                SELECT month FROM monthly_income
                UNION
                SELECT month FROM monthly_expense
                ORDER BY month DESC
                LIMIT 6
            )
            SELECT
                COALESCE(AVG(COALESCE(i.amount, 0)), 0) AS avg_income,
                COALESCE(AVG(COALESCE(e.amount, 0)), 0) AS avg_expense
            FROM months m
            LEFT JOIN monthly_income i ON i.month = m.month
            LEFT JOIN monthly_expense e ON e.month = m.month
            """
        )
    ).mappings().first()
    if row := rows:
        return money(row["avg_income"]), money(row["avg_expense"])
    return Decimal("0"), Decimal("0")


def get_cash_available(db: Session) -> Decimal:
    return money(
        db.execute(
            text(
                """
                SELECT COALESCE(SUM(COALESCE(v.total_value, 0)), 0)
                FROM asset a
                JOIN asset_type t ON t.asset_type_id = a.asset_type_id
                LEFT JOIN (
                    SELECT DISTINCT ON (asset_id)
                        asset_id,
                        total_value
                    FROM asset_valuation
                    ORDER BY asset_id, valuation_date DESC, valuation_id DESC
                ) v ON v.asset_id = a.asset_id
                WHERE a.is_active = TRUE
                  AND t.code = 'CASH'
                """
            )
        ).scalar_one()
    )


def get_pokemon_month_spend(db: Session) -> Decimal:
    today = date.today()
    return money(
        db.execute(
            text(
                """
                SELECT COALESCE(SUM(purchase_price * pair_count), 0)
                FROM resale_item
                WHERE purchase_date >= DATE_TRUNC('month', CURRENT_DATE)::date
                  AND purchase_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
                  AND resale_category IN ('Pokemon', 'TCG')
                """
            ),
            {"year": today.year, "month": today.month},
        ).scalar_one()
    )


def months_until(target_date: date) -> int:
    today = date.today()
    month_delta = (target_date.year - today.year) * 12 + target_date.month - today.month
    if target_date.day > today.day:
        month_delta += 1
    return max(month_delta, 0)


def get_investment_plan(
    db: Session,
    safety_months: Decimal = Decimal("4"),
    comfort_buffer: Decimal = Decimal("500"),
    planned_purchase: Decimal = Decimal("0"),
    income_stop_date: date | None = None,
    no_income_months: Decimal = Decimal("6"),
    pokemon_war_chest_target: Decimal = Decimal("0"),
    pokemon_event_date: date | None = None,
) -> dict:
    avg_income, avg_expense = get_average_monthly_budget(db)
    cash_available = get_cash_available(db)
    safety_target = avg_expense * safety_months
    jobless_safety_target = avg_expense * no_income_months
    survival_target = max(safety_target, jobless_safety_target)
    protected_cash_target = survival_target + comfort_buffer + pokemon_war_chest_target
    cash_above_safety = cash_available - protected_cash_target
    opportunity_cash = max(cash_above_safety, Decimal("0"))
    cash_after_purchase = cash_available - planned_purchase
    safety_months_after_purchase = cash_after_purchase / avg_expense if avg_expense > 0 else Decimal("0")
    pokemon_month_spend = get_pokemon_month_spend(db)
    income_stop_months = months_until(income_stop_date) if income_stop_date else 0
    pokemon_event_months = months_until(pokemon_event_date) if pokemon_event_date else 0
    security_gap = max(protected_cash_target - cash_available, Decimal("0"))
    monthly_security_saving_needed = security_gap / income_stop_months if income_stop_months > 0 else security_gap
    monthly_pokemon_saving_needed = (
        pokemon_war_chest_target / pokemon_event_months if pokemon_event_months > 0 else pokemon_war_chest_target
    )

    if planned_purchase <= opportunity_cash:
        status = "green"
        message = "Feu vert: tu peux acheter sans toucher a ta securite octobre ni a ton coffre Pokemon."
    elif cash_after_purchase >= protected_cash_target:
        status = "orange"
        message = "Feu orange: tu utilises presque toute la marge, mais les poches protegees restent intactes."
    else:
        status = "red"
        message = "Feu rouge: cet achat attaque ta securite ou ton coffre Pokemon. Il faut arbitrer consciemment."

    return {
        "avg_monthly_income": avg_income,
        "avg_monthly_expense": avg_expense,
        "avg_monthly_cashflow": avg_income - avg_expense,
        "cash_available": cash_available,
        "safety_target": safety_target,
        "jobless_safety_target": jobless_safety_target,
        "protected_cash_target": protected_cash_target,
        "cash_above_safety": cash_above_safety,
        "opportunity_cash": opportunity_cash,
        "pokemon_war_chest_target": pokemon_war_chest_target,
        "monthly_pokemon_saving_needed": monthly_pokemon_saving_needed,
        "monthly_security_saving_needed": monthly_security_saving_needed,
        "months_until_income_stop": income_stop_months,
        "months_until_pokemon_event": pokemon_event_months,
        "planned_purchase": planned_purchase,
        "cash_after_purchase": cash_after_purchase,
        "safety_months_after_purchase": safety_months_after_purchase,
        "pokemon_month_spend": pokemon_month_spend,
        "status": status,
        "message": message,
    }
