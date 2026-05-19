from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import MAX_UPLOAD_SIZE_MB
from app.core.current_user import get_current_user_id
from app.core.db import get_db
from app.schemas.patrimony import (
    AssetUpdate,
    CashAssetCreate,
    CreatedAsset,
    LedgerCsvEstimate,
    MarketAssetCreate,
    PhysicalAssetCreate,
    WalletBtcEstimate,
)
from app.services.ledger_import import ASSET_NAME_MAP, YAHOO_TICKER_MAP, estimate_ledger_csv
from app.services.market_prices import fetch_yahoo_price
from app.services.wallet_tracker import estimate_btc_wallet


router = APIRouter(prefix="/patrimony", tags=["patrimony"])


def validate_uploaded_csv(file: UploadFile, file_bytes: bytes) -> None:
    if not file_bytes:
        raise ValueError("Fichier vide.")
    max_upload_size_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_upload_size_bytes:
        raise ValueError(f"Fichier trop volumineux. Limite: {MAX_UPLOAD_SIZE_MB} Mo.")
    allowed_types = {"text/csv", "application/vnd.ms-excel", "text/plain", ""}
    if file.content_type not in allowed_types:
        raise ValueError("Format de fichier non supporte. Utilise un export CSV Ledger.")


def get_asset_type_id(db: Session, code: str) -> int:
    asset_type_id = db.execute(text("SELECT asset_type_id FROM asset_type WHERE code = :code"), {"code": code}).scalar_one_or_none()
    if asset_type_id is None:
        raise HTTPException(status_code=400, detail=f"Missing asset type {code}. Run init.sql.")
    return int(asset_type_id)


def create_asset_with_value(db: Session, name: str, asset_type_code: str, value, valuation_date, notes: str | None) -> CreatedAsset:
    asset_type_id = get_asset_type_id(db, asset_type_code)
    user_id = get_current_user_id(db)
    existing_asset = db.execute(
        text(
            """
            SELECT asset_id
            FROM asset
            WHERE LOWER(name_asset) = LOWER(:name)
              AND user_id = :user_id
            """
        ),
        {"name": name, "user_id": user_id},
    ).mappings().first()

    if existing_asset:
        asset_id = existing_asset["asset_id"]
        db.execute(
            text(
                """
                UPDATE asset
                SET asset_type_id = :asset_type_id,
                    notes = COALESCE(:notes, notes),
                    is_active = TRUE
                WHERE asset_id = :asset_id
                """
            ),
            {"asset_id": asset_id, "asset_type_id": asset_type_id, "notes": notes},
        )
    else:
        asset_id = db.execute(
            text(
                """
                INSERT INTO asset (user_id, name_asset, ticker, asset_type_id, currency, data_source, is_active, notes)
                VALUES (:user_id, :name, NULL, :asset_type_id, 'EUR', 'manual', TRUE, :notes)
                RETURNING asset_id
                """
            ),
            {"user_id": user_id, "name": name, "asset_type_id": asset_type_id, "notes": notes},
        ).scalar_one()

    db.execute(
        text(
            """
            INSERT INTO asset_valuation (asset_id, valuation_date, unit_price, total_value, value_source)
            VALUES (:asset_id, :valuation_date, 0, :total_value, 'manual')
            ON CONFLICT (asset_id, valuation_date, value_source)
            DO UPDATE SET total_value = EXCLUDED.total_value,
                          unit_price = EXCLUDED.unit_price
            """
        ),
        {"asset_id": asset_id, "valuation_date": valuation_date, "total_value": value},
    )
    db.commit()
    return CreatedAsset(asset_id=asset_id, name_asset=name)


