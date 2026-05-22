import { FormEvent, useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BudgetSummary, getBudgetSummary } from "../api/dashboard";
import {
  Allocation,
  createExpense,
  createAllocation,
  createIncome,
  deleteExpense,
  deleteAllocation,
  deleteIncome,
  Expense,
  getAllocations,
  getBudgetYears,
  getExpenses,
  getIncomes,
  getPaymentMethods,
  getSubcategories,
  Income,
  OptionItem,
  updateAllocation,
  updateExpense,
  updateIncome,
} from "../api/budget";
import { MetricCard } from "../components/MetricCard";
import { Modal } from "../components/Modal";
import { YearFilter } from "../components/YearFilter";
import { useIsMobile } from "../hooks/useIsMobile";
import { AllocationDashboard } from "./expenses/AllocationDashboard";
import { ExpenseForms } from "./expenses/ExpenseForms";
import { IncomeDashboard } from "./expenses/IncomeDashboard";
import { ExpenseTables } from "./expenses/ExpenseTables";

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const today = new Date().toISOString().slice(0, 10);
const currentYear = new Date().getFullYear();
const INCOME_PAGE_SIZE_OPTIONS = [20, 50, 100];
const ALLOCATION_PAGE_SIZE_OPTIONS = [20, 50, 100];
const ALLOCATION_GROUP_OPTIONS = [
  "Investissement",
  "Epargne securite",
  "Coffre Pokemon",
  "Crypto",
  "Achat-revente",
  "Brocante",
  "Autre",
];

function money(value: string | number | null | undefined) {
  return euroFormatter.format(Number(value ?? 0));
}

function metricMonth(dateValue: string) {
  return dateValue.slice(0, 7);
}

function matchesYearsFilter(dateValue: string, years: number[]) {
  if (years.length === 0) return true;
  return years.includes(Number(dateValue.slice(0, 4)));
}

function upsertTimeMetric(metrics: BudgetSummary["expense_by_month"], label: string, delta: number) {
  const nextMetrics = [...metrics];
  const existingIndex = nextMetrics.findIndex((metric) => metric.label === label);
  if (existingIndex >= 0) {
    const currentValue = Number(nextMetrics[existingIndex].value ?? 0);
    nextMetrics[existingIndex] = { ...nextMetrics[existingIndex], value: String(currentValue + delta) };
  } else {
    nextMetrics.push({ label, value: String(delta) });
    nextMetrics.sort((left, right) => left.label.localeCompare(right.label));
  }
  return nextMetrics;
}

function upsertNameMetric(metrics: BudgetSummary["expense_by_category"], name: string, delta: number) {
  const nextMetrics = [...metrics];
  const existingIndex = nextMetrics.findIndex((metric) => metric.name === name);
  if (existingIndex >= 0) {
    const currentValue = Number(nextMetrics[existingIndex].value ?? 0);
    nextMetrics[existingIndex] = { ...nextMetrics[existingIndex], value: String(currentValue + delta) };
  } else {
    nextMetrics.push({ name, value: String(delta) });
  }
  nextMetrics.sort((left, right) => Number(right.value) - Number(left.value));
  return nextMetrics;
}

function applyExpenseToSummary(current: BudgetSummary | null, expense: Expense, direction: 1 | -1) {
  if (!current) return current;
  const delta = Number(expense.price ?? 0) * direction;
  if (!delta) return current;

  return {
    ...current,
    expense_total: String(Number(current.expense_total ?? 0) + delta),
    cashflow_total: String(Number(current.cashflow_total ?? 0) - delta),
    cashflow_with_complementary: String(Number(current.cashflow_with_complementary ?? 0) - delta),
    cashflow_after_allocations: String(Number(current.cashflow_after_allocations ?? 0) - delta),
    expense_by_month: upsertTimeMetric(current.expense_by_month, metricMonth(expense.expense_date), delta),
    expense_by_category: upsertNameMetric(current.expense_by_category, expense.category, delta),
  };
}

