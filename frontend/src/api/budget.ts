import { apiRequest } from "./client";

export type OptionItem = { id: number; name: string };
export type Income = {
  income_id: number;
  description_income: string;
  amount: string;
  income_date: string;
  income_type: string;
};
export type Allocation = {
  allocation_id: number;
  description_allocation: string;
  amount: string;
  allocation_date: string;
  allocation_group: string;
  allocation_target: string;
  notes: string | null;
};
export type Expense = {
  expense_id: number;
  description_expense: string;
  price: string;
  expense_date: string;
  subcategory_id: number;
  subcategory: string;
  category: string;
  payment_method_id: number;
  payment_method: string;
};

export type IncomePayload = Omit<Income, "income_id">;
export type AllocationPayload = Omit<Allocation, "allocation_id">;

export type ExpensePayload = {
  description_expense: string;
  price: string;
  expense_date: string;
  subcategory_id: number;
  payment_method_id: number;
};

function withYears(path: string, years: number[] = []) {
  const params = new URLSearchParams();
  years.forEach((year) => params.append("years", String(year)));
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export const getIncomes = (years: number[] = []) => apiRequest<Income[]>(withYears("/budget/incomes", years));
export const getAllocations = (years: number[] = []) => apiRequest<Allocation[]>(withYears("/budget/allocations", years));
export const getExpenses = (years: number[] = []) => apiRequest<Expense[]>(withYears("/budget/expenses", years));
export const getSubcategories = () => apiRequest<OptionItem[]>("/budget/options/subcategories");
export const getPaymentMethods = () => apiRequest<OptionItem[]>("/budget/options/payment-methods");
export const getBudgetYears = () => apiRequest<number[]>("/budget/years");

export const createIncome = (payload: IncomePayload) =>
  apiRequest<Income>("/budget/incomes", { method: "POST", body: JSON.stringify(payload) });
export const createAllocation = (payload: AllocationPayload) =>
  apiRequest<Allocation>("/budget/allocations", { method: "POST", body: JSON.stringify(payload) });
export const updateIncome = (id: number, payload: Partial<IncomePayload>) =>
  apiRequest<Income>(`/budget/incomes/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const updateAllocation = (id: number, payload: Partial<AllocationPayload>) =>
  apiRequest<Allocation>(`/budget/allocations/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteIncome = (id: number) => apiRequest<void>(`/budget/incomes/${id}`, { method: "DELETE" });
export const deleteAllocation = (id: number) => apiRequest<void>(`/budget/allocations/${id}`, { method: "DELETE" });

export const createExpense = (payload: ExpensePayload) =>
  apiRequest<Expense>("/budget/expenses", { method: "POST", body: JSON.stringify(payload) });
export const updateExpense = (id: number, payload: Partial<ExpensePayload>) =>
  apiRequest<Expense>(`/budget/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteExpense = (id: number) => apiRequest<void>(`/budget/expenses/${id}`, { method: "DELETE" });
