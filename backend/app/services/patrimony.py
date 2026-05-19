from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.current_user import get_current_user_id
from app.schemas.common import NameMetric, TimeMetric


def money(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def has_budget_allocation_table(db: Session) -> bool:
    return bool(db.execute(text("SELECT to_regclass('public.budget_allocation') IS NOT NULL")).scalar())


def get_patrimony_summary(
    db: Session,
    resale_unsold_value: Decimal = Decimal("0"),
    brocante_stock_value: Decimal = Decimal("0"),
    brocante_remaining_cost: Decimal = Decimal("0"),
    brocante_unrealized_pnl: Decimal = Decimal("0"),
) -> dict:
    user_id = get_current_user_id(db)
    assets = db.execute(
        text(
            """
            SELECT
                a.asset_id,
                a.name_asset,
                a.notes,
                t.label AS asset_type,
                t.category_group,
                COALESCE(q.quantity_held, 0) AS quantity_held,
                COALESCE(q.total_cost, 0) AS total_cost,
                COALESCE(q.total_proceeds, 0) AS total_proceeds,
                q.first_transaction_date,
                mv.valuation_date AS manual_valuation_date,
                v.valuation_date AS latest_valuation_date,
                COALESCE(v.unit_price, 0) AS unit_price,
                COALESCE(v.total_value, 0) AS total_value
            FROM asset a
            JOIN asset_type t ON t.asset_type_id = a.asset_type_id
            LEFT JOIN (
                SELECT
                    asset_id,
                    SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN quantity WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN -quantity ELSE 0 END) AS quantity_held,
                    SUM(CASE WHEN transaction_type = 'BUY' THEN total_amount + fees ELSE 0 END) AS total_cost,
                    SUM(CASE WHEN transaction_type = 'SELL' THEN total_amount - fees ELSE 0 END) AS total_proceeds,
                    MIN(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN transaction_date ELSE NULL END) AS first_transaction_date
                FROM asset_transaction
                GROUP BY asset_id
            ) q ON q.asset_id = a.asset_id
            LEFT JOIN (
                SELECT DISTINCT ON (asset_id)
                    asset_id,
                    valuation_date
                FROM asset_valuation
                WHERE value_source = 'manual'
                ORDER BY asset_id, valuation_date DESC, valuation_id DESC
            ) mv ON mv.asset_id = a.asset_id
            LEFT JOIN (
                SELECT DISTINCT ON (asset_id)
                    asset_id,
                    valuation_date,
                    unit_price,
                    total_value
                FROM asset_valuation
                ORDER BY asset_id, valuation_date DESC, valuation_id DESC
            ) v ON v.asset_id = a.asset_id
            WHERE a.is_active = TRUE
              AND a.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    total_value = Decimal("0")
    total_invested = Decimal("0")
    unrealized_pnl = Decimal("0")
    by_group: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    rows = []

    for row in assets:
        quantity = money(row["quantity_held"])
        unit_price = money(row["unit_price"])
        explicit_value = money(row["total_value"])
        market_value = explicit_value if explicit_value > 0 else quantity * unit_price
        invested_net = money(row["total_cost"]) - money(row["total_proceeds"])

        total_value += market_value
        total_invested += invested_net
        if row["category_group"] in {"financial", "crypto"} and invested_net > 0:
            unrealized_pnl += market_value - invested_net
        by_group[row["category_group"]] += market_value
        rows.append(
            {
                "asset_id": row["asset_id"],
                "name": row["name_asset"],
                "type": row["asset_type"],
                "group": row["category_group"],
                "value": market_value,
                "invested_net": invested_net,
                "reference_date": row["manual_valuation_date"] or row["first_transaction_date"] or row["latest_valuation_date"],
                "notes": row["notes"],
            }
        )

    if resale_unsold_value > 0:
        total_value += resale_unsold_value
        by_group["resale"] += resale_unsold_value
        rows.append(
            {
                "asset_id": None,
                "name": "Stock achat-revente",
                "type": "Achat-revente",
                "group": "resale",
                "value": resale_unsold_value,
                "invested_net": Decimal("0"),
                "reference_date": None,
                "notes": None,
            }
        )

    if brocante_stock_value > 0:
        total_value += brocante_stock_value
        total_invested += brocante_remaining_cost
        unrealized_pnl += brocante_unrealized_pnl
        by_group["brocante"] += brocante_stock_value
        rows.append(
            {
                "asset_id": None,
                "name": "Stock brocante",
                "type": "Brocante",
                "group": "brocante",
                "value": brocante_stock_value,
                "invested_net": brocante_remaining_cost,
                "reference_date": None,
                "notes": None,
            }
        )

    return {
        "total_value": total_value,
        "total_invested": total_invested,
        "unrealized_pnl": unrealized_pnl,
        "by_group": [NameMetric(name=key, value=value) for key, value in sorted(by_group.items())],
        "assets": rows,
    }


def month_end_for(value: date) -> date:
    if value.month == 12:
        return date(value.year, 12, 31)
    return date(value.year, value.month + 1, 1) - timedelta(days=1)


def next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def get_patrimony_timeline(db: Session) -> tuple[list[TimeMetric], list[TimeMetric], list[TimeMetric]]:
    user_id = get_current_user_id(db)
    asset_rows = db.execute(
        text(
            """
            SELECT
                a.asset_id,
                t.category_group
            FROM asset a
            JOIN asset_type t ON t.asset_type_id = a.asset_type_id
            WHERE a.is_active = TRUE
              AND a.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    transactions = db.execute(
        text(
            """
            SELECT asset_id, transaction_type, quantity, total_amount, fees, transaction_date
            FROM asset_transaction
            WHERE asset_id IN (SELECT asset_id FROM asset WHERE user_id = :user_id)
            ORDER BY transaction_date ASC, transaction_id ASC
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    valuations = db.execute(
        text(
            """
            SELECT asset_id, valuation_date, unit_price, total_value
            FROM asset_valuation
            WHERE asset_id IN (SELECT asset_id FROM asset WHERE user_id = :user_id)
            ORDER BY valuation_date ASC, valuation_id ASC
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    resale_rows = db.execute(
        text(
            """
            SELECT purchase_date, sale_date, pair_count, purchase_price, expected_price
            FROM resale_item
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    brocante_rows = db.execute(
        text(
            """
            SELECT
                bi.brocante_item_id,
                bi.target_sale_unit_price,
                bm.movement_type,
                bm.quantity,
                bm.total_amount,
                bm.movement_date
            FROM brocante_item bi
            JOIN brocante_movement bm ON bm.brocante_item_id = bi.brocante_item_id
            WHERE bi.is_active = TRUE
              AND bi.user_id = :user_id
            ORDER BY bm.movement_date ASC, bm.brocante_movement_id ASC
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    manual_asset_valuations = db.execute(
        text(
            """
            SELECT
                a.asset_id,
                v.valuation_date,
                v.total_value
            FROM asset a
            JOIN (
                SELECT DISTINCT ON (asset_id)
                    asset_id,
                    valuation_date,
                    total_value
                FROM asset_valuation
                WHERE value_source = 'manual'
                ORDER BY asset_id, valuation_date ASC, valuation_id ASC
            ) v ON v.asset_id = a.asset_id
            WHERE a.is_active = TRUE
              AND a.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    anchor_dates = [
        row["transaction_date"] for row in transactions if row["transaction_date"] is not None
    ] + [
        row["valuation_date"] for row in valuations if row["valuation_date"] is not None
    ] + [
        row["valuation_date"] for row in manual_asset_valuations if row["valuation_date"] is not None
    ] + [
        row["purchase_date"] for row in resale_rows if row["purchase_date"] is not None
    ] + [
        row["sale_date"] for row in resale_rows if row["sale_date"] is not None
    ] + [
        row["movement_date"] for row in brocante_rows if row["movement_date"] is not None
    ]

    if not anchor_dates:
        return [], [], []

    start_month = min(anchor_dates).replace(day=1)
    current_month = date.today().replace(day=1)

    asset_groups = {int(row["asset_id"]): row["category_group"] for row in asset_rows}
    transactions_by_asset: dict[int, list[dict]] = defaultdict(list)
    for row in transactions:
        transactions_by_asset[int(row["asset_id"])].append(dict(row))

    valuations_by_asset: dict[int, list[dict]] = defaultdict(list)
    for row in valuations:
        valuations_by_asset[int(row["asset_id"])].append(dict(row))

    brocante_by_item: dict[int, list[dict]] = defaultdict(list)
    brocante_target_price: dict[int, Decimal] = {}
    for row in brocante_rows:
        item_id = int(row["brocante_item_id"])
        brocante_by_item[item_id].append(dict(row))
        brocante_target_price[item_id] = money(row["target_sale_unit_price"])

    patrimony_timeline: list[TimeMetric] = []
    invested_timeline: list[TimeMetric] = []
    cumulative_invested_timeline: list[TimeMetric] = []
    cumulative_invested_by_month: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    month_cursor = start_month

    asset_ids_with_transactions = {int(row["asset_id"]) for row in transactions if row["asset_id"] is not None}

    for transaction in transactions:
        transaction_date = transaction["transaction_date"]
        if transaction_date is None:
            continue
        transaction_type = transaction["transaction_type"]
        if transaction_type == "BUY":
            cumulative_invested_by_month[transaction_date.strftime("%Y-%m")] += money(transaction["total_amount"]) + money(
                transaction["fees"]
            )
        elif transaction_type == "DEPOSIT":
            cumulative_invested_by_month[transaction_date.strftime("%Y-%m")] += money(transaction["total_amount"])

    for row in manual_asset_valuations:
        asset_id = int(row["asset_id"])
        valuation_date = row["valuation_date"]
        if valuation_date is None or asset_id in asset_ids_with_transactions:
            continue
        cumulative_invested_by_month[valuation_date.strftime("%Y-%m")] += money(row["total_value"])

    for row in resale_rows:
        purchase_date = row["purchase_date"]
        if purchase_date is None:
            continue
        pair_count = Decimal(str(row["pair_count"] or 1))
        cumulative_invested_by_month[purchase_date.strftime("%Y-%m")] += money(row["purchase_price"]) * pair_count

    for row in brocante_rows:
        movement_date = row["movement_date"]
        if movement_date is None or row["movement_type"] != "PURCHASE":
            continue
        cumulative_invested_by_month[movement_date.strftime("%Y-%m")] += money(row["total_amount"])

    cumulative_invested_running_total = Decimal("0")

    while month_cursor <= current_month:
        as_of = month_end_for(month_cursor)
        total_value = Decimal("0")
        total_invested = Decimal("0")
        month_label = month_cursor.strftime("%Y-%m")

        for asset_id, group in asset_groups.items():
            quantity_held = Decimal("0")
            total_cost = Decimal("0")
            total_proceeds = Decimal("0")
            for transaction in transactions_by_asset.get(asset_id, []):
                tx_date = transaction["transaction_date"]
                if tx_date is None or tx_date > as_of:
                    continue
                quantity = money(transaction["quantity"])
                total_amount = money(transaction["total_amount"])
                fees = money(transaction["fees"])
                tx_type = transaction["transaction_type"]

                if tx_type in {"BUY", "DEPOSIT"}:
                    quantity_held += quantity
                elif tx_type in {"SELL", "WITHDRAWAL"}:
                    quantity_held -= quantity

                if tx_type == "BUY":
                    total_cost += total_amount + fees
                elif tx_type == "SELL":
                    total_proceeds += total_amount - fees

            invested_net = total_cost - total_proceeds
            latest_valuation = None
            for valuation in valuations_by_asset.get(asset_id, []):
                valuation_date = valuation["valuation_date"]
                if valuation_date is not None and valuation_date <= as_of:
                    latest_valuation = valuation
                else:
                    break

            market_value = Decimal("0")
            if latest_valuation is not None:
                explicit_value = money(latest_valuation["total_value"])
                unit_price = money(latest_valuation["unit_price"])
                market_value = explicit_value if explicit_value > 0 else quantity_held * unit_price
            elif invested_net > 0:
                market_value = invested_net

            total_value += market_value
            total_invested += invested_net

        for row in resale_rows:
            purchase_date = row["purchase_date"]
            sale_date = row["sale_date"]
            if purchase_date is None or purchase_date > as_of:
                continue
            if sale_date is not None and sale_date <= as_of:
                continue
            pair_count = Decimal(str(row["pair_count"] or 1))
            purchase_total = money(row["purchase_price"]) * pair_count
            expected_total = money(row["expected_price"]) * pair_count
            total_value += expected_total if expected_total > 0 else purchase_total

        for item_id, movements in brocante_by_item.items():
            stock_quantity = Decimal("0")
            remaining_cost = Decimal("0")
            purchase_total = Decimal("0")
            purchased_quantity = Decimal("0")
            sold_quantity = Decimal("0")

            for movement in movements:
                movement_date = movement["movement_date"]
                if movement_date is None or movement_date > as_of:
                    continue
                quantity = money(movement["quantity"])
                total_amount = money(movement["total_amount"])
                if movement["movement_type"] == "PURCHASE":
                    stock_quantity += quantity
                    purchased_quantity += quantity
                    purchase_total += total_amount
                elif movement["movement_type"] == "SALE":
                    stock_quantity -= quantity
                    sold_quantity += quantity

            if stock_quantity <= 0:
                continue

            average_buy_unit_price = purchase_total / purchased_quantity if purchased_quantity > 0 else Decimal("0")
            remaining_cost = stock_quantity * average_buy_unit_price
            total_invested += remaining_cost
            total_value += stock_quantity * brocante_target_price.get(item_id, Decimal("0"))

        cumulative_invested_running_total += cumulative_invested_by_month[month_label]

        patrimony_timeline.append(TimeMetric(label=month_label, value=total_value))
        invested_timeline.append(TimeMetric(label=month_label, value=total_invested))
        cumulative_invested_timeline.append(TimeMetric(label=month_label, value=cumulative_invested_running_total))
        month_cursor = next_month(month_cursor)

    return patrimony_timeline, invested_timeline, cumulative_invested_timeline