export function ExpensesPage() {
  const isMobile = useIsMobile();
  const latestContentRequestRef = useRef(0);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subcategories, setSubcategories] = useState<OptionItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<OptionItem[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear]);
  const [incomeForm, setIncomeForm] = useState({ description_income: "", amount: "", income_date: today, income_type: "Salaire" });
  const [allocationForm, setAllocationForm] = useState({
    description_allocation: "",
    amount: "",
    allocation_date: today,
    allocation_group: ALLOCATION_GROUP_OPTIONS[0],
    allocation_target: "PEA / Bourse",
    notes: "",
  });
  const [expenseForm, setExpenseForm] = useState({ description_expense: "", price: "", expense_date: today, subcategory_id: 0, payment_method_id: 0 });
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeEditForm, setIncomeEditForm] = useState({ description_income: "", amount: "", income_date: today, income_type: "Salaire" });
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [allocationEditForm, setAllocationEditForm] = useState({
    description_allocation: "",
    amount: "",
    allocation_date: today,
    allocation_group: ALLOCATION_GROUP_OPTIONS[0],
    allocation_target: "",
    notes: "",
  });
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseEditForm, setExpenseEditForm] = useState({ description_expense: "", price: "", expense_date: today, subcategory_id: 0, payment_method_id: 0 });
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
  const [allocationToDelete, setAllocationToDelete] = useState<Allocation | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(20);
  const [allocationPage, setAllocationPage] = useState(1);
  const [allocationPageSize, setAllocationPageSize] = useState(20);
  const [mobileSection, setMobileSection] = useState<"capture" | "history" | "pilotage">("capture");

  async function loadContent(years = selectedYears) {
    const requestId = latestContentRequestRef.current + 1;
    latestContentRequestRef.current = requestId;
    const [summaryData, incomesData, allocationsData, expensesData] = await Promise.all([
      getBudgetSummary(years),
      getIncomes(years),
      getAllocations(years),
      getExpenses(years),
    ]);
    if (latestContentRequestRef.current !== requestId) return;
    setSummary(summaryData);
    setIncomes(incomesData);
    setAllocations(allocationsData);
    setExpenses(expensesData);
  }

  async function loadReferenceData() {
    const [subcats, payments] = await Promise.all([
      getSubcategories(),
      getPaymentMethods(),
    ]);
    setSubcategories(subcats);
    setPaymentMethods(payments);
    setExpenseForm((form) => ({
      ...form,
      subcategory_id: form.subcategory_id || subcats[0]?.id || 0,
      payment_method_id: form.payment_method_id || payments[0]?.id || 0,
    }));
  }

  async function refreshAvailableYears() {
    const yearsData = await getBudgetYears();
    setAvailableYears(yearsData);
  }

  useEffect(() => {
    void loadContent();
  }, [selectedYears]);

  useEffect(() => {
    setIncomePage(1);
  }, [selectedYears, incomePageSize]);

  useEffect(() => {
    setAllocationPage(1);
  }, [selectedYears, allocationPageSize]);

  useEffect(() => {
    void loadReferenceData();
    void refreshAvailableYears();
  }, []);

  async function submitIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createIncome({ ...incomeForm, amount: incomeForm.amount || "0" });
    setIncomeForm({ description_income: "", amount: "", income_date: today, income_type: "Salaire" });
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createAllocation({
      ...allocationForm,
      amount: allocationForm.amount || "0",
      notes: allocationForm.notes || null,
    });
    setAllocationForm({
      description_allocation: "",
      amount: "",
      allocation_date: today,
      allocation_group: ALLOCATION_GROUP_OPTIONS[0],
      allocation_target: "PEA / Bourse",
      notes: "",
    });
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const yearsSnapshot = [...selectedYears];
    const createdExpense = await createExpense({ ...expenseForm, price: expenseForm.price || "0" });
    const matchesCurrentFilter = matchesYearsFilter(createdExpense.expense_date, yearsSnapshot);
    if (matchesCurrentFilter) {
      setExpenses((current) =>
        [createdExpense, ...current]
          .sort((a, b) => {
            if (a.expense_date === b.expense_date) return b.expense_id - a.expense_id;
            return b.expense_date.localeCompare(a.expense_date);
          }),
      );
      setSummary((current) => applyExpenseToSummary(current, createdExpense, 1));
    }
    setExpenseForm((form) => ({ ...form, description_expense: "", price: "", expense_date: today }));
    await Promise.all([loadContent(yearsSnapshot), refreshAvailableYears()]);
  }

  function openIncomeEdit(income: Income) {
    setEditingIncome(income);
    setIncomeEditForm({
      description_income: income.description_income,
      amount: income.amount,
      income_date: income.income_date,
      income_type: income.income_type,
    });
  }

  function openAllocationEdit(allocation: Allocation) {
    setEditingAllocation(allocation);
    setAllocationEditForm({
      description_allocation: allocation.description_allocation,
      amount: allocation.amount,
      allocation_date: allocation.allocation_date,
      allocation_group: allocation.allocation_group,
      allocation_target: allocation.allocation_target,
      notes: allocation.notes ?? "",
    });
  }

  function openExpenseEdit(expense: Expense) {
    setEditingExpense(expense);
    setExpenseEditForm({
      description_expense: expense.description_expense,
      price: expense.price,
      expense_date: expense.expense_date,
      subcategory_id: expense.subcategory_id,
      payment_method_id: expense.payment_method_id,
    });
  }

  async function submitIncomeEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingIncome) return;
    await updateIncome(editingIncome.income_id, { ...incomeEditForm, amount: incomeEditForm.amount || "0" });
    setEditingIncome(null);
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function submitAllocationEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAllocation) return;
    await updateAllocation(editingAllocation.allocation_id, {
      ...allocationEditForm,
      amount: allocationEditForm.amount || "0",
      notes: allocationEditForm.notes || null,
    });
    setEditingAllocation(null);
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function submitExpenseEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingExpense) return;
    await updateExpense(editingExpense.expense_id, { ...expenseEditForm, price: expenseEditForm.price || "0" });
    setEditingExpense(null);
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function confirmIncomeDelete() {
    if (!incomeToDelete) return;
    await deleteIncome(incomeToDelete.income_id);
    setIncomeToDelete(null);
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function confirmAllocationDelete() {
    if (!allocationToDelete) return;
    await deleteAllocation(allocationToDelete.allocation_id);
    setAllocationToDelete(null);
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  async function confirmExpenseDelete() {
    if (!expenseToDelete) return;
    await deleteExpense(expenseToDelete.expense_id);
    setExpenseToDelete(null);
    await Promise.all([loadContent(), refreshAvailableYears()]);
  }

  const monthlyExpenseChart = (summary?.expense_by_month ?? []).map((row) => ({
    month: row.label,
    value: Number(row.value),
  }));
  const monthlyIncomeChart = (summary?.income_by_month ?? []).map((row) => ({
    month: row.label,
    value: Number(row.value),
  }));
  const monthlyComplementaryIncomeChart = (summary?.complementary_income_by_month ?? []).map((row) => ({
    month: row.label,
    value: Number(row.value),
  }));
  const monthlyTotalIncomeChart = (summary?.income_with_complementary_by_month ?? []).map((row) => ({
    month: row.label,
    value: Number(row.value),
  }));
  const monthlyAllocationChart = (summary?.allocation_by_month ?? []).map((row) => ({
    month: row.label,
    value: Number(row.value),
  }));
  const allocationGroupChart = (summary?.allocation_by_group ?? []).map((row) => ({
    name: row.name,
    value: Number(row.value),
  }));
  const incomeTypeTotals = incomes.reduce<Record<string, number>>((acc, income) => {
    const key = income.income_type || "Autres";
    acc[key] = (acc[key] ?? 0) + Number(income.amount ?? 0);
    return acc;
  }, {});
  const incomeTypeChart = Object.entries(incomeTypeTotals)
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value);
  const totalIncome = incomes.reduce((acc, income) => acc + Number(income.amount ?? 0), 0);
  const averageIncomePerEntry = incomes.length ? totalIncome / incomes.length : 0;
  const averageIncomePerMonth = monthlyIncomeChart.length
    ? monthlyIncomeChart.reduce((acc, row) => acc + row.value, 0) / monthlyIncomeChart.length
    : 0;
  const totalAllocation = allocations.reduce((acc, allocation) => acc + Number(allocation.amount ?? 0), 0);
  const averageAllocationPerEntry = allocations.length ? totalAllocation / allocations.length : 0;
  const incomeTotalPages = Math.max(1, Math.ceil(incomes.length / incomePageSize));
  const allocationTotalPages = Math.max(1, Math.ceil(allocations.length / allocationPageSize));
  const recentBudgetEvents = [
    ...expenses.slice(0, 8).map((expense) => ({
      id: `expense-${expense.expense_id}`,
      title: expense.description_expense,
      subtitle: `${expense.subcategory} · ${expense.expense_date}`,
      value: money(expense.price),
      type: "Dépense",
    })),
    ...allocations.slice(0, 6).map((allocation) => ({
      id: `allocation-${allocation.allocation_id}`,
      title: allocation.description_allocation,
      subtitle: `${allocation.allocation_group} → ${allocation.allocation_target} · ${allocation.allocation_date}`,
      value: money(allocation.amount),
      type: "Allocation",
    })),
  ]
    .sort((left, right) => right.subtitle.localeCompare(left.subtitle))
    .slice(0, 10);

  return (
    <main className="page-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Budget</p>
          <h1>Dépenses</h1>
          <p>Ajoute tes revenus, tes sorties, et garde une lecture claire du cashflow.</p>
        </div>
        <div className="hero-actions">
          <YearFilter years={availableYears} selectedYears={selectedYears} onChange={setSelectedYears} />
        </div>
      </header>

      {isMobile ? (
        <section className="panel mobile-switcher-panel">
          <div className="mobile-section-switcher">
            <button className={mobileSection === "capture" ? "primary-button" : "ghost-button"} type="button" onClick={() => setMobileSection("capture")}>
              Saisir
            </button>
            <button className={mobileSection === "history" ? "primary-button" : "ghost-button"} type="button" onClick={() => setMobileSection("history")}>
              Historique
            </button>
            <button className={mobileSection === "pilotage" ? "primary-button" : "ghost-button"} type="button" onClick={() => setMobileSection("pilotage")}>
              Pilotage
            </button>
          </div>
        </section>
      ) : null}

      {(!isMobile || mobileSection === "pilotage") ? (
      <section className="metric-grid">
        <MetricCard label="Revenus saisis" value={money(summary?.income_total)} />
        <MetricCard label="Revenus complémentaires" value={money(summary?.complementary_income_total)} hint="Bénéfice revente réalisé" />
        <MetricCard label="Dépenses total" value={money(summary?.expense_total)} />
        <MetricCard label="Alloué / investi" value={money(summary?.allocation_total)} hint="Transferts internes hors dépenses" />
        <MetricCard label="Cashflow enrichi" value={money(summary?.cashflow_with_complementary)} />
        <MetricCard label="Reste après allocation" value={money(summary?.cashflow_after_allocations)} />
      </section>
      ) : isMobile ? (
        <section className="mobile-summary-strip">
          <MetricCard label="Dépenses" value={money(summary?.expense_total)} />
          <MetricCard label="Alloué" value={money(summary?.allocation_total)} />
          <MetricCard label="Reste libre" value={money(summary?.cashflow_after_allocations)} />
        </section>
      ) : null}

      {(!isMobile || mobileSection === "capture") ? (
      <ExpenseForms
        incomeForm={incomeForm}
        expenseForm={expenseForm}
        subcategories={subcategories}
        paymentMethods={paymentMethods}
        onIncomeFormChange={setIncomeForm}
        onExpenseFormChange={setExpenseForm}
        onSubmitIncome={(event) => void submitIncome(event)}
        onSubmitExpense={(event) => void submitExpense(event)}
        prioritizeExpense={isMobile}
      />
      ) : null}

      {(!isMobile || mobileSection === "capture") ? (
      <section className="panel form-panel">
        <div className="section-title">Ajouter une allocation interne</div>
        <p className="section-copy">
          Utilise cette zone pour les mouvements du style <strong>salaire vers PEA</strong>, <strong>cash vers livret</strong> ou
          <strong> coffre Pokémon</strong>, sans les compter comme des dépenses de vie.
        </p>
        <form onSubmit={(event) => void submitAllocation(event)}>
          <label>
            Description
            <input
              value={allocationForm.description_allocation}
              onChange={(event) => setAllocationForm({ ...allocationForm, description_allocation: event.target.value })}
              placeholder="Ex: Virement salaire vers PEA"
            />
          </label>
          <div className="form-row">
            <label>
              Montant
              <input type="number" value={allocationForm.amount} onChange={(event) => setAllocationForm({ ...allocationForm, amount: event.target.value })} />
            </label>
            <label>
              Date
              <input
                type="date"
                value={allocationForm.allocation_date}
                onChange={(event) => setAllocationForm({ ...allocationForm, allocation_date: event.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Groupe
              <select
                value={allocationForm.allocation_group}
                onChange={(event) => setAllocationForm({ ...allocationForm, allocation_group: event.target.value })}
              >
                {ALLOCATION_GROUP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destination
              <input
                value={allocationForm.allocation_target}
                onChange={(event) => setAllocationForm({ ...allocationForm, allocation_target: event.target.value })}
                placeholder="Ex: PEA / Livret A / Coffre Pokemon"
              />
            </label>
          </div>
          <label>
            Notes
            <input value={allocationForm.notes} onChange={(event) => setAllocationForm({ ...allocationForm, notes: event.target.value })} />
          </label>
          <button className="primary-button">Ajouter allocation</button>
        </form>
      </section>
      ) : null}

      {(!isMobile || mobileSection === "pilotage") ? (
      <IncomeDashboard
        incomes={incomes}
        monthlyComplementaryIncomeChart={monthlyComplementaryIncomeChart}
        monthlyTotalIncomeChart={monthlyTotalIncomeChart}
        incomeTypeChart={incomeTypeChart}
        totalIncome={totalIncome}
        complementaryIncome={Number(summary?.complementary_income_total ?? 0)}
        totalIncomeWithComplementary={Number(summary?.total_income_with_complementary ?? 0)}
        averageIncomePerEntry={averageIncomePerEntry}
        averageIncomePerMonth={averageIncomePerMonth}
        currentPage={incomePage}
        totalPages={incomeTotalPages}
        pageSize={incomePageSize}
        pageSizeOptions={INCOME_PAGE_SIZE_OPTIONS}
        money={money}
        onEditIncome={openIncomeEdit}
        onDeleteIncome={setIncomeToDelete}
        onPageSizeChange={setIncomePageSize}
        onPreviousPage={() => setIncomePage((page) => Math.max(1, page - 1))}
        onNextPage={() => setIncomePage((page) => Math.min(incomeTotalPages, page + 1))}
      />
      ) : null}

      {(!isMobile || mobileSection === "pilotage") ? (
      <AllocationDashboard
        allocations={allocations}
        monthlyAllocationChart={monthlyAllocationChart}
        allocationGroupChart={allocationGroupChart}
        allocationTotal={Number(summary?.allocation_total ?? totalAllocation)}
        freeCashflowAfterAllocations={Number(summary?.cashflow_after_allocations ?? 0)}
        averageAllocationPerEntry={averageAllocationPerEntry}
        currentPage={allocationPage}
        totalPages={allocationTotalPages}
        pageSize={allocationPageSize}
        pageSizeOptions={ALLOCATION_PAGE_SIZE_OPTIONS}
        money={money}
        onEditAllocation={openAllocationEdit}
        onDeleteAllocation={setAllocationToDelete}
        onPageSizeChange={setAllocationPageSize}
        onPreviousPage={() => setAllocationPage((page) => Math.max(1, page - 1))}
        onNextPage={() => setAllocationPage((page) => Math.min(allocationTotalPages, page + 1))}
      />
      ) : null}

      {(!isMobile || mobileSection === "pilotage") ? (
      <section className="content-grid wide-right">
        <section className="panel chart-panel table-panel">
          <div className="section-title">Dépenses par mois</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyExpenseChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel chart-panel table-panel">
          <div className="section-title">Dépenses par catégorie</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(summary?.expense_by_category ?? []).map((row) => ({ name: row.name, value: Number(row.value) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#b45309" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>
      ) : null}

      {(!isMobile || mobileSection === "history") ? (
      <ExpenseTables
        expenses={expenses}
        money={money}
        onEditExpense={openExpenseEdit}
        onDeleteExpense={setExpenseToDelete}
      />
      ) : null}

      {isMobile && mobileSection === "history" ? (
        <section className="panel mobile-list-panel">
          <div className="section-title">Derniers mouvements</div>
          <div className="mobile-inventory-list">
            {recentBudgetEvents.map((item) => (
              <article key={item.id} className="mobile-item-card">
                <div className="mobile-item-card-head">
                  <div>
                    <strong>{item.title}</strong>
                    <div className="mobile-item-badges">
                      <span className="status-pill">{item.type}</span>
                    </div>
                  </div>
                  <strong>{item.value}</strong>
                </div>
                <p className="section-copy">{item.subtitle}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editingIncome ? (
        <Modal title="Modifier le revenu" eyebrow="Budget" onClose={() => setEditingIncome(null)}>
          <form className="modal-form" onSubmit={(event) => void submitIncomeEdit(event)}>
            <label>
              Description
              <input value={incomeEditForm.description_income} onChange={(event) => setIncomeEditForm({ ...incomeEditForm, description_income: event.target.value })} />
            </label>
            <div className="form-row">
              <label>
                Montant
                <input type="number" value={incomeEditForm.amount} onChange={(event) => setIncomeEditForm({ ...incomeEditForm, amount: event.target.value })} />
              </label>
              <label>
                Date
                <input type="date" value={incomeEditForm.income_date} onChange={(event) => setIncomeEditForm({ ...incomeEditForm, income_date: event.target.value })} />
              </label>
            </div>
            <label>
              Type
              <input value={incomeEditForm.income_type} onChange={(event) => setIncomeEditForm({ ...incomeEditForm, income_type: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingIncome(null)}>Annuler</button>
              <button className="primary-button" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editingAllocation ? (
        <Modal title="Modifier l'allocation" eyebrow="Budget" onClose={() => setEditingAllocation(null)}>
          <form className="modal-form" onSubmit={(event) => void submitAllocationEdit(event)}>
            <label>
              Description
              <input
                value={allocationEditForm.description_allocation}
                onChange={(event) => setAllocationEditForm({ ...allocationEditForm, description_allocation: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Montant
                <input type="number" value={allocationEditForm.amount} onChange={(event) => setAllocationEditForm({ ...allocationEditForm, amount: event.target.value })} />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={allocationEditForm.allocation_date}
                  onChange={(event) => setAllocationEditForm({ ...allocationEditForm, allocation_date: event.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Groupe
                <select
                  value={allocationEditForm.allocation_group}
                  onChange={(event) => setAllocationEditForm({ ...allocationEditForm, allocation_group: event.target.value })}
                >
                  {ALLOCATION_GROUP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination
                <input
                  value={allocationEditForm.allocation_target}
                  onChange={(event) => setAllocationEditForm({ ...allocationEditForm, allocation_target: event.target.value })}
                />
              </label>
            </div>
            <label>
              Notes
              <input value={allocationEditForm.notes} onChange={(event) => setAllocationEditForm({ ...allocationEditForm, notes: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingAllocation(null)}>Annuler</button>
              <button className="primary-button" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editingExpense ? (
        <Modal title="Modifier la dépense" eyebrow="Budget" onClose={() => setEditingExpense(null)}>
          <form className="modal-form" onSubmit={(event) => void submitExpenseEdit(event)}>
            <label>
              Description
              <input value={expenseEditForm.description_expense} onChange={(event) => setExpenseEditForm({ ...expenseEditForm, description_expense: event.target.value })} />
            </label>
            <div className="form-row">
              <label>
                Montant
                <input type="number" value={expenseEditForm.price} onChange={(event) => setExpenseEditForm({ ...expenseEditForm, price: event.target.value })} />
              </label>
              <label>
                Date
                <input type="date" value={expenseEditForm.expense_date} onChange={(event) => setExpenseEditForm({ ...expenseEditForm, expense_date: event.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Sous-catégorie
                <select value={expenseEditForm.subcategory_id} onChange={(event) => setExpenseEditForm({ ...expenseEditForm, subcategory_id: Number(event.target.value) })}>
                  {subcategories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              <label>
                Paiement
                <select value={expenseEditForm.payment_method_id} onChange={(event) => setExpenseEditForm({ ...expenseEditForm, payment_method_id: Number(event.target.value) })}>
                  {paymentMethods.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingExpense(null)}>Annuler</button>
              <button className="primary-button" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {incomeToDelete ? (
        <Modal title="Supprimer ce revenu ?" eyebrow="Confirmation" onClose={() => setIncomeToDelete(null)}>
          <p className="modal-copy">Tu vas supprimer <strong>{incomeToDelete.description_income}</strong> de ton suivi.</p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setIncomeToDelete(null)}>Garder</button>
            <button className="primary-button danger-primary" type="button" onClick={() => void confirmIncomeDelete()}>Supprimer</button>
          </div>
        </Modal>
      ) : null}

      {allocationToDelete ? (
        <Modal title="Supprimer cette allocation ?" eyebrow="Confirmation" onClose={() => setAllocationToDelete(null)}>
          <p className="modal-copy">Tu vas supprimer <strong>{allocationToDelete.description_allocation}</strong> de ton suivi.</p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setAllocationToDelete(null)}>Garder</button>
            <button className="primary-button danger-primary" type="button" onClick={() => void confirmAllocationDelete()}>Supprimer</button>
          </div>
        </Modal>
      ) : null}

      {expenseToDelete ? (
        <Modal title="Supprimer cette dépense ?" eyebrow="Confirmation" onClose={() => setExpenseToDelete(null)}>
          <p className="modal-copy">Tu vas supprimer <strong>{expenseToDelete.description_expense}</strong> de ton suivi.</p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setExpenseToDelete(null)}>Garder</button>
            <button className="primary-button danger-primary" type="button" onClick={() => void confirmExpenseDelete()}>Supprimer</button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
