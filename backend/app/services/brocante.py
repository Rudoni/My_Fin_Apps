from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.current_user import get_current_user_id
from app.schemas.common import TimeMetric


def money(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


VALID_GROUPS = {"bulk", "binder"}
VALID_OWNERSHIP_MODES = {"solo", "common"}


def normalize_inventory_group(value: str | None) -> str:
    if value in VALID_GROUPS:
        return str(value)
    return "bulk"


def normalize_ownership_mode(value: str | None) -> str:
    if value in VALID_OWNERSHIP_MODES:
        return str(value)
    return "solo"


def ownership_share_for_mode(value: str | None) -> Decimal:
    return Decimal("0.5") if normalize_ownership_mode(value) == "common" else Decimal("1")


def brocante_items_query(filter_clause: str = ""):
    return text(
        f"""
        WITH movement_totals AS (
            SELECT
                bm.brocante_item_id,
                COALESCE(SUM(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.quantity ELSE 0 END), 0) AS purchased_quantity,
                COALESCE(SUM(CASE WHEN bm.movement_type = 'SALE' THEN bm.quantity ELSE 0 END), 0) AS sold_quantity,
                COALESCE(SUM(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.total_amount * bi.ownership_share ELSE 0 END), 0) AS purchase_total,
                COALESCE(SUM(CASE WHEN bm.movement_type = 'SALE' THEN bm.total_amount * bi.ownership_share ELSE 0 END), 0) AS sales_total,
                MAX(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.movement_date ELSE NULL END) AS last_purchase_date,
                MAX(CASE WHEN bm.movement_type = 'SALE' THEN bm.movement_date ELSE NULL END) AS last_sale_date
            FROM brocante_movement bm
            JOIN brocante_item bi ON bi.brocante_item_id = bm.brocante_item_id
            GROUP BY bm.brocante_item_id
        )
        SELECT
            bi.brocante_item_id,
            bi.name,
            bc.name AS category,
            bi.inventory_group,
            bi.ownership_mode,
            bi.ownership_share,
            bi.card_type,
            bi.target_sale_unit_price,
            bi.minimum_sale_unit_price,
            COALESCE(mt.purchased_quantity, 0) - COALESCE(mt.sold_quantity, 0) AS stock_quantity,
            COALESCE(mt.purchased_quantity, 0) AS purchased_quantity,
            COALESCE(mt.sold_quantity, 0) AS sold_quantity,
            mt.last_purchase_date,
            mt.last_sale_date,
            COALESCE(mt.purchase_total, 0) AS purchase_total,
            COALESCE(mt.sales_total, 0) AS sales_total,
            CASE
                WHEN COALESCE(mt.purchased_quantity, 0) > 0
                    THEN COALESCE(mt.purchase_total, 0) / mt.purchased_quantity
                ELSE 0
            END AS average_buy_unit_price,
            CASE
                WHEN COALESCE(mt.purchased_quantity, 0) > 0
                    THEN (COALESCE(mt.purchased_quantity, 0) - COALESCE(mt.sold_quantity, 0)) * (COALESCE(mt.purchase_total, 0) / mt.purchased_quantity)
                ELSE 0
            END AS remaining_cost_basis,
            (COALESCE(mt.purchased_quantity, 0) - COALESCE(mt.sold_quantity, 0)) * (bi.target_sale_unit_price * bi.ownership_share) AS target_stock_value,
            COALESCE(mt.sales_total, 0) -
            CASE
                WHEN COALESCE(mt.purchased_quantity, 0) > 0
                    THEN COALESCE(mt.sold_quantity, 0) * (COALESCE(mt.purchase_total, 0) / mt.purchased_quantity)
                ELSE 0
            END AS realized_pnl,
            ((COALESCE(mt.purchased_quantity, 0) - COALESCE(mt.sold_quantity, 0)) * bi.target_sale_unit_price) -
            CASE
                WHEN COALESCE(mt.purchased_quantity, 0) > 0
                    THEN (COALESCE(mt.purchased_quantity, 0) - COALESCE(mt.sold_quantity, 0)) * (COALESCE(mt.purchase_total, 0) / mt.purchased_quantity)
                ELSE 0
            END AS unrealized_pnl,
            bi.notes
        FROM brocante_item bi
        JOIN brocante_category bc ON bc.brocante_category_id = bi.brocante_category_id
        LEFT JOIN movement_totals mt ON mt.brocante_item_id = bi.brocante_item_id
        WHERE bi.is_active = TRUE
        {filter_clause}
        ORDER BY stock_quantity DESC, bi.name ASC, bi.brocante_item_id DESC
        """
    )


def list_items(db: Session, category_id: int | None = None, search: str | None = None, inventory_group: str | None = None) -> list[dict]:
    clauses: list[str] = ["AND bi.user_id = :user_id"]
    params: dict = {"user_id": get_current_user_id(db)}

    if category_id:
        clauses.append("AND bi.brocante_category_id = :category_id")
        params["category_id"] = category_id

    if search:
        clauses.append("AND LOWER(CONCAT(bi.name, ' ', bi.card_type, ' ', bc.name, ' ', COALESCE(bi.notes, ''))) LIKE :search")
        params["search"] = f"%{search.lower()}%"

    if inventory_group:
        clauses.append("AND bi.inventory_group = :inventory_group")
        params["inventory_group"] = normalize_inventory_group(inventory_group)

    rows = db.execute(brocante_items_query(" ".join(clauses)), params).mappings().all()
    return [dict(row) for row in rows]


def get_summary(db: Session, category_id: int | None = None, search: str | None = None, inventory_group: str | None = None) -> dict:
    items = list_items(db, category_id=category_id, search=search, inventory_group=inventory_group)
    today = date.today()
    filter_clause = " AND bi.user_id = :user_id"
    params: dict = {"user_id": get_current_user_id(db)}

    if category_id:
        filter_clause += " AND bi.brocante_category_id = :category_id"
        params["category_id"] = category_id
    if search:
        filter_clause += " AND LOWER(CONCAT(bi.name, ' ', bi.card_type, ' ', bc.name, ' ', COALESCE(bi.notes, ''))) LIKE :search"
        params["search"] = f"%{search.lower()}%"
    if inventory_group:
        filter_clause += " AND bi.inventory_group = :inventory_group"
        params["inventory_group"] = normalize_inventory_group(inventory_group)

    pnl_rows = db.execute(
        text(
            f"""
            WITH purchase_totals AS (
                SELECT
                    bm.brocante_item_id,
                    COALESCE(SUM(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.quantity ELSE 0 END), 0) AS purchased_quantity,
                    COALESCE(SUM(CASE WHEN bm.movement_type = 'PURCHASE' THEN bm.total_amount * bi.ownership_share ELSE 0 END), 0) AS purchase_total
                FROM brocante_movement bm
                JOIN brocante_item bi ON bi.brocante_item_id = bm.brocante_item_id
                GROUP BY bm.brocante_item_id
            )
            SELECT
                bm.movement_date,
                SUM(
                    (bm.total_amount * bi.ownership_share) -
                    CASE
                        WHEN COALESCE(pt.purchased_quantity, 0) > 0
                            THEN bm.quantity * (COALESCE(pt.purchase_total, 0) / pt.purchased_quantity)
                        ELSE 0
                    END
                ) AS realized_pnl
            FROM brocante_movement bm
            JOIN brocante_item bi ON bi.brocante_item_id = bm.brocante_item_id
            JOIN brocante_category bc ON bc.brocante_category_id = bi.brocante_category_id
            LEFT JOIN purchase_totals pt ON pt.brocante_item_id = bm.brocante_item_id
            WHERE bi.is_active = TRUE
              AND bm.movement_type = 'SALE'
              AND EXTRACT(YEAR FROM bm.movement_date)::int = :current_year
              AND EXTRACT(MONTH FROM bm.movement_date)::int = :current_month
              {filter_clause}
            GROUP BY bm.movement_date
            ORDER BY bm.movement_date ASC
            """
        ),
        {**params, "current_year": today.year, "current_month": today.month},
    ).mappings().all()

    purchase_total = sum((money(row["purchase_total"]) for row in items), Decimal("0"))
    sales_total = sum((money(row["sales_total"]) for row in items), Decimal("0"))
    target_stock_value = sum((money(row["target_stock_value"]) for row in items), Decimal("0"))
    break_even_remaining = max(purchase_total - sales_total, Decimal("0"))
    break_even_progress_pct = Decimal("0")
    if purchase_total > 0:
        break_even_progress_pct = (sales_total / purchase_total) * Decimal("100")

    return {
        "reference_count": len(items),
        "stock_quantity": sum(int(row["stock_quantity"]) for row in items),
        "purchase_total": purchase_total,
        "sales_total": sales_total,
        "remaining_cost_basis": sum((money(row["remaining_cost_basis"]) for row in items), Decimal("0")),
        "target_stock_value": target_stock_value,
        "realized_pnl": sum((money(row["realized_pnl"]) for row in items), Decimal("0")),
        "unrealized_pnl": sum((money(row["unrealized_pnl"]) for row in items), Decimal("0")),
        "break_even_remaining": break_even_remaining,
        "break_even_progress_pct": break_even_progress_pct,
        "break_even_possible_with_target": (sales_total + target_stock_value) >= purchase_total if purchase_total > 0 else True,
        "realized_pnl_by_day_current_month": [
            TimeMetric(label=row["movement_date"].strftime("%Y-%m-%d"), value=money(row["realized_pnl"])) for row in pnl_rows
        ],
    }
