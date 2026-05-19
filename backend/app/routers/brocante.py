from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from uuid import uuid4

from app.core.current_user import get_current_user_id
from app.core.db import get_db
from app.schemas.brocante import (
    BrocanteCategory,
    BrocanteCategoryCreate,
    BrocanteItemCreate,
    BrocanteItemRead,
    BrocanteItemUpdate,
    BrocanteMovementCreate,
    BrocanteSaleUpdate,
    BrocanteSummary,
)
from app.services import brocante as brocante_service


router = APIRouter(prefix="/brocante", tags=["brocante"])


def ensure_brocante_tables(db: Session) -> None:
    required_tables = ["brocante_category", "brocante_item", "brocante_movement"]
    rows = db.execute(
        text(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = ANY(:table_names)
            """
        ),
        {"table_names": required_tables},
    ).scalars().all()
    missing_tables = sorted(set(required_tables) - set(rows))
    if missing_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Tables brocante manquantes: {', '.join(missing_tables)}. Relance init.sql pour les creer.",
        )


@router.get("/categories", response_model=list[BrocanteCategory])
def list_categories(db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    rows = db.execute(
        text("SELECT brocante_category_id AS id, name FROM brocante_category WHERE user_id = :user_id ORDER BY name"),
        {"user_id": get_current_user_id(db)},
    ).mappings()
    return list(rows)


@router.post("/categories", response_model=BrocanteCategory, status_code=status.HTTP_201_CREATED)
def create_category(payload: BrocanteCategoryCreate, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    user_id = get_current_user_id(db)
    row = db.execute(
        text(
            """
            INSERT INTO brocante_category (user_id, name)
            VALUES (:user_id, :name)
            ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
            RETURNING brocante_category_id AS id, name
            """
        ),
        {**payload.model_dump(), "user_id": user_id},
    ).mappings().one()
    db.commit()
    return row


@router.get("/items", response_model=list[BrocanteItemRead])
def list_items(
    category_id: int | None = None,
    search: str | None = None,
    inventory_group: str | None = Query(default="bulk"),
    db: Session = Depends(get_db),
):
    ensure_brocante_tables(db)
    return brocante_service.list_items(db, category_id=category_id, search=search, inventory_group=inventory_group)


@router.get("/summary", response_model=BrocanteSummary)
def get_summary(
    category_id: int | None = None,
    search: str | None = None,
    inventory_group: str | None = Query(default="bulk"),
    db: Session = Depends(get_db),
):
    ensure_brocante_tables(db)
    return brocante_service.get_summary(db, category_id=category_id, search=search, inventory_group=inventory_group)


@router.post("/items", response_model=BrocanteItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: BrocanteItemCreate, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    payload_data = payload.model_dump()
    payload_data["user_id"] = get_current_user_id(db)
    category_exists = db.execute(
        text(
            """
            SELECT 1
            FROM brocante_category
            WHERE brocante_category_id = :category_id
              AND user_id = :user_id
            """
        ),
        {"category_id": payload_data["brocante_category_id"], "user_id": payload_data["user_id"]},
    ).first()
    if category_exists is None:
        raise HTTPException(status_code=400, detail="Categorie introuvable pour cet utilisateur.")
    payload_data["inventory_group"] = brocante_service.normalize_inventory_group(payload_data.get("inventory_group"))
    payload_data["ownership_mode"] = brocante_service.normalize_ownership_mode(payload_data.get("ownership_mode"))
    payload_data["ownership_share"] = brocante_service.ownership_share_for_mode(payload_data["ownership_mode"])
    payload_data["copy_key"] = ""

    if payload_data["inventory_group"] == "bulk":
        duplicate = db.execute(
            text(
                """
                SELECT brocante_item_id
                FROM brocante_item
                WHERE LOWER(name) = LOWER(:name)
                  AND user_id = :user_id
                  AND brocante_category_id = :brocante_category_id
                  AND inventory_group = :inventory_group
                  AND LOWER(card_type) = LOWER(:card_type)
                  AND is_active = TRUE
                """
            ),
            payload_data,
        ).mappings().first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Cette reference existe deja.")
    else:
        payload_data["copy_key"] = uuid4().hex[:12]

    item_id = db.execute(
        text(
            """
            INSERT INTO brocante_item (user_id, name, brocante_category_id, inventory_group, ownership_mode, ownership_share, copy_key, card_type, target_sale_unit_price, minimum_sale_unit_price, notes)
            VALUES (:user_id, :name, :brocante_category_id, :inventory_group, :ownership_mode, :ownership_share, :copy_key, :card_type, :target_sale_unit_price, :minimum_sale_unit_price, :notes)
            RETURNING brocante_item_id
            """
        ),
        payload_data,
    ).scalar_one()
    db.commit()
    return next(item for item in brocante_service.list_items(db, inventory_group=None) if item["brocante_item_id"] == item_id)


@router.patch("/items/{item_id}", response_model=BrocanteItemRead)
def update_item(item_id: int, payload: BrocanteItemUpdate, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    current = db.execute(text("SELECT * FROM brocante_item WHERE brocante_item_id = :id AND user_id = :user_id"), {"id": item_id, "user_id": get_current_user_id(db)}).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="Reference introuvable.")

    data = dict(current)
    data.update(payload.model_dump(exclude_unset=True))
    category_exists = db.execute(
        text(
            """
            SELECT 1
            FROM brocante_category
            WHERE brocante_category_id = :category_id
              AND user_id = :user_id
            """
        ),
        {"category_id": data["brocante_category_id"], "user_id": get_current_user_id(db)},
    ).first()
    if category_exists is None:
        raise HTTPException(status_code=400, detail="Categorie introuvable pour cet utilisateur.")
    data["inventory_group"] = brocante_service.normalize_inventory_group(data.get("inventory_group"))
    data["ownership_mode"] = brocante_service.normalize_ownership_mode(data.get("ownership_mode"))
    data["ownership_share"] = brocante_service.ownership_share_for_mode(data["ownership_mode"])
    db.execute(
        text(
            """
            UPDATE brocante_item
            SET name = :name,
                brocante_category_id = :brocante_category_id,
                inventory_group = :inventory_group,
                ownership_mode = :ownership_mode,
                ownership_share = :ownership_share,
                card_type = :card_type,
                target_sale_unit_price = :target_sale_unit_price,
                minimum_sale_unit_price = :minimum_sale_unit_price,
                notes = :notes
            WHERE brocante_item_id = :brocante_item_id
            """
        ),
        {**data, "brocante_item_id": item_id},
    )
    db.commit()
    return next(item for item in brocante_service.list_items(db, inventory_group=None) if item["brocante_item_id"] == item_id)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    result = db.execute(
        text("UPDATE brocante_item SET is_active = FALSE WHERE brocante_item_id = :id AND user_id = :user_id"),
        {"id": item_id, "user_id": get_current_user_id(db)},
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Reference introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/purchases", response_model=BrocanteItemRead, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: BrocanteMovementCreate, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    item = db.execute(
        text("SELECT brocante_item_id FROM brocante_item WHERE brocante_item_id = :id AND is_active = TRUE AND user_id = :user_id"),
        {"id": payload.brocante_item_id, "user_id": get_current_user_id(db)},
    ).mappings().first()
    if item is None:
        raise HTTPException(status_code=404, detail="Reference introuvable.")

    db.execute(
        text(
            """
            INSERT INTO brocante_movement (brocante_item_id, movement_type, quantity, total_amount, movement_date, notes)
            VALUES (:brocante_item_id, 'PURCHASE', :quantity, :total_amount, :movement_date, :notes)
            """
        ),
        payload.model_dump(),
    )
    db.commit()
    return next(item for item in brocante_service.list_items(db, inventory_group=None) if item["brocante_item_id"] == payload.brocante_item_id)


@router.post("/sales", response_model=BrocanteItemRead, status_code=status.HTTP_201_CREATED)
def create_sale(payload: BrocanteMovementCreate, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    item = next((row for row in brocante_service.list_items(db, inventory_group=None) if row["brocante_item_id"] == payload.brocante_item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Reference introuvable.")
    if int(item["stock_quantity"]) < payload.quantity:
        raise HTTPException(status_code=400, detail="Stock insuffisant pour cette vente.")

    db.execute(
        text(
            """
            INSERT INTO brocante_movement (brocante_item_id, movement_type, quantity, total_amount, movement_date, notes)
            VALUES (:brocante_item_id, 'SALE', :quantity, :total_amount, :movement_date, :notes)
            """
        ),
        payload.model_dump(),
    )
    db.commit()
    return next(item for item in brocante_service.list_items(db, inventory_group=None) if item["brocante_item_id"] == payload.brocante_item_id)


@router.patch("/items/{item_id}/latest-sale", response_model=BrocanteItemRead)
def update_latest_sale(item_id: int, payload: BrocanteSaleUpdate, db: Session = Depends(get_db)):
    ensure_brocante_tables(db)
    item = db.execute(
        text(
            """
            SELECT brocante_item_id, inventory_group
            FROM brocante_item
            WHERE brocante_item_id = :id
              AND user_id = :user_id
              AND is_active = TRUE
            """
        ),
        {"id": item_id, "user_id": get_current_user_id(db)},
    ).mappings().first()
    if item is None:
        raise HTTPException(status_code=404, detail="Reference introuvable.")

    latest_sale = db.execute(
        text(
            """
            SELECT brocante_movement_id
            FROM brocante_movement
            WHERE brocante_item_id = :item_id
              AND movement_type = 'SALE'
            ORDER BY movement_date DESC, brocante_movement_id DESC
            LIMIT 1
            """
        ),
        {"item_id": item_id},
    ).mappings().first()
    if latest_sale is None:
        raise HTTPException(status_code=404, detail="Aucune vente existante a modifier pour cette carte.")

    db.execute(
        text(
            """
            UPDATE brocante_movement
            SET total_amount = :total_amount,
                movement_date = :movement_date,
                notes = :notes
            WHERE brocante_movement_id = :movement_id
            """
        ),
        {
            "movement_id": latest_sale["brocante_movement_id"],
            "total_amount": payload.total_amount,
            "movement_date": payload.movement_date,
            "notes": payload.notes,
        },
    )
    db.commit()
    return next(row for row in brocante_service.list_items(db, inventory_group=None) if row["brocante_item_id"] == item_id)
