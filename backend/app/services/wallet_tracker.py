from datetime import datetime, timezone
from decimal import Decimal
import json
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.services.market_prices import fetch_yahoo_historical_price, fetch_yahoo_price


SATOSHIS_PER_BTC = Decimal("100000000")
BLOCKSTREAM_BASE_URL = "https://blockstream.info/api"


def _request_json(url: str):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _fetch_btc_address_info(address: str) -> dict:
    return _request_json(f"{BLOCKSTREAM_BASE_URL}/address/{quote(address)}")


def _fetch_btc_address_transactions(address: str) -> list[dict]:
    all_rows: list[dict] = []
    last_seen_txid: str | None = None

    while True:
        path = f"/address/{quote(address)}/txs/chain"
        if last_seen_txid:
            path = f"{path}/{quote(last_seen_txid)}"
        rows = _request_json(f"{BLOCKSTREAM_BASE_URL}{path}")
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < 25:
            break
        last_seen_txid = rows[-1]["txid"]

    return all_rows


def _net_btc_change_for_address(tx: dict, address: str) -> Decimal:
    received_sats = sum(
        Decimal(str(vout.get("value", 0)))
        for vout in tx.get("vout", [])
        if vout.get("scriptpubkey_address") == address
    )
    sent_sats = sum(
        Decimal(str((vin.get("prevout") or {}).get("value", 0)))
        for vin in tx.get("vin", [])
        if (vin.get("prevout") or {}).get("scriptpubkey_address") == address
    )
    return (received_sats - sent_sats) / SATOSHIS_PER_BTC


def estimate_btc_wallet(address: str) -> dict:
    wallet_address = address.strip()
    if not wallet_address:
        raise ValueError("Adresse wallet vide.")

    info = _fetch_btc_address_info(wallet_address)
    txs = _fetch_btc_address_transactions(wallet_address)

    chain_stats = info.get("chain_stats") or {}
    funded = Decimal(str(chain_stats.get("funded_txo_sum", 0)))
    spent = Decimal(str(chain_stats.get("spent_txo_sum", 0)))
    current_balance_btc = (funded - spent) / SATOSHIS_PER_BTC

    incoming_quantity = Decimal("0")
    outgoing_quantity = Decimal("0")
    incoming_cost_total = Decimal("0")
    priced_entries = 0
    movement_rows: list[dict] = []

    for tx in txs:
        status = tx.get("status") or {}
        block_time = status.get("block_time")
        if not block_time:
            continue

        tx_date = datetime.fromtimestamp(int(block_time), tz=timezone.utc).date()
        net_change = _net_btc_change_for_address(tx, wallet_address)
        if net_change == 0:
            continue

        historical_price = fetch_yahoo_historical_price("BTC-EUR", tx_date)
        estimated_eur = (net_change.copy_abs() * historical_price) if historical_price is not None else None

        if net_change > 0:
            incoming_quantity += net_change
            if historical_price is not None:
                incoming_cost_total += net_change * historical_price
                priced_entries += 1
        else:
            outgoing_quantity += net_change.copy_abs()

        movement_rows.append(
            {
                "txid": tx.get("txid"),
                "movement_date": tx_date.isoformat(),
                "quantity_btc": net_change,
                "historical_unit_price_eur": historical_price,
                "estimated_total_eur": estimated_eur,
            }
        )

    average_buy_price = (incoming_cost_total / incoming_quantity) if incoming_quantity > 0 else Decimal("0")
    estimated_cost_on_current_balance = current_balance_btc * average_buy_price
    current_price = fetch_yahoo_price("BTC-EUR") or Decimal("0")
    current_value = current_balance_btc * current_price
    unrealized_pnl = current_value - estimated_cost_on_current_balance

    warnings: list[str] = []
    if outgoing_quantity > 0:
        warnings.append(
            "Des sorties BTC ont ete detectees. Le PRU est une estimation basee sur le prix moyen des entrees, pas une compta fiscale parfaite."
        )
    if incoming_quantity > 0 and priced_entries == 0:
        warnings.append("Impossible de recuperer les prix historiques pour les entrees detectees.")
    elif incoming_quantity > 0 and priced_entries < len([row for row in movement_rows if Decimal(str(row['quantity_btc'])) > 0]):
        warnings.append("Certains prix historiques n'ont pas pu etre recuperes. Le cout estime peut etre incomplet.")

    return {
        "address": wallet_address,
        "asset_name": "Bitcoin",
        "ticker": "BTC-EUR",
        "current_balance_btc": current_balance_btc,
        "incoming_quantity_btc": incoming_quantity,
        "outgoing_quantity_btc": outgoing_quantity,
        "average_buy_price_eur": average_buy_price,
        "estimated_cost_basis_eur": estimated_cost_on_current_balance,
        "current_unit_price_eur": current_price,
        "current_value_eur": current_value,
        "unrealized_pnl_eur": unrealized_pnl,
        "movement_count": len(movement_rows),
        "warnings": warnings,
        "movements": sorted(movement_rows, key=lambda row: row["movement_date"], reverse=True),
    }
