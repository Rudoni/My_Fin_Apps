const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type InvestmentPlanSummary = {
  avg_monthly_income: string;
  avg_monthly_expense: string;
  avg_monthly_cashflow: string;
  cash_available: string;
  safety_target: string;
  jobless_safety_target: string;
  protected_cash_target: string;
  cash_above_safety: string;
  opportunity_cash: string;
  pokemon_war_chest_target: string;
  monthly_pokemon_saving_needed: string;
  monthly_security_saving_needed: string;
  months_until_income_stop: number;
  months_until_pokemon_event: number;
  planned_purchase: string;
  cash_after_purchase: string;
  safety_months_after_purchase: string;
  pokemon_month_spend: string;
  status: "green" | "orange" | "red";
  message: string;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json() as Promise<T>;
}

export function getInvestmentPlanSummary(params: {
  safetyMonths: string;
  comfortBuffer: string;
  plannedPurchase: string;
  incomeStopDate: string;
  noIncomeMonths: string;
  pokemonWarChestTarget: string;
  pokemonEventDate: string;
}) {
  const query = new URLSearchParams({
    safety_months: params.safetyMonths || "0",
    comfort_buffer: params.comfortBuffer || "0",
    planned_purchase: params.plannedPurchase || "0",
    income_stop_date: params.incomeStopDate,
    no_income_months: params.noIncomeMonths || "0",
    pokemon_war_chest_target: params.pokemonWarChestTarget || "0",
    pokemon_event_date: params.pokemonEventDate,
  });
  return request<InvestmentPlanSummary>(`/investment-plan/summary?${query.toString()}`);
}
