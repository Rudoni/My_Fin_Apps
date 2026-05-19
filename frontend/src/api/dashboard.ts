import { apiRequest } from "./client";

export type TimeMetric = {
  label: string;
  value: string;
};

export type NameMetric = {
  name: string;
  value: string;
};

export type CategoryMetric = {
  category: string;
  ca_total: string;
  benefit_total: string;
  stock_estimated_value: string;
};

export type BudgetSummary = {
  income_total: string;
  complementary_income_total: string;
  total_income_with_complementary: string;
  expense_total: string;
  allocation_total: string;
  resale_purchase_total: string;
  investment_effort_total: string;
  cashflow_total: string;
  cashflow_with_complementary: string;
  cashflow_after_allocations: string;
  income_by_month: TimeMetric[];
  complementary_income_by_month: TimeMetric[];
  income_with_complementary_by_month: TimeMetric[];
  expense_by_month: TimeMetric[];
  expense_by_category: NameMetric[];
  allocation_by_month: TimeMetric[];
  resale_purchase_by_month: TimeMetric[];
  investment_effort_by_month: TimeMetric[];
  allocation_by_group: NameMetric[];
};

export type PatrimonySummary = {
  total_value: string;
  total_invested: string;
  unrealized_pnl: string;
  by_group: NameMetric[];
  assets: Array<{
    asset_id: number | null;
    name: string;
    type: string;
    group: string;
    value: string;
    invested_net: string;
    reference_date: string | null;
    notes: string | null;
  }>;
};

export type DashboardSummary = {
  budget: BudgetSummary;
  patrimony: PatrimonySummary;
  patrimony_timeline: TimeMetric[];
  patrimony_invested_timeline: TimeMetric[];
  patrimony_cumulative_invested_timeline: TimeMetric[];
  resale_ca_total: string;
  resale_benefit_total: string;
  resale_unsold_value: string;
  resale_by_category: CategoryMetric[];
};

function withYears(path: string, years: number[] = []) {
  const params = new URLSearchParams();
  years.forEach((year) => params.append("years", String(year)));
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function getDashboardSummary(years: number[] = []) {
  return apiRequest<DashboardSummary>(withYears("/dashboard/summary", years));
}

export function getBudgetSummary(years: number[] = []) {
  return apiRequest<BudgetSummary>(withYears("/budget/summary", years));
}

export function getPatrimonySummary() {
  return apiRequest<PatrimonySummary>("/patrimony/summary");
}
