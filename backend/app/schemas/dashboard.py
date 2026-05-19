from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import NameMetric, TimeMetric
from app.schemas.resale import CategoryMetric


class BudgetSummary(BaseModel):
    income_total: Decimal
    complementary_income_total: Decimal
    total_income_with_complementary: Decimal
    expense_total: Decimal
    allocation_total: Decimal
    resale_purchase_total: Decimal
    investment_effort_total: Decimal
    cashflow_total: Decimal
    cashflow_with_complementary: Decimal
    cashflow_after_allocations: Decimal
    income_by_month: list[TimeMetric]
    complementary_income_by_month: list[TimeMetric]
    income_with_complementary_by_month: list[TimeMetric]
    expense_by_month: list[TimeMetric]
    expense_by_category: list[NameMetric]
    allocation_by_month: list[TimeMetric]
    resale_purchase_by_month: list[TimeMetric]
    investment_effort_by_month: list[TimeMetric]
    allocation_by_group: list[NameMetric]


class PatrimonyAsset(BaseModel):
    asset_id: int | None = None
    name: str
    type: str
    group: str
    value: Decimal
    invested_net: Decimal
    reference_date: date | None = None
    notes: str | None = None


class PatrimonySummary(BaseModel):
    total_value: Decimal
    total_invested: Decimal
    unrealized_pnl: Decimal
    by_group: list[NameMetric]
    assets: list[PatrimonyAsset]


class DashboardSummary(BaseModel):
    budget: BudgetSummary
    patrimony: PatrimonySummary
    patrimony_timeline: list[TimeMetric]
    patrimony_invested_timeline: list[TimeMetric]
    patrimony_cumulative_invested_timeline: list[TimeMetric]
    resale_ca_total: Decimal
    resale_benefit_total: Decimal
    resale_unsold_value: Decimal
    resale_by_category: list[CategoryMetric]
