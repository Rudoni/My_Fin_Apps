from decimal import Decimal

from pydantic import BaseModel


class InvestmentPlanSummary(BaseModel):
    avg_monthly_income: Decimal
    avg_monthly_expense: Decimal
    avg_monthly_cashflow: Decimal
    cash_available: Decimal
    safety_target: Decimal
    jobless_safety_target: Decimal
    protected_cash_target: Decimal
    cash_above_safety: Decimal
    opportunity_cash: Decimal
    pokemon_war_chest_target: Decimal
    monthly_pokemon_saving_needed: Decimal
    monthly_security_saving_needed: Decimal
    months_until_income_stop: int
    months_until_pokemon_event: int
    planned_purchase: Decimal
    cash_after_purchase: Decimal
    safety_months_after_purchase: Decimal
    pokemon_month_spend: Decimal
    status: str
    message: str
