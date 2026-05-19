from decimal import Decimal

from pydantic import BaseModel


class TimeMetric(BaseModel):
    label: str
    value: Decimal


class NameMetric(BaseModel):
    name: str
    value: Decimal

