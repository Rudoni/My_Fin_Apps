from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.current_user import get_current_user_id
from app.models.resale import ResaleItem
from app.schemas.resale import CategoryMetric, ResaleItemCreate, ResaleItemRead, ResaleItemUpdate, ResaleSummary, TimeMetric


VALID_CATEGORIES = {"Sneakers", "Pokemon", "TCG", "Vyniles", "Sappes", "Autres"}


def normalize_category(category: str | None) -> str:
    if category in VALID_CATEGORIES:
        return str(category)
    return "Autres"


def money(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def to_read_model(item: ResaleItem) -> ResaleItemRead:
    purchase_price = money(item.purchase_price)
    sale_price = money(item.sale_price)
    expected_price = money(item.expected_price)
    pair_count = item.pair_count or 1
    purchase_total = purchase_price * pair_count
    sale_total = sale_price * pair_count
    expected_total = expected_price * pair_count
    benefit = sale_total - purchase_total
    expected_benefit = expected_total - purchase_total
    status = "Vendu" if sale_price > 0 else ("Recu" if item.pair_received else "En attente")

    return ResaleItemRead(
        resale_item_id=item.resale_item_id,
        pair_name=item.pair_name,
        resale_category=normalize_category(item.resale_category),
        purchase_price=purchase_price,
        purchase_date=item.purchase_date,
        purchase_site=item.purchase_site,
        size=item.size,
        pair_received=item.pair_received,
        sale_price=item.sale_price,
        sale_date=item.sale_date,
        sale_site=item.sale_site,
        pair_count=pair_count,
        payment_method=item.payment_method,
        expected_price=item.expected_price,
        notes=item.notes,
        created_at=item.created_at,
        sale_total=sale_total,
        purchase_total=purchase_total,
        expected_total=expected_total,
        benefit=benefit,
        expected_benefit=expected_benefit,
        status=status,
    )


def matches_year_filter(item: ResaleItemRead, years: list[int] | None = None) -> bool:
    if not years:
        return True
    item_years = {
        item.purchase_date.year if item.purchase_date else None,
        item.sale_date.year if item.sale_date else None,
    }
    return any(year in item_years for year in years)


def matches_status_filter(item: ResaleItemRead, status_filter: str | None = None) -> bool:
    if not status_filter or status_filter == "all":
        return True
    if status_filter == "sold":
        return item.status == "Vendu"
    if status_filter == "available":
        return item.status != "Vendu"
    return True


def list_items(
    db: Session,
    search: str | None = None,
    category: str | None = None,
    status_filter: str | None = None,
    years: list[int] | None = None,
) -> list[ResaleItemRead]:
    stmt = (
        select(ResaleItem)
        .where(ResaleItem.user_id == get_current_user_id(db))
        .order_by(ResaleItem.purchase_date.desc().nullslast(), ResaleItem.resale_item_id.desc())
    )
    items = list(db.scalars(stmt).all())
    read_items = [to_read_model(item) for item in items]

    if category:
        read_items = [item for item in read_items if item.resale_category == category]

    if status_filter:
        read_items = [item for item in read_items if matches_status_filter(item, status_filter)]

    if years:
        read_items = [item for item in read_items if matches_year_filter(item, years)]

    if search:
        needle = search.lower()
        read_items = [
            item
            for item in read_items
            if needle
            in " ".join(
                [
                    item.pair_name or "",
                    item.sale_site or "",
                    item.purchase_site or "",
                    item.notes or "",
                    item.status or "",
                    item.resale_category or "",
                ]
            ).lower()
        ]

    return read_items


def list_years(db: Session) -> list[int]:
    items = list_items(db)
    years = {
        year
        for item in items
        for year in [item.purchase_date.year if item.purchase_date else None, item.sale_date.year if item.sale_date else None]
        if year is not None
    }
    return sorted(years, reverse=True)


def create_item(db: Session, payload: ResaleItemCreate) -> ResaleItemRead:
    item_data = payload.model_dump()
    item_data["resale_category"] = normalize_category(item_data.get("resale_category"))
    quantity = max(int(item_data.get("pair_count") or 1), 1)

    created_items: list[ResaleItem] = []
    for _ in range(quantity):
        item = ResaleItem(**{**item_data, "pair_count": 1, "user_id": get_current_user_id(db)})
        item.retail_price = None
        db.add(item)
        created_items.append(item)

    db.commit()
    last_item = created_items[-1]
    db.refresh(last_item)
    return to_read_model(last_item)


def update_item(db: Session, item_id: int, payload: ResaleItemUpdate) -> ResaleItemRead | None:
    item = db.scalar(select(ResaleItem).where(ResaleItem.resale_item_id == item_id, ResaleItem.user_id == get_current_user_id(db)))
    if item is None:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    if "resale_category" in update_data:
        update_data["resale_category"] = normalize_category(update_data["resale_category"])
    for key, value in update_data.items():
        setattr(item, key, value)
    item.retail_price = None

    db.commit()
    db.refresh(item)
    return to_read_model(item)


def delete_item(db: Session, item_id: int) -> bool:
    item = db.scalar(select(ResaleItem).where(ResaleItem.resale_item_id == item_id, ResaleItem.user_id == get_current_user_id(db)))
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True


def get_summary(db: Session, years: list[int] | None = None) -> ResaleSummary:
    items = list_items(db, years=years)
    sold_items = [item for item in items if money(item.sale_price) > 0 and (not years or (item.sale_date and item.sale_date.year in years))]
    stock_items = [item for item in items if money(item.sale_price) <= 0 and (not years or (item.purchase_date and item.purchase_date.year in years))]
    today = date.today()

    ca_total = sum((item.sale_total for item in sold_items), Decimal("0"))
    benefit_total = sum((item.benefit for item in sold_items), Decimal("0"))
    unsold_value = sum((item.expected_total for item in stock_items), Decimal("0"))
    unrealized_pnl = sum((item.expected_benefit for item in stock_items), Decimal("0"))

    ca_by_year: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    benefit_by_year: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    benefit_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    realized_pnl_by_day_current_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    by_category: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {
            "purchase_total": Decimal("0"),
            "ca_total": Decimal("0"),
            "benefit_total": Decimal("0"),
            "margin_rate": Decimal("0"),
            "expected_purchase_total": Decimal("0"),
            "expected_benefit_total": Decimal("0"),
            "expected_margin_rate": Decimal("0"),
            "stock_estimated_value": Decimal("0"),
        }
    )

    for item in sold_items:
        if item.sale_date:
            year = str(item.sale_date.year)
            month = item.sale_date.strftime("%Y-%m")
            ca_by_year[year] += item.sale_total
            benefit_by_year[year] += item.benefit
            benefit_by_month[month] += item.benefit
            if item.sale_date.year == today.year and item.sale_date.month == today.month:
                realized_pnl_by_day_current_month[item.sale_date.strftime("%Y-%m-%d")] += item.benefit
        by_category[item.resale_category]["purchase_total"] += item.purchase_total
        by_category[item.resale_category]["ca_total"] += item.sale_total
        by_category[item.resale_category]["benefit_total"] += item.benefit

    for item in stock_items:
        by_category[item.resale_category]["expected_purchase_total"] += item.purchase_total
        by_category[item.resale_category]["expected_benefit_total"] += item.expected_benefit
        by_category[item.resale_category]["stock_estimated_value"] += item.expected_total

    for category_values in by_category.values():
        purchase_total = category_values["purchase_total"]
        category_values["margin_rate"] = (
            (category_values["benefit_total"] / purchase_total) * Decimal("100")
            if purchase_total > 0
            else Decimal("0")
        )
        expected_purchase_total = category_values["expected_purchase_total"]
        category_values["expected_margin_rate"] = (
            (category_values["expected_benefit_total"] / expected_purchase_total) * Decimal("100")
            if expected_purchase_total > 0
            else Decimal("0")
        )

    return ResaleSummary(
        ca_total=ca_total,
        purchase_count=len(items),
        benefit_total=benefit_total,
        unrealized_pnl=unrealized_pnl,
        unsold_value=unsold_value,
        unsold_count=len(stock_items),
        ca_by_year=[TimeMetric(label=key, value=value) for key, value in sorted(ca_by_year.items())],
        benefit_by_year=[TimeMetric(label=key, value=value) for key, value in sorted(benefit_by_year.items())],
        benefit_by_month=[TimeMetric(label=key, value=value) for key, value in sorted(benefit_by_month.items())],
        realized_pnl_by_day_current_month=[
            TimeMetric(label=key, value=value) for key, value in sorted(realized_pnl_by_day_current_month.items())
        ],
        by_category=[
            CategoryMetric(category=category, **values)
            for category, values in sorted(by_category.items(), key=lambda row: row[0])
        ],
    )
