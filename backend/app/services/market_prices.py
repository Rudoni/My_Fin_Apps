from decimal import Decimal
import json
from datetime import date, datetime, time, timezone, timedelta
from urllib.parse import quote
from urllib.request import Request, urlopen


def fetch_yahoo_price(symbol: str) -> Decimal | None:
    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        return None

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(clean_symbol)}?range=1d&interval=1m"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    result = payload.get("chart", {}).get("result") or []
    if not result:
        return None

    meta = result[0].get("meta", {})
    price = meta.get("regularMarketPrice") or meta.get("previousClose")
    if price is None:
        return None
    return Decimal(str(price))


def fetch_yahoo_historical_price(symbol: str, target_date: date) -> Decimal | None:
    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        return None

    start_dt = datetime.combine(target_date - timedelta(days=1), time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(target_date + timedelta(days=2), time.min, tzinfo=timezone.utc)
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(clean_symbol)}"
        f"?period1={int(start_dt.timestamp())}&period2={int(end_dt.timestamp())}&interval=1d"
    )
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    result = payload.get("chart", {}).get("result") or []
    if not result:
        return None

    timestamps = result[0].get("timestamp") or []
    quotes = result[0].get("indicators", {}).get("quote") or []
    closes = (quotes[0].get("close") if quotes else None) or []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        row_date = datetime.fromtimestamp(int(ts), tz=timezone.utc).date()
        if row_date == target_date:
            return Decimal(str(close))

    for close in closes:
        if close is not None:
            return Decimal(str(close))
    return None
