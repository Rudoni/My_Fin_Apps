from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.dashboard import BudgetSummary, DashboardSummary, PatrimonySummary
from app.services.brocante import get_summary as get_brocante_summary
from app.services.budget import get_budget_summary
from app.services.patrimony import get_patrimony_summary, get_patrimony_timeline
from app.services.resale import get_summary as get_resale_summary


router = APIRouter(tags=["dashboard"])


@router.get("/budget/summary", response_model=BudgetSummary)
def budget_summary(years: list[int] | None = Query(default=None), db: Session = Depends(get_db)):
    return get_budget_summary(db, years=years)


@router.get("/patrimony/summary", response_model=PatrimonySummary)
def patrimony_summary(db: Session = Depends(get_db)):
    resale = get_resale_summary(db)
    brocante = get_brocante_summary(db, inventory_group=None)
    return get_patrimony_summary(
        db,
        resale.unsold_value,
        brocante["target_stock_value"],
        brocante["remaining_cost_basis"],
        brocante["unrealized_pnl"],
    )


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(years: list[int] | None = Query(default=None), db: Session = Depends(get_db)):
    budget = get_budget_summary(db, years=years)
    resale = get_resale_summary(db, years=years)
    brocante = get_brocante_summary(db, inventory_group=None)
    patrimony_timeline, patrimony_invested_timeline, patrimony_cumulative_invested_timeline = get_patrimony_timeline(db)
    patrimony = get_patrimony_summary(
        db,
        resale.unsold_value,
        brocante["target_stock_value"],
        brocante["remaining_cost_basis"],
        brocante["unrealized_pnl"],
    )

    return {
        "budget": budget,
        "patrimony": patrimony,
        "patrimony_timeline": patrimony_timeline,
        "patrimony_invested_timeline": patrimony_invested_timeline,
        "patrimony_cumulative_invested_timeline": patrimony_cumulative_invested_timeline,
        "resale_ca_total": resale.ca_total,
        "resale_benefit_total": resale.benefit_total,
        "resale_unsold_value": resale.unsold_value,
        "resale_by_category": resale.by_category,
    }