def get_or_create_market_asset(db: Session, payload: MarketAssetCreate) -> int:
    asset_type_id = get_asset_type_id(db, payload.asset_type_code)
    user_id = get_current_user_id(db)
    existing_asset = db.execute(
        text(
            """
            SELECT asset_id
            FROM asset
            WHERE user_id = :user_id
              AND (
                LOWER(ticker) = LOWER(:ticker)
                OR LOWER(name_asset) = LOWER(:name)
              )
            """
        ),
        {"user_id": user_id, "ticker": payload.ticker, "name": payload.name_asset},
    ).mappings().first()

    if existing_asset:
        asset_id = existing_asset["asset_id"]
        db.execute(
            text(
                """
                UPDATE asset
                SET name_asset = :name,
                    ticker = :ticker,
                    asset_type_id = :asset_type_id,
                    data_source = 'yahoo',
                    notes = COALESCE(:notes, notes),
                    is_active = TRUE
                WHERE asset_id = :asset_id
                """
            ),
            {
                "asset_id": asset_id,
                "name": payload.name_asset,
                "ticker": payload.ticker.upper(),
                "asset_type_id": asset_type_id,
                "notes": payload.notes,
            },
        )
        return int(asset_id)

    return int(
        db.execute(
            text(
                """
                INSERT INTO asset (user_id, name_asset, ticker, asset_type_id, currency, data_source, is_active, notes)
                VALUES (:user_id, :name, :ticker, :asset_type_id, 'EUR', 'yahoo', TRUE, :notes)
                RETURNING asset_id
                """
            ),
            {
                "user_id": user_id,
                "name": payload.name_asset,
                "ticker": payload.ticker.upper(),
                "asset_type_id": asset_type_id,
                "notes": payload.notes,
            },
        ).scalar_one()
    )


