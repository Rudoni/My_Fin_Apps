import { Pencil, Trash2 } from "lucide-react";
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
  return (
    <section className="full-width-section">
      <section className="panel table-panel compact-table wide-table-panel">
        <div className="section-title">Dernières dépenses</div>
        <div className="table-scroll">
          <table>
            <tbody>
              {expenses.slice(0, 10).map((expense) => (
                <tr key={expense.expense_id}>
                  <td>{expense.description_expense}</td>
                  <td>{money(expense.price)}</td>
                  <td>{expense.expense_date}</td>
                  <td>{expense.subcategory}</td>
                  <td className="actions">
                    <button type="button" onClick={() => onEditExpense(expense)}><Pencil size={16} /> Modifier</button>
                    <button className="danger-button" type="button" onClick={() => onDeleteExpense(expense)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
