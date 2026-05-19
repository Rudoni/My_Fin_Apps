from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import TimeMetric


class BrocanteCategory(BaseModel):
    id: int
    name: str


class BrocanteCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class BrocanteItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brocante_category_id: int
    inventory_group: str = "bulk"
    ownership_mode: str = "solo"
    card_type: str = ""
    target_sale_unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    minimum_sale_unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None


class BrocanteItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    brocante_category_id: int | None = None
    inventory_group: str | None = None
    ownership_mode: str | None = None
    card_type: str | None = None
    target_sale_unit_price: Decimal | None = Field(default=None, ge=0)
    minimum_sale_unit_price: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class BrocanteMovementCreate(BaseModel):
    brocante_item_id: int
    quantity: int = Field(gt=0)
    total_amount: Decimal = Field(ge=0)
    movement_date: date
    notes: str | None = None


class BrocanteSaleUpdate(BaseModel):
    total_amount: Decimal = Field(ge=0)
    movement_date: date
    notes: str | None = None


class BrocanteItemRead(BaseModel):
    brocante_item_id: int
    name: str
    category: str
    inventory_group: str
    ownership_mode: str
    ownership_share: Decimal
    card_type: str
    target_sale_unit_price: Decimal
    minimum_sale_unit_price: Decimal
    stock_quantity: int
    purchased_quantity: int
    sold_quantity: int
    last_purchase_date: date | None = None
    last_sale_date: date | None = None
    purchase_total: Decimal
    sales_total: Decimal
    average_buy_unit_price: Decimal
    remaining_cost_basis: Decimal
    target_stock_value: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    notes: str | None = None


class BrocanteSummary(BaseModel):
    reference_count: int
    stock_quantity: int
    purchase_total: Decimal
    sales_total: Decimal
    remaining_cost_basis: Decimal
    target_stock_value: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    break_even_remaining: Decimal
    break_even_progress_pct: Decimal
    break_even_possible_with_target: bool
    realized_pnl_by_day_current_month: list[TimeMetric]
