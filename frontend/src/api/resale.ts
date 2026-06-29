import { apiRequest } from "./client";

export type ResaleItem = {
  resale_item_id: number;
  pair_name: string;
  resale_category: string;
  purchase_price: string;
  purchase_date: string | null;
  purchase_site: string | null;
  size: string | null;
  pair_received: boolean;
  sale_price: string | null;
  sale_date: string | null;
  sale_site: string | null;
  pair_count: number;
  payment_method: string | null;
  expected_price: string | null;
  notes: string | null;
  created_at: string;
  sale_total: string;
  purchase_total: string;
  expected_total: string;
  benefit: string;
  expected_benefit: string;
  status: string;
};

export type ResalePayload = {
  pair_name: string;
  resale_category: string;
  purchase_price: string;
  purchase_date?: string | null;
  sale_price?: string | null;
  sale_date?: string | null;
  sale_site?: string | null;
  pair_count: number;
  expected_price?: string | null;
  notes?: string | null;
};

export type ResaleStatusFilter = "all" | "available" | "sold";

export type TimeMetric = {
  label: string;
  value: string;
};

export type CategoryMetric = {
  category: string;
  purchase_total: string;
  ca_total: string;
  benefit_total: string;
  margin_rate: string;
  expected_purchase_total: string;
  expected_benefit_total: string;
  expected_margin_rate: string;
  stock_estimated_value: string;
  break_even_remaining: string;
  break_even_progress_pct: string;
  break_even_possible_with_target: boolean;
};

export type ResaleSummary = {
  ca_total: string;
  purchase_count: number;
  benefit_total: string;
  unrealized_pnl: string;
  unsold_value: string;
  unsold_count: number;
  break_even_remaining: string;
  break_even_progress_pct: string;
  break_even_possible_with_target: boolean;
  ca_by_year: TimeMetric[];
  benefit_by_year: TimeMetric[];
  benefit_by_month: TimeMetric[];
  realized_pnl_by_day_current_month: TimeMetric[];
  by_category: CategoryMetric[];
};

function appendYears(params: URLSearchParams, years: number[] = []) {
  years.forEach((year) => params.append("years", String(year)));
}

export function getResaleItems(search = "", category = "", years: number[] = [], status: ResaleStatusFilter = "all") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (status !== "all") params.set("status", status);
  appendYears(params, years);
  const query = params.toString();
  return apiRequest<ResaleItem[]>(`/resale/items${query ? `?${query}` : ""}`);
}

export function getResaleSummary(years: number[] = []) {
  const params = new URLSearchParams();
  appendYears(params, years);
  const query = params.toString();
  return apiRequest<ResaleSummary>(`/resale/summary${query ? `?${query}` : ""}`);
}

export function getResaleCategories() {
  return apiRequest<string[]>("/resale/categories");
}

export function getResaleYears() {
  return apiRequest<number[]>("/resale/years");
}

export function createResaleItem(payload: ResalePayload) {
  return apiRequest<ResaleItem>("/resale/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateResaleItem(id: number, payload: Partial<ResalePayload>) {
  return apiRequest<ResaleItem>(`/resale/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteResaleItem(id: number) {
  return apiRequest<void>(`/resale/items/${id}`, {
    method: "DELETE",
  });
}
