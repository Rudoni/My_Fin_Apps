import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Expense } from "../../api/budget";
import { useIsMobile } from "../../hooks/useIsMobile";

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
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("recent");
  const isMobile = useIsMobile();
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = expenses.filter((expense) => (kind === "all" || (kind === "recurring" ? expense.is_recurring : !expense.is_recurring)) && normalize([expense.description_expense, expense.category, expense.subcategory, expense.payment_method, expense.expense_date, expense.price].join(" ")).includes(normalize(search.trim())))
    .sort((a, b) => sort === "amount" ? Number(b.price) - Number(a.price) : b.expense_date.localeCompare(a.expense_date) || b.expense_id - a.expense_id);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value + "T12:00:00"));
  return (
    <section className="full-width-section">
      <section className="panel table-panel compact-table wide-table-panel">
        <div className="table-toolbar">
          <div className="section-title">Historique des dépenses</div>
          <label className="search-field"><input aria-label="Rechercher une dépense" placeholder="Description, catégorie, date…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        </div>
        <div className="history-controls">
          <div className="studio-tabs" aria-label="Type de dépense">{[["all", "Toutes"], ["recurring", "Récurrentes"], ["regular", "Courantes"]].map(([value, label]) => <button type="button" key={value} className={kind === value ? "active" : ""} aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }}>{label}</button>)}</div>
          <label>Trier par <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="recent">Plus récentes</option><option value="amount">Montant décroissant</option></select></label>
        </div>
        <p className="section-copy">{filtered.length} dépenses · Total des résultats : <span className="sensitive-value">{money(String(filtered.reduce((sum, expense) => sum + Number(expense.price), 0)))}</span></p>
        {isMobile ? <div className="expense-feed">
          {visible.map((expense) => <article className="expense-feed-item" key={expense.expense_id}>
            <div className="expense-feed-icon" aria-hidden="true">{expense.is_recurring ? "R" : expense.subcategory.slice(0, 1)}</div>
            <div><strong>{expense.description_expense}</strong><small>{formatDate(expense.expense_date)} · {expense.subcategory}</small>{expense.is_recurring && <span className="status-pill">Récurrente</span>}</div>
            <strong className="sensitive-value">{money(expense.price)}</strong>
            <div className="expense-feed-actions"><button type="button" className="ghost-button" onClick={() => onEditExpense(expense)}><Pencil size={14} /> Modifier</button><button type="button" className="icon-button" aria-label={`Supprimer ${expense.description_expense}`} onClick={() => onDeleteExpense(expense)}><Trash2 size={15} /></button></div>
          </article>)}
          {!visible.length && <p className="studio-empty">Aucun résultat. Essaie une autre recherche ou un autre filtre.</p>}
        </div> : <div className="table-scroll">
          <table>
            <thead><tr><th>Description</th><th>Montant</th><th>Date</th><th>Catégorie</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map((expense) => (
                <tr key={expense.expense_id}>
                  <td>{expense.description_expense} {expense.is_recurring && <span className="status-pill">Récurrente</span>}</td>
                  <td className="sensitive-value">{money(expense.price)}</td>
                  <td>{formatDate(expense.expense_date)}</td>
                  <td>{expense.subcategory}</td>
                  <td className="actions">
                    <button type="button" onClick={() => onEditExpense(expense)}><Pencil size={16} /> Modifier</button>
                    <button className="danger-button" aria-label={`Supprimer ${expense.description_expense}`} type="button" onClick={() => onDeleteExpense(expense)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5}>Aucune dépense pour cette recherche ou cette période.</td></tr>}
            </tbody>
          </table>
        </div>}
        <div className="table-footer">
          <label>Lignes par page <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label>
          <span>Page {current} / {pages}</span>
          <div className="pagination-actions"><button className="ghost-button" disabled={current === 1} onClick={() => setPage(current - 1)}>Précédent</button><button className="ghost-button" disabled={current === pages} onClick={() => setPage(current + 1)}>Suivant</button></div>
        </div>
      </section>
    </section>
  );
}
