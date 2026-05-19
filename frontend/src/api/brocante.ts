import { apiRequest } from "./client";

export type BrocanteCategory = {
  id: number;
  name: string;
};

export type BrocanteItem = {
  brocante_item_id: number;
  name: string;
  category: string;
  inventory_group: string;
  ownership_mode: string;
  ownership_share: string;
  card_type: string;
  target_sale_unit_price: string;
  minimum_sale_unit_price: string;
  stock_quantity: number;
  purchased_quantity: number;
  sold_quantity: number;
  last_purchase_date: string | null;
  last_sale_date: string | null;
  purchase_total: string;
  sales_total: string;
  average_buy_unit_price: string;
  remaining_cost_basis: string;
  target_stock_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  notes: string | null;
};

export type BrocanteSummary = {
  reference_count: number;
  stock_quantity: number;
  purchase_total: string;
  sales_total: string;
  remaining_cost_basis: string;
  target_stock_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  break_even_remaining: string;
  break_even_progress_pct: string;
  break_even_possible_with_target: boolean;
  realized_pnl_by_day_current_month: Array<{
    label: string;
    value: string;
  }>;
};

export const getBrocanteCategories = () => apiRequest<BrocanteCategory[]>("/brocante/categories");
export const createBrocanteCategory = (payload: { name: string }) =>
  apiRequest<BrocanteCategory>("/brocante/categories", { method: "POST", body: JSON.stringify(payload) });

export const getBrocanteItems = (categoryId = "", search = "", inventoryGroup = "bulk") => {
  const params = new URLSearchParams();
  if (categoryId) params.set("category_id", categoryId);
  if (search) params.set("search", search);
  if (inventoryGroup) params.set("inventory_group", inventoryGroup);
  return apiRequest<BrocanteItem[]>(`/brocante/items${params.toString() ? `?${params.toString()}` : ""}`);
};

export const getBrocanteSummary = (categoryId = "", search = "", inventoryGroup = "bulk") => {
  const params = new URLSearchParams();
  if (categoryId) params.set("category_id", categoryId);
  if (search) params.set("search", search);
  if (inventoryGroup) params.set("inventory_group", inventoryGroup);
  return apiRequest<BrocanteSummary>(`/brocante/summary${params.toString() ? `?${params.toString()}` : ""}`);
};

export const createBrocanteItem = (payload: {
  name: string;
  brocante_category_id: number;
  inventory_group: string;
  ownership_mode: string;
  card_type: string;
  target_sale_unit_price: string;
  minimum_sale_unit_price: string;
  notes?: string | null;
}) => apiRequest<BrocanteItem>("/brocante/items", { method: "POST", body: JSON.stringify(payload) });

export const updateBrocanteItem = (id: number, payload: {
  name?: string;
  brocante_category_id?: number;
  inventory_group?: string;
  ownership_mode?: string;
  card_type?: string;
  target_sale_unit_price?: string;
  minimum_sale_unit_price?: string;
  notes?: string | null;
}) => apiRequest<BrocanteItem>(`/brocante/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteBrocanteItem = (id: number) => apiRequest<void>(`/brocante/items/${id}`, { method: "DELETE" });

export const createBrocantePurchase = (payload: {
  brocante_item_id: number;
  quantity: number;
  total_amount: string;
  movement_date: string;
  notes?: string | null;
}) => apiRequest<BrocanteItem>("/brocante/purchases", { method: "POST", body: JSON.stringify(payload) });

export const createBrocanteSale = (payload: {
  brocante_item_id: number;
  quantity: number;
  total_amount: string;
  movement_date: string;
  notes?: string | null;
}) => apiRequest<BrocanteItem>("/brocante/sales", { method: "POST", body: JSON.stringify(payload) });

export const updateBrocanteLatestSale = (id: number, payload: {
  total_amount: string;
  movement_date: string;
  notes?: string | null;
}) => apiRequest<BrocanteItem>(`/brocante/items/${id}/latest-sale`, { method: "PATCH", body: JSON.stringify(payload) });
