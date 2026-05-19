from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ResaleItem(Base):
    __tablename__ = "resale_item"

    resale_item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pair_name: Mapped[str] = mapped_column(String(200), nullable=False)
    resale_category: Mapped[str] = mapped_column(String(80), nullable=False, default="Autres")
    retail_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_site: Mapped[str | None] = mapped_column(String(160), nullable=True)
    size: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pair_received: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    sale_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sale_site: Mapped[str | None] = mapped_column(String(160), nullable=True)
    pair_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payment_method: Mapped[str | None] = mapped_column(String(120), nullable=True)
    expected_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
