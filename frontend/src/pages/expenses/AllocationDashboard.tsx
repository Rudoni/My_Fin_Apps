import { Pencil, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Allocation } from "../../api/budget";
import { MetricCard } from "../../components/MetricCard";

type AllocationDashboardProps = {
  allocations: Allocation[];
  monthlyAllocationChart: Array<{ month: string; value: number }>;
  allocationGroupChart: Array<{ name: string; value: number }>;
  allocationTotal: number;
  freeCashflowAfterAllocations: number;
  averageAllocationPerEntry: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  money: (value: string | number | null | undefined) => string;
  onEditAllocation: (allocation: Allocation) => void;
  onDeleteAllocation: (allocation: Allocation) => void;
  onPageSizeChange: (value: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function AllocationDashboard({
  allocations,
  monthlyAllocationChart,
  allocationGroupChart,
  allocationTotal,
  freeCashflowAfterAllocations,
  averageAllocationPerEntry,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  money,
  onEditAllocation,
  onDeleteAllocation,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: AllocationDashboardProps) {
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedAllocations = allocations.slice(pageStart, pageStart + pageSize);

  return (
    <>
      <section className="metric-grid">
        <MetricCard label="Alloué / investi" value={money(allocationTotal)} hint="Transferts internes hors dépenses de vie" />
        <MetricCard label="Mouvements allocation" value={`${allocations.length}`} />
        <MetricCard label="Moyenne / mouvement" value={money(averageAllocationPerEntry)} />
        <MetricCard label="Reste après allocation" value={money(freeCashflowAfterAllocations)} />
      </section>

      <section className="content-grid wide-right">
        <section className="panel chart-panel table-panel">
          <div className="section-title">Allocations par mois</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyAllocationChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#17211d" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel chart-panel table-panel">
          <div className="section-title">Répartition des allocations</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={allocationGroupChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="section-title">Historique des allocations internes</div>
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
                <th>Groupe</th>
                <th>Destination</th>
                <th>Date</th>
                <th>Montant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paginatedAllocations.map((allocation) => (
                <tr key={allocation.allocation_id}>
                  <td>{allocation.description_allocation}</td>
                  <td>{allocation.allocation_group}</td>
                  <td>{allocation.allocation_target}</td>
                  <td>{allocation.allocation_date}</td>
                  <td>{money(allocation.amount)}</td>
                  <td className="actions">
                    <button type="button" onClick={() => onEditAllocation(allocation)}><Pencil size={16} /> Modifier</button>
                    <button className="danger-button" type="button" onClick={() => onDeleteAllocation(allocation)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allocations.length > pageSize ? (
          <div className="table-footer">
            <span>{allocations.length} lignes · page {currentPage} / {totalPages}</span>
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
