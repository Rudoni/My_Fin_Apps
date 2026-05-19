import { Pencil, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Income } from "../../api/budget";
import { MetricCard } from "../../components/MetricCard";

type IncomeDashboardProps = {
  incomes: Income[];
  monthlyComplementaryIncomeChart: Array<{ month: string; value: number }>;
  monthlyTotalIncomeChart: Array<{ month: string; value: number }>;
  incomeTypeChart: Array<{ type: string; value: number }>;
  totalIncome: number;
  complementaryIncome: number;
  totalIncomeWithComplementary: number;
  averageIncomePerEntry: number;
  averageIncomePerMonth: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  money: (value: string | number | null | undefined) => string;
  onEditIncome: (income: Income) => void;
  onDeleteIncome: (income: Income) => void;
  onPageSizeChange: (value: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function IncomeDashboard({
  incomes,
  monthlyComplementaryIncomeChart,
  monthlyTotalIncomeChart,
  incomeTypeChart,
  totalIncome,
  complementaryIncome,
  totalIncomeWithComplementary,
  averageIncomePerEntry,
  averageIncomePerMonth,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  money,
  onEditIncome,
  onDeleteIncome,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: IncomeDashboardProps) {
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedIncomes = incomes.slice(pageStart, pageStart + pageSize);

  return (
    <>
      <section className="metric-grid">
        <MetricCard label="Revenus saisis" value={money(totalIncome)} />
        <MetricCard label="Revente réalisée" value={money(complementaryIncome)} />
        <MetricCard label="Revenus complets" value={money(totalIncomeWithComplementary)} />
        <MetricCard label="Entrées revenus" value={`${incomes.length}`} />
        <MetricCard label="Moyenne / entrée" value={money(averageIncomePerEntry)} />
        <MetricCard label="Moyenne / mois saisi" value={money(averageIncomePerMonth)} />
      </section>

      <section className="content-grid wide-right">
        <section className="panel chart-panel table-panel">
          <div className="section-title">Revenus complets par mois</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTotalIncomeChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#17211d" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel chart-panel table-panel">
          <div className="section-title">Revente réalisée par mois</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyComplementaryIncomeChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#b45309" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>

      <section className="panel chart-panel table-panel">
        <div className="section-title">Répartition par type de revenu saisi</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={incomeTypeChart}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="type" />
            <YAxis />
            <Tooltip formatter={(value) => money(String(value))} />
            <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="section-title">Historique complet des revenus</div>
          <div className="filters">
            <label className="table-size-field">
              Lignes
              <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th>Date</th>
                <th>Montant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paginatedIncomes.map((income) => (
                <tr key={income.income_id}>
                  <td>{income.description_income}</td>
                  <td>{income.income_type}</td>
                  <td>{income.income_date}</td>
                  <td>{money(income.amount)}</td>
                  <td className="actions">
                    <button type="button" onClick={() => onEditIncome(income)}><Pencil size={16} /> Modifier</button>
                    <button className="danger-button" type="button" onClick={() => onDeleteIncome(income)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incomes.length > pageSize ? (
          <div className="table-footer">
            <span>{incomes.length} lignes · page {currentPage} / {totalPages}</span>
            <div className="pagination-actions">
              <button className="ghost-button" type="button" disabled={currentPage === 1} onClick={onPreviousPage}>Prec.</button>
              <button className="ghost-button" type="button" disabled={currentPage === totalPages} onClick={onNextPage}>Suiv.</button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
