import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from app.routers import patrimony
from app.schemas.patrimony import MarketAssetCreate, MarketPurchaseCreate
from app.services.position_cost import remaining_cost
from app.services import patrimony as summary_service


def movement(kind, units, amount, fees=0):
    return dict(transaction_type=kind, quantity=Decimal(units), total_amount=Decimal(amount), fees=Decimal(fees))


class PositionTests(unittest.TestCase):
    def test_purchase_existing_asset_reuses_identity_without_upsert(self):
        db = MagicMock()
        db.execute.return_value.mappings.return_value.first.return_value = {"name_asset": "Existing ETF", "ticker": "EXISTING", "code": "ETF"}
        db.execute.return_value.scalar_one.return_value = Decimal("12")
        payload = MarketPurchaseCreate(quantity=2, buy_unit_price=100, current_unit_price=120, valuation_date=date(2023, 1, 1))
        with patch.object(patrimony, "get_current_user_id", return_value=42), patch.object(patrimony, "get_or_create_market_asset") as upsert, patch.object(patrimony, "upsert_market_valuation") as valuation:
            result = patrimony.add_asset_purchase(7, payload, db)
        upsert.assert_not_called()
        self.assertEqual(result.asset_id, 7)
        self.assertEqual(db.execute.call_args_list[0].args[1], {"asset_id": 7, "user_id": 42})
        self.assertIn("a.user_id = :user_id", str(db.execute.call_args_list[0].args[0]))
        valuation.assert_called_once_with(db, 7, date.today(), Decimal("12"), Decimal("120"), "manual")

    def test_purchase_missing_or_foreign_asset_is_rejected(self):
        db = MagicMock()
        db.execute.return_value.mappings.return_value.first.return_value = None
        payload = MarketPurchaseCreate(quantity=2, buy_unit_price=100, valuation_date=date.today())
        with patch.object(patrimony, "get_current_user_id", return_value=42), self.assertRaises(HTTPException) as error:
            patrimony.add_asset_purchase(7, payload, db)
        self.assertEqual(error.exception.status_code, 404)
        db.commit.assert_not_called()

    def test_purchase_cash_asset_is_rejected(self):
        db = MagicMock()
        db.execute.return_value.mappings.return_value.first.return_value = {"name_asset": "Cash", "ticker": None, "code": "CASH"}
        payload = MarketPurchaseCreate(quantity=2, buy_unit_price=100, valuation_date=date.today())
        with patch.object(patrimony, "get_current_user_id", return_value=42), self.assertRaises(HTTPException) as error:
            patrimony.add_asset_purchase(7, payload, db)
        self.assertEqual(error.exception.status_code, 400)
        db.commit.assert_not_called()

    def test_multiple_lots_and_partial_sale_use_remaining_cost(self):
        rows = [movement("BUY", 10, 1000), movement("BUY", 10, 2000), movement("SELL", 5, 1200)]
        self.assertEqual(remaining_cost(rows), Decimal("2250"))

    def test_fees_are_included(self):
        self.assertEqual(remaining_cost([movement("BUY", 10, 1000, 5)]), Decimal("1005"))

    def test_unknown_deposit_is_not_reported_as_free_profit(self):
        self.assertIsNone(remaining_cost([movement("DEPOSIT", 2, 0)]))

    def test_closed_position_resets_cost(self):
        self.assertEqual(remaining_cost([movement("BUY", 2, 100), movement("SELL", 2, 120)]), 0)

    def test_manual_purchase_values_all_units_today(self):
        db = MagicMock()
        db.execute.return_value.scalar_one.return_value = Decimal("15")
        payload = MarketAssetCreate(name_asset="Example", ticker="EXAMPLE", quantity=5,
                                    buy_unit_price=100, current_unit_price=120, valuation_date=date(2023, 1, 1))
        with patch.object(patrimony, "get_or_create_market_asset", return_value=7), patch.object(patrimony, "upsert_market_valuation") as valuation, patch.object(patrimony, "fetch_yahoo_price") as fetch:
            patrimony.create_market_asset(payload, db)
        valuation.assert_called_once_with(db, 7, date.today(), Decimal("15"), Decimal("120"), "manual")
        fetch.assert_not_called()
        db.commit.assert_called_once()

    def test_missing_euro_quote_does_not_write_purchase(self):
        db = MagicMock()
        payload = MarketAssetCreate(name_asset="Example", ticker="EXAMPLE", quantity=5,
                                    buy_unit_price=100, valuation_date=date(2023, 1, 1))
        with patch.object(patrimony, "fetch_yahoo_price", return_value=None), self.assertRaises(HTTPException):
            patrimony.create_market_asset(payload, db)
        db.execute.assert_not_called()

    def test_summary_uses_full_quantity_and_separates_sale_proceeds(self):
        db = MagicMock()
        row = dict(asset_id=1, name_asset="Example", notes=None, asset_type="Action",
                   category_group="financial", quantity_held=15, total_cost=3000,
                   total_proceeds=1200, unit_price=200, total_value=1000,
                   first_transaction_date=date(2023, 1, 1), manual_valuation_date=None,
                   latest_valuation_date=date.today())
        rows = [dict(asset_id=1, **movement("BUY", 10, 1000)),
                dict(asset_id=1, **movement("BUY", 10, 2000)),
                dict(asset_id=1, **movement("SELL", 5, 1200))]
        db.execute.return_value.mappings.return_value.all.side_effect = [[row], rows]
        with patch.object(summary_service, "get_current_user_id", return_value=1):
            result = summary_service.get_patrimony_summary(db)
        self.assertEqual(result["total_value"], Decimal("3000"))
        self.assertEqual(result["unrealized_pnl"], Decimal("750"))
        self.assertEqual(result["assets"][0]["cost_basis"], Decimal("2250"))


if __name__ == "__main__":
    unittest.main()
