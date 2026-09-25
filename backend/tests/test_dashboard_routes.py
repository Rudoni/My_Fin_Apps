import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from app.main import app
from app.routers import dashboard


class DashboardRouteTests(unittest.TestCase):
    def test_account_routes_match_frontend_paths(self):
        routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", [])}
        for path, method in [
            ("/api/auth/me", "PATCH"),
            ("/api/auth/change-password", "POST"),
            ("/api/auth/logout-other-sessions", "POST"),
        ]:
            self.assertIn((path, method), routes)
        self.assertFalse(any("/auth/auth/" in path for path, _ in routes))

    def test_year_filter_does_not_remove_current_stock_from_patrimony(self):
        period = SimpleNamespace(unsold_value=Decimal("20"), ca_total=100, benefit_total=30, by_category=[])
        current = SimpleNamespace(unsold_value=Decimal("200"))
        brocante = {"target_stock_value": 10, "remaining_cost_basis": 5, "unrealized_pnl": 5}
        db = object()
        with (
            patch.object(dashboard, "get_budget_summary", return_value={}),
            patch.object(dashboard, "get_resale_summary", side_effect=[period, current]) as resale,
            patch.object(dashboard, "get_brocante_summary", return_value=brocante),
            patch.object(dashboard, "get_patrimony_timeline", return_value=([], [], [])),
            patch.object(dashboard, "get_patrimony_summary", return_value={}) as patrimony,
        ):
            result = dashboard.dashboard_summary(years=[2025], db=db)
        self.assertEqual(resale.call_count, 2)
        patrimony.assert_called_once_with(db, Decimal("200"), 10, 5, 5)
        self.assertEqual(result["resale_unsold_value"], Decimal("20"))


if __name__ == "__main__":
    unittest.main()
