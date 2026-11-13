from decimal import Decimal


def remaining_cost(transactions):
    """Moving-average cost of remaining units, not purchases minus sale proceeds."""
    quantity = Decimal("0")
    cost = Decimal("0")
    known = True
    for row in transactions:
        units = Decimal(row["quantity"])
        kind = row["transaction_type"]
        if kind in {"BUY", "DEPOSIT"}:
            amount = Decimal(row["total_amount"] or 0) + Decimal(row["fees"] or 0)
            if kind == "DEPOSIT" and amount == 0:
                known = False
            quantity += units
            cost += amount
        elif kind in {"SELL", "WITHDRAWAL"}:
            if units > quantity:
                known = False
            cost = cost * max(quantity - units, Decimal("0")) / quantity if quantity > 0 else Decimal("0")
            quantity -= units
            if quantity == 0:
                cost, known = Decimal("0"), True
    return cost if known else None
