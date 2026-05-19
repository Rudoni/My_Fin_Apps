import csv
import io
from datetime import datetime
from decimal import Decimal

from app.services.market_prices import fetch_yahoo_historical_price, fetch_yahoo_price


YAHOO_TICKER_MAP = {
    "BTC": "BTC-EUR",
    "ETH": "ETH-EUR",
    "BNB": "BNB-EUR",
    "XTZ": "XTZ-EUR",
}

ASSET_NAME_MAP = {
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
    "BNB": "BNB",
    "XTZ": "Tezos",
}


def _money(value: str | None) -> Decimal:
    if value in {None, ""}:
        return Decimal("0")
    return Decimal(str(value))


def estimate_ledger_csv(file_bytes: bytes, asset_ticker: str) -> dict:
    ticker = asset_ticker.strip().upper()
    yahoo_symbol = YAHOO_TICKER_MAP.get(ticker)
    if yahoo_symbol is None:
        raise ValueError(f"Ticker non supporte pour le moment: {ticker}")

    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    incoming_quantity = Decimal("0")
    outgoing_quantity = Decimal("0")
    incoming_cost_total = Decimal("0")
    movement_rows: list[dict] = []

    for row in reader:
        if (row.get("Status") or "").strip().lower() != "confirmed":
            continue
        if (row.get("Currency Ticker") or "").strip().upper() != ticker:
            continue

        operation_type = (row.get("Operation Type") or "").strip().upper()
        quantity = _money(row.get("Operation Amount"))
        operation_date_raw = row.get("Operation Date") or ""
        if not operation_date_raw:
            continue
        operation_date = datetime.fromisoformat(operation_date_raw.replace("Z", "+00:00")).date()

        signed_quantity = Decimal("0")
        if operation_type == "IN":
            signed_quantity = quantity
            incoming_quantity += quantity
        elif operation_type in {"OUT", "FEES"}:
            signed_quantity = -quantity
            outgoing_quantity += quantity
        else:
            continue

        historical_price = fetch_yahoo_historical_price(yahoo_symbol, operation_date)
        estimated_total = quantity * historical_price if historical_price is not None else None

        if operation_type == "IN" and historical_price is not None:
            incoming_cost_total += quantity * historical_price

        movement_rows.append(
            {
                "txid": row.get("Operation Hash") or None,
                "movement_date": operation_date.isoformat(),
                "quantity": signed_quantity,
                "historical_unit_price_eur": historical_price,
                "estimated_total_eur": estimated_total,
                "account_name": row.get("Account Name") or "",
                "operation_type": operation_type,
            }
        )

    current_quantity = incoming_quantity - outgoing_quantity
    average_buy_price = (incoming_cost_total / incoming_quantity) if incoming_quantity > 0 else Decimal("0")
    estimated_cost_basis = current_quantity * average_buy_price
    current_unit_price = fetch_yahoo_price(yahoo_symbol) or Decimal("0")
    current_value = current_quantity * current_unit_price
    unrealized_pnl = current_value - estimated_cost_basis

    warnings: list[str] = []
    if outgoing_quantity > 0:
        warnings.append(
            "Des sorties ou frais ont ete detectes. Le PRU estime utilise un prix moyen sur les entrees et n'est pas une compta fiscale exacte."
        )
    if any(row["historical_unit_price_eur"] is None for row in movement_rows if row["operation_type"] == "IN"):
        warnings.append("Certains prix historiques n'ont pas pu etre recuperes, donc l'estimation peut etre partielle.")

    return {
        "asset_ticker": ticker,
        "yahoo_symbol": yahoo_symbol,
        "current_quantity": current_quantity,
        "incoming_quantity": incoming_quantity,
        "outgoing_quantity": outgoing_quantity,
        "average_buy_price_eur": average_buy_price,
        "estimated_cost_basis_eur": estimated_cost_basis,
        "current_unit_price_eur": current_unit_price,
        "current_value_eur": current_value,
        "unrealized_pnl_eur": unrealized_pnl,
        "movement_count": len(movement_rows),
        "warnings": warnings,
        "movements": sorted(movement_rows, key=lambda row: row["movement_date"], reverse=True),
    }
