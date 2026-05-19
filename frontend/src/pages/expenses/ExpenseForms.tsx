import type { FormEvent } from "react";
import type { OptionItem } from "../../api/budget";

type IncomeFormState = {
  description_income: string;
  amount: string;
  income_date: string;
  income_type: string;
};

type ExpenseFormState = {
  description_expense: string;
  price: string;
  expense_date: string;
  subcategory_id: number;
  payment_method_id: number;
};

type ExpenseFormsProps = {
  incomeForm: IncomeFormState;
  expenseForm: ExpenseFormState;
  subcategories: OptionItem[];
  paymentMethods: OptionItem[];
  onIncomeFormChange: (next: IncomeFormState) => void;
  onExpenseFormChange: (next: ExpenseFormState) => void;
  onSubmitIncome: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSubmitExpense: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function ExpenseForms({
  incomeForm,
  expenseForm,
  subcategories,
  paymentMethods,
  onIncomeFormChange,
  onExpenseFormChange,
  onSubmitIncome,
  onSubmitExpense,
}: ExpenseFormsProps) {
  return (
    <section className="content-grid">
      <form className="panel form-panel" onSubmit={onSubmitIncome}>
        <div className="section-title">Ajouter un revenu</div>
        <label>
          Description
          <input value={incomeForm.description_income} onChange={(event) => onIncomeFormChange({ ...incomeForm, description_income: event.target.value })} />
        </label>
        <div className="form-row">
          <label>
            Montant
            <input type="number" value={incomeForm.amount} onChange={(event) => onIncomeFormChange({ ...incomeForm, amount: event.target.value })} />
          </label>
          <label>
            Date
            <input type="date" value={incomeForm.income_date} onChange={(event) => onIncomeFormChange({ ...incomeForm, income_date: event.target.value })} />
          </label>
        </div>
        <label>
          Type
          <input value={incomeForm.income_type} onChange={(event) => onIncomeFormChange({ ...incomeForm, income_type: event.target.value })} />
        </label>
        <button className="primary-button">Ajouter revenu</button>
      </form>

      <form className="panel form-panel" onSubmit={onSubmitExpense}>
        <div className="section-title">Ajouter une dépense</div>
        <label>
          Description
          <input value={expenseForm.description_expense} onChange={(event) => onExpenseFormChange({ ...expenseForm, description_expense: event.target.value })} />
        </label>
        <div className="form-row">
          <label>
            Montant
            <input type="number" value={expenseForm.price} onChange={(event) => onExpenseFormChange({ ...expenseForm, price: event.target.value })} />
          </label>
          <label>
            Date
            <input type="date" value={expenseForm.expense_date} onChange={(event) => onExpenseFormChange({ ...expenseForm, expense_date: event.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Sous-catégorie
            <select value={expenseForm.subcategory_id} onChange={(event) => onExpenseFormChange({ ...expenseForm, subcategory_id: Number(event.target.value) })}>
              {subcategories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label>
            Paiement
            <select value={expenseForm.payment_method_id} onChange={(event) => onExpenseFormChange({ ...expenseForm, payment_method_id: Number(event.target.value) })}>
              {paymentMethods.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        </div>
        <button className="primary-button">Ajouter dépense</button>
      </form>
    </section>
  );
}
