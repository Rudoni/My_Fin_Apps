from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.resale import RESALE_CATEGORIES, ResaleItemCreate, ResaleItemRead, ResaleItemUpdate, ResaleSummary
from app.services import resale as resale_service


router = APIRouter(prefix="/resale", tags=["resale"])


@router.get("/categories", response_model=list[str])
def get_categories() -> list[str]:
    return RESALE_CATEGORIES


@router.get("/items", response_model=list[ResaleItemRead])
def list_items(
    search: str | None = None,
    category: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    years: list[int] | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return resale_service.list_items(db, search=search, category=category, status_filter=status_filter, years=years)


@router.get("/years", response_model=list[int])
def get_years(db: Session = Depends(get_db)):
    return resale_service.list_years(db)


@router.post("/items", response_model=ResaleItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: ResaleItemCreate, db: Session = Depends(get_db)):
    return resale_service.create_item(db, payload)


@router.patch("/items/{item_id}", response_model=ResaleItemRead)
def update_item(item_id: int, payload: ResaleItemUpdate, db: Session = Depends(get_db)):
    item = resale_service.update_item(db, item_id, payload)
    if item is None:
        raise HTTPException(status_code=404, detail="Resale item not found")
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    if not resale_service.delete_item(db, item_id):
        raise HTTPException(status_code=404, detail="Resale item not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary", response_model=ResaleSummary)
def get_summary(years: list[int] | None = Query(default=None), db: Session = Depends(get_db)):
    return resale_service.get_summary(db, years=years)
