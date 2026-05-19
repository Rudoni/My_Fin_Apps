from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.investment_plan import InvestmentPlanSummary
from app.services.investment_plan import get_investment_plan


router = APIRouter(prefix="/investment-plan", tags=["investment-plan"])


@router.get("/summary", response_model=InvestmentPlanSummary)
def investment_plan_summary(
    safety_months: Decimal = Query(default=Decimal("4"), ge=Decimal("0")),
    comfort_buffer: Decimal = Query(default=Decimal("500"), ge=Decimal("0")),
    planned_purchase: Decimal = Query(default=Decimal("0"), ge=Decimal("0")),
    income_stop_date: date | None = Query(default=date(2026, 10, 1)),
    no_income_months: Decimal = Query(default=Decimal("6"), ge=Decimal("0")),
    pokemon_war_chest_target: Decimal = Query(default=Decimal("0"), ge=Decimal("0")),
    pokemon_event_date: date | None = Query(default=date(2026, 10, 1)),
    db: Session = Depends(get_db),
):
    return get_investment_plan(
        db,
        safety_months=safety_months,
        comfort_buffer=comfort_buffer,
        planned_purchase=planned_purchase,
        income_stop_date=income_stop_date,
        no_income_months=no_income_months,
        pokemon_war_chest_target=pokemon_war_chest_target,
        pokemon_event_date=pokemon_event_date,
    )
