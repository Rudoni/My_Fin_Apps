import { apiRequest, getApiBaseUrl, getStoredApiKey } from "./client";

const API_BASE_URL = getApiBaseUrl();

export const createPhysicalAsset = (payload: {
  name_asset: string;
  estimated_value: string;
  valuation_date: string;
  notes?: string | null;
}) => apiRequest<{ asset_id: number; name_asset: string }>("/patrimony/physical-assets", { method: "POST", body: JSON.stringify(payload) });

export const createCashAsset = (payload: {
  name_asset: string;
  amount: string;
  valuation_date: string;
  notes?: string | null;
}) => apiRequest<{ asset_id: number; name_asset: string }>("/patrimony/cash-assets", { method: "POST", body: JSON.stringify(payload) });

export const createMarketAsset = (payload: {
  name_asset: string;
  ticker: string;
  asset_type_code: string;
  quantity: string;
  buy_unit_price: string;
  valuation_date: string;
  notes?: string | null;
}) => apiRequest<{ asset_id: number; name_asset: string }>("/patrimony/market-assets", { method: "POST", body: JSON.stringify(payload) });

export type WalletBtcMovement = {
  txid: string | null;
  movement_date: string;
  quantity_btc: string;
  historical_unit_price_eur: string | null;
  estimated_total_eur: string | null;
};

export type WalletBtcEstimate = {
  address: string;
  asset_name: string;
  ticker: string;
  current_balance_btc: string;
  incoming_quantity_btc: string;
  outgoing_quantity_btc: string;
  average_buy_price_eur: string;
  estimated_cost_basis_eur: string;
  current_unit_price_eur: string;
  current_value_eur: string;
  unrealized_pnl_eur: string;
  movement_count: number;
  warnings: string[];
  movements: WalletBtcMovement[];
};

export type LedgerCsvMovement = {
  txid: string | null;
  movement_date: string;
  quantity: string;
  historical_unit_price_eur: string | null;
  estimated_total_eur: string | null;
  account_name: string;
  operation_type: string;
};

export type LedgerCsvEstimate = {
  asset_ticker: string;
  yahoo_symbol: string;
  current_quantity: string;
  incoming_quantity: string;
  outgoing_quantity: string;
  average_buy_price_eur: string;
  estimated_cost_basis_eur: string;
  current_unit_price_eur: string;
  current_value_eur: string;
  unrealized_pnl_eur: string;
  movement_count: number;
  warnings: string[];
  movements: LedgerCsvMovement[];
};

export const refreshAssetPrice = (id: number) =>
  apiRequest<{ asset_id: number; name_asset: string }>(`/patrimony/assets/${id}/refresh-price`, { method: "POST" });

export const estimateBtcWallet = (address: string) =>
  apiRequest<WalletBtcEstimate>(`/patrimony/wallets/btc/estimate?address=${encodeURIComponent(address)}`);

export async function estimateLedgerCsv(file: File, assetTicker: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/patrimony/ledger/estimate?asset_ticker=${encodeURIComponent(assetTicker)}`, {
    method: "POST",
    headers: (() => {
      const apiKey = getStoredApiKey();
      return apiKey ? { "X-API-Key": apiKey } : undefined;
    })(),
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API error ${response.status}`);
  }
  return response.json() as Promise<LedgerCsvEstimate>;
}

export async function importLedgerCsv(file: File, assetTicker: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/patrimony/ledger/import?asset_ticker=${encodeURIComponent(assetTicker)}`, {
    method: "POST",
    headers: (() => {
      const apiKey = getStoredApiKey();
      return apiKey ? { "X-API-Key": apiKey } : undefined;
    })(),
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API error ${response.status}`);
  }
  return response.json() as Promise<{ asset_id: number; name_asset: string }>;
}

export const updateAsset = (id: number, payload: {
  name_asset: string;
  estimated_value: string;
  valuation_date: string;
  notes?: string | null;
}) => apiRequest<{ asset_id: number; name_asset: string }>(`/patrimony/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteAsset = (id: number) => apiRequest<void>(`/patrimony/assets/${id}`, { method: "DELETE" });
