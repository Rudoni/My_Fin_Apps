from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


RESALE_CATEGORIES = ["Sneakers", "Pokemon", "TCG", "Vyniles", "Sappes", "Autres"]


class ResaleItemBase(BaseModel):
    pair_name: str = Field(min_length=1, max_length=200)
    resale_category: str = "Autres"
    purchase_price: Decimal = Decimal("0")
    purchase_date: date | None = None
    purchase_site: str | None = None
    size: str | None = None
    pair_received: bool = False
    sale_price: Decimal | None = None
    sale_date: date | None = None
    sale_site: str | None = None
    pair_count: int = Field(default=1, ge=1)
    payment_method: str | None = None
    expected_price: Decimal | None = None
    notes: str | None = None


class ResaleItemCreate(ResaleItemBase):
    pass


class ResaleItemUpdate(BaseModel):
    pair_name: str | None = Field(default=None, min_length=1, max_length=200)
    resale_category: str | None = None
    purchase_price: Decimal | None = None
    purchase_date: date | None = None
    purchase_site: str | None = None
    size: str | None = None
    pair_received: bool | None = None
    sale_price: Decimal | None = None
    sale_date: date | None = None
    sale_site: str | None = None
    pair_count: int | None = Field(default=None, ge=1)
    payment_method: str | None = None
    expected_price: Decimal | None = None
    notes: str | None = None


class ResaleItemRead(ResaleItemBase):
    model_config = ConfigDict(from_attributes=True)

    resale_item_id: int
    created_at: datetime
    sale_total: Decimal
    purchase_total: Decimal
    expected_total: Decimal
    benefit: Decimal
    expected_benefit: Decimal
    status: str


class CategoryMetric(BaseModel):
    category: str
    purchase_total: Decimal = Decimal("0")
    ca_total: Decimal = Decimal("0")
    benefit_total: Decimal = Decimal("0")
    margin_rate: Decimal = Decimal("0")
    expected_purchase_total: Decimal = Decimal("0")
    expected_benefit_total: Decimal = Decimal("0")
    expected_margin_rate: Decimal = Decimal("0")
    stock_estimated_value: Decimal = Decimal("0")


class TimeMetric(BaseModel):
    label: str
    value: Decimal


class ResaleSummary(BaseModel):
    ca_total: Decimal
    purchase_count: int
    benefit_total: Decimal
    unrealized_pnl: Decimal
    unsold_value: Decimal
    unsold_count: int
    ca_by_year: list[TimeMetric]
    benefit_by_year: list[TimeMetric]
    benefit_by_month: list[TimeMetric]
    realized_pnl_by_day_current_month: list[TimeMetric]
    by_category: list[CategoryMetric]
