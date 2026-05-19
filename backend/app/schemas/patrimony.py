from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class PhysicalAssetCreate(BaseModel):
    name_asset: str = Field(min_length=1)
    estimated_value: Decimal = Field(gt=0)
    valuation_date: date
    notes: str | None = None


class CashAssetCreate(BaseModel):
    name_asset: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    valuation_date: date
    notes: str | None = None


class MarketAssetCreate(BaseModel):
    name_asset: str = Field(min_length=1)
    ticker: str = Field(min_length=1)
    asset_type_code: str = "STOCK"
    quantity: Decimal = Field(gt=0)
    buy_unit_price: Decimal = Field(ge=0)
    valuation_date: date
    notes: str | None = None


class AssetUpdate(BaseModel):
    name_asset: str = Field(min_length=1)
    estimated_value: Decimal = Field(gt=0)
    valuation_date: date
    notes: str | None = None


class CreatedAsset(BaseModel):
    asset_id: int
    name_asset: str


class WalletBtcMovement(BaseModel):
    txid: str | None = None
    movement_date: date
    quantity_btc: Decimal
    historical_unit_price_eur: Decimal | None = None
    estimated_total_eur: Decimal | None = None


class WalletBtcEstimate(BaseModel):
    address: str
    asset_name: str
    ticker: str
    current_balance_btc: Decimal
    incoming_quantity_btc: Decimal
    outgoing_quantity_btc: Decimal
    average_buy_price_eur: Decimal
    estimated_cost_basis_eur: Decimal
    current_unit_price_eur: Decimal
    current_value_eur: Decimal
    unrealized_pnl_eur: Decimal
    movement_count: int
    warnings: list[str]
    movements: list[WalletBtcMovement]


class LedgerCsvMovement(BaseModel):
    txid: str | None = None
    movement_date: date
    quantity: Decimal
    historical_unit_price_eur: Decimal | None = None
    estimated_total_eur: Decimal | None = None
    account_name: str
    operation_type: str


class LedgerCsvEstimate(BaseModel):
    asset_ticker: str
    yahoo_symbol: str
    current_quantity: Decimal
    incoming_quantity: Decimal
    outgoing_quantity: Decimal
    average_buy_price_eur: Decimal
    estimated_cost_basis_eur: Decimal
    current_unit_price_eur: Decimal
    current_value_eur: Decimal
    unrealized_pnl_eur: Decimal
    movement_count: int
    warnings: list[str]
    movements: list[LedgerCsvMovement]
