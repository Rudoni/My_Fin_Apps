import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Expense } from "../../api/budget";

type ExpenseTablesProps = {
  expenses: Expense[];
  money: (value: string | null | undefined) => string;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
};

export function ExpenseTables({
  expenses,
  money,
  onEditExpense,
  onDeleteExpense,
}: ExpenseTablesProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = expenses.filter((expense) => normalize([expense.description_expense, expense.category, expense.subcategory, expense.payment_method, expense.expense_date, expense.price].join(" ")).includes(normalize(search.trim())));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  return (
    <section className="full-width-section">
      <section className="panel table-panel compact-table wide-table-panel">
        <div className="table-toolbar">
          <div className="section-title">Historique des dépenses</div>
          <label className="search-field"><input aria-label="Rechercher une dépense" placeholder="Description, catégorie, date…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        </div>
        <p className="section-copy">{filtered.length} dépenses · Total des résultats : {money(String(filtered.reduce((sum, expense) => sum + Number(expense.price), 0)))}</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Description</th><th>Montant</th><th>Date</th><th>Catégorie</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.slice((current - 1) * pageSize, current * pageSize).map((expense) => (
                <tr key={expense.expense_id}>
                  <td>{expense.description_expense} {expense.is_recurring && <span className="status-pill">Récurrente</span>}</td>
                  <td>{money(expense.price)}</td>
                  <td>{expense.expense_date}</td>
                  <td>{expense.subcategory}</td>
                  <td className="actions">
                    <button type="button" onClick={() => onEditExpense(expense)}><Pencil size={16} /> Modifier</button>
                    <button className="danger-button" type="button" onClick={() => onDeleteExpense(expense)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5}>Aucune dépense pour cette recherche ou cette période.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <label>Lignes par page <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label>
          <span>Page {current} / {pages}</span>
          <div className="pagination-actions"><button className="ghost-button" disabled={current === 1} onClick={() => setPage(current - 1)}>Précédent</button><button className="ghost-button" disabled={current === pages} onClick={() => setPage(current + 1)}>Suivant</button></div>
        </div>
      </section>
    </section>
  );
}
