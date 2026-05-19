from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class OptionItem(BaseModel):
    id: int
    name: str


class IncomeRead(BaseModel):
    income_id: int
    description_income: str
    amount: Decimal
    income_date: date
    income_type: str


class IncomeCreate(BaseModel):
    description_income: str = Field(min_length=1)
    amount: Decimal = Field(ge=0)
    income_date: date
    income_type: str = "Autre"


class IncomeUpdate(BaseModel):
    description_income: str | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    income_date: date | None = None
    income_type: str | None = None


class AllocationRead(BaseModel):
    allocation_id: int
    description_allocation: str
    amount: Decimal
    allocation_date: date
    allocation_group: str
    allocation_target: str
    notes: str | None = None


class AllocationCreate(BaseModel):
    description_allocation: str = Field(min_length=1)
    amount: Decimal = Field(ge=0)
    allocation_date: date
    allocation_group: str = "Investissement"
    allocation_target: str = "Bourse"
    notes: str | None = None


class AllocationUpdate(BaseModel):
    description_allocation: str | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    allocation_date: date | None = None
    allocation_group: str | None = None
    allocation_target: str | None = None
    notes: str | None = None


class ExpenseRead(BaseModel):
    expense_id: int
    description_expense: str
    price: Decimal
    expense_date: date
    subcategory_id: int
    subcategory: str
    category: str
    payment_method_id: int
    payment_method: str


class ExpenseCreate(BaseModel):
    description_expense: str = Field(min_length=1)
    price: Decimal = Field(ge=0)
    expense_date: date
    subcategory_id: int
    payment_method_id: int


class ExpenseUpdate(BaseModel):
    description_expense: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    expense_date: date | None = None
    subcategory_id: int | None = None
    payment_method_id: int | None = None