def upsert_market_valuation(db: Session, asset_id: int, valuation_date, quantity, unit_price, source: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO asset_valuation (asset_id, valuation_date, unit_price, total_value, value_source)
            VALUES (:asset_id, :valuation_date, :unit_price, :total_value, :source)
            ON CONFLICT (asset_id, valuation_date, value_source)
            DO UPDATE SET unit_price = EXCLUDED.unit_price,
                          total_value = EXCLUDED.total_value
            """
        ),
        {
            "asset_id": asset_id,
            "valuation_date": valuation_date,
            "unit_price": unit_price,
            "total_value": unit_price * quantity,
            "source": source,
        },
    )


def get_or_create_ledger_crypto_asset(db: Session, asset_ticker: str) -> tuple[int, str]:
    ticker = asset_ticker.strip().upper()
    yahoo_symbol = YAHOO_TICKER_MAP.get(ticker)
    asset_name = ASSET_NAME_MAP.get(ticker, ticker)
    if yahoo_symbol is None:
        raise HTTPException(status_code=400, detail=f"Ticker non supporte pour l'import Ledger: {ticker}")

    asset_type_id = get_asset_type_id(db, "CRYPTO")
    user_id = get_current_user_id(db)
    existing_asset = db.execute(
        text(
            """
            SELECT asset_id
            FROM asset
            WHERE user_id = :user_id
              AND (
                LOWER(ticker) = LOWER(:ticker)
                OR LOWER(name_asset) = LOWER(:name)
              )
            """
        ),
        {"user_id": user_id, "ticker": yahoo_symbol, "name": asset_name},
    ).mappings().first()

    if existing_asset:
        asset_id = int(existing_asset["asset_id"])
        db.execute(
            text(
                """
                UPDATE asset
                SET name_asset = :name,
                    ticker = :ticker,
                    asset_type_id = :asset_type_id,
                    data_source = 'yahoo',
                    is_active = TRUE
                WHERE asset_id = :asset_id
                """
            ),
            {"asset_id": asset_id, "name": asset_name, "ticker": yahoo_symbol, "asset_type_id": asset_type_id},
        )
        return asset_id, asset_name

    asset_id = db.execute(
        text(
            """
            INSERT INTO asset (user_id, name_asset, ticker, asset_type_id, currency, data_source, is_active, notes)
            VALUES (:user_id, :name, :ticker, :asset_type_id, 'EUR', 'yahoo', TRUE, :notes)
            RETURNING asset_id
            """
        ),
        {
            "user_id": user_id,
            "name": asset_name,
            "ticker": yahoo_symbol,
            "asset_type_id": asset_type_id,
            "notes": "Import Ledger CSV",
        },
    ).scalar_one()
    return int(asset_id), asset_name


@router.post("/physical-assets", response_model=CreatedAsset, status_code=status.HTTP_201_CREATED)
def create_physical_asset(payload: PhysicalAssetCreate, db: Session = Depends(get_db)):
    return create_asset_with_value(db, payload.name_asset, "PATRIMOINE", payload.estimated_value, payload.valuation_date, payload.notes)


@router.post("/cash-assets", response_model=CreatedAsset, status_code=status.HTTP_201_CREATED)
def create_cash_asset(payload: CashAssetCreate, db: Session = Depends(get_db)):
    return create_asset_with_value(db, payload.name_asset, "CASH", payload.amount, payload.valuation_date, payload.notes)


@router.post("/market-assets", response_model=CreatedAsset, status_code=status.HTTP_201_CREATED)
def create_market_asset(payload: MarketAssetCreate, db: Session = Depends(get_db)):
    if payload.asset_type_code not in {"STOCK", "ETF", "CRYPTO"}:
        raise HTTPException(status_code=400, detail="Type supporte: STOCK, ETF ou CRYPTO.")

    asset_id = get_or_create_market_asset(db, payload)
    total_amount = payload.quantity * payload.buy_unit_price
    db.execute(
        text(
            """
            INSERT INTO asset_transaction (asset_id, transaction_type, quantity, unit_price, total_amount, transaction_date, notes)
            VALUES (:asset_id, 'BUY', :quantity, :unit_price, :total_amount, :transaction_date, :notes)
            """
        ),
        {
            "asset_id": asset_id,
            "quantity": payload.quantity,
            "unit_price": payload.buy_unit_price,
            "total_amount": total_amount,
            "transaction_date": payload.valuation_date,
            "notes": payload.notes,
        },
    )

    latest_price = fetch_yahoo_price(payload.ticker) or payload.buy_unit_price
    upsert_market_valuation(db, asset_id, payload.valuation_date, payload.quantity, latest_price, "yahoo")
    db.commit()
    return CreatedAsset(asset_id=asset_id, name_asset=payload.name_asset)


@router.get("/wallets/btc/estimate", response_model=WalletBtcEstimate)
def estimate_btc_wallet_route(address: str = Query(min_length=20), db: Session = Depends(get_db)):
    del db
    try:
        return estimate_btc_wallet(address)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=502,
            detail="Impossible d'analyser ce wallet BTC pour le moment. Verifie l'adresse ou reessaie plus tard.",
        ) from err


@router.post("/ledger/estimate", response_model=LedgerCsvEstimate)
async def estimate_ledger_csv_route(
    asset_ticker: str = Query(min_length=2),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    del db
    try:
        file_bytes = await file.read()
        validate_uploaded_csv(file, file_bytes)
        return estimate_ledger_csv(file_bytes, asset_ticker)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=502,
            detail="Impossible d'analyser ce CSV Ledger pour le moment. Verifie le fichier ou reessaie plus tard.",
        ) from err


@router.post("/ledger/import", response_model=CreatedAsset)
async def import_ledger_csv_route(
    asset_ticker: str = Query(min_length=2),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        file_bytes = await file.read()
        validate_uploaded_csv(file, file_bytes)

        estimate = estimate_ledger_csv(file_bytes, asset_ticker)
        asset_id, asset_name = get_or_create_ledger_crypto_asset(db, asset_ticker)
        note_prefix = f"LEDGER_IMPORT:{asset_ticker.strip().upper()}:"

        db.execute(
            text(
                """
                DELETE FROM asset_transaction
                WHERE asset_id = :asset_id
                  AND notes LIKE :note_prefix
                """
            ),
            {"asset_id": asset_id, "note_prefix": f"{note_prefix}%"},
        )

        movement_rows = estimate["movements"]
        for movement in movement_rows:
            operation_type = movement["operation_type"]
            quantity = abs(movement["quantity"])
            unit_price = movement["historical_unit_price_eur"] or Decimal("0")
            total_amount = quantity * unit_price

            if operation_type == "IN":
                transaction_type = "BUY"
            elif operation_type == "OUT":
                transaction_type = "SELL"
            else:
                continue

            db.execute(
                text(
                    """
                    INSERT INTO asset_transaction (
                        asset_id,
                        transaction_type,
                        quantity,
                        unit_price,
                        total_amount,
                        transaction_date,
                        notes
                    )
                    VALUES (
                        :asset_id,
                        :transaction_type,
                        :quantity,
                        :unit_price,
                        :total_amount,
                        :transaction_date,
                        :notes
                    )
                    """
                ),
                {
                    "asset_id": asset_id,
                    "transaction_type": transaction_type,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "total_amount": total_amount,
                    "transaction_date": movement["movement_date"],
                    "notes": f"{note_prefix}{movement['txid'] or movement['movement_date']}",
                },
            )

        upsert_market_valuation(
            db,
            asset_id,
            date.today(),
            estimate["current_quantity"],
            estimate["current_unit_price_eur"],
            "yahoo",
        )
        db.commit()
        return CreatedAsset(asset_id=asset_id, name_asset=asset_name)
    except HTTPException:
        raise
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=502,
            detail="Impossible d'importer ce CSV Ledger dans le patrimoine pour le moment.",
        ) from err


@router.post("/assets/{asset_id}/refresh-price", response_model=CreatedAsset)
def refresh_asset_price(asset_id: int, db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    asset = db.execute(
        text(
            """
            SELECT a.asset_id, a.name_asset, a.ticker, COALESCE(q.quantity_held, 0) AS quantity_held
            FROM asset a
            LEFT JOIN (
                SELECT
                    asset_id,
                    SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN quantity WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN -quantity ELSE 0 END) AS quantity_held
                FROM asset_transaction
                GROUP BY asset_id
            ) q ON q.asset_id = a.asset_id
            WHERE a.asset_id = :asset_id
              AND a.user_id = :user_id
            """
        ),
        {"asset_id": asset_id, "user_id": user_id},
    ).mappings().first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset["ticker"]:
        raise HTTPException(status_code=400, detail="Cet actif n'a pas de ticker.")

    latest_price = fetch_yahoo_price(asset["ticker"])
    if latest_price is None:
        raise HTTPException(status_code=502, detail="Prix de marche indisponible pour ce ticker.")

    upsert_market_valuation(db, asset_id, date.today(), asset["quantity_held"], latest_price, "yahoo")
    db.commit()
    return CreatedAsset(asset_id=asset_id, name_asset=asset["name_asset"])


@router.patch("/assets/{asset_id}", response_model=CreatedAsset)
def update_asset(asset_id: int, payload: AssetUpdate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(db)
    asset = db.execute(text("SELECT asset_id FROM asset WHERE asset_id = :asset_id AND user_id = :user_id"), {"asset_id": asset_id, "user_id": user_id}).mappings().first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    duplicate = db.execute(
        text(
            """
            SELECT asset_id
            FROM asset
            WHERE LOWER(name_asset) = LOWER(:name_asset)
              AND asset_id <> :asset_id
              AND user_id = :user_id
            """
        ),
        {"asset_id": asset_id, "name_asset": payload.name_asset, "user_id": user_id},
    ).mappings().first()
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Un autre actif a deja ce nom.")

    db.execute(
        text(
            """
            UPDATE asset
            SET name_asset = :name_asset,
                notes = :notes,
                is_active = TRUE
            WHERE asset_id = :asset_id
            """
        ),
        {"asset_id": asset_id, "name_asset": payload.name_asset, "notes": payload.notes},
    )
    db.execute(
        text(
            """
            DELETE FROM asset_valuation
            WHERE asset_id = :asset_id
              AND value_source = 'manual'
            """
        ),
        {"asset_id": asset_id},
    )
    db.execute(
        text(
            """
            INSERT INTO asset_valuation (asset_id, valuation_date, unit_price, total_value, value_source)
            VALUES (:asset_id, :valuation_date, 0, :total_value, 'manual')
            ON CONFLICT (asset_id, valuation_date, value_source)
            DO UPDATE SET total_value = EXCLUDED.total_value,
                          unit_price = EXCLUDED.unit_price
            """
        ),
        {"asset_id": asset_id, "valuation_date": payload.valuation_date, "total_value": payload.estimated_value},
    )
    db.commit()
    return CreatedAsset(asset_id=asset_id, name_asset=payload.name_asset)


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    result = db.execute(text("DELETE FROM asset WHERE asset_id = :asset_id AND user_id = :user_id"), {"asset_id": asset_id, "user_id": get_current_user_id(db)})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
