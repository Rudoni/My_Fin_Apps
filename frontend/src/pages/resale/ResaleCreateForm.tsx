import type { FormEvent } from "react";
import { Plus } from "lucide-react";

type ResaleFormState = {
  pair_name: string;
  resale_category: string;
  purchase_price: string;
  purchase_date: string;
  sale_price: string;
  sale_date: string;
  sale_site: string;
  pair_count: number;
  expected_price: string;
  notes: string;
};

type ResaleCreateFormProps = {
  form: ResaleFormState;
  categories: string[];
  onChange: (next: ResaleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function ResaleCreateForm({ form, categories, onChange, onSubmit }: ResaleCreateFormProps) {
  return (
    <section className="content-grid">
      <form className="panel form-panel" onSubmit={onSubmit}>
        <div className="section-title">
          <Plus size={18} />
          Ajouter une ligne
        </div>
        <label>
          Nom
          <input value={form.pair_name} onChange={(event) => onChange({ ...form, pair_name: event.target.value })} />
        </label>
        <label>
          Catégorie
          <select value={form.resale_category} onChange={(event) => onChange({ ...form, resale_category: event.target.value })}>
            {categories.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Prix payé
            <input type="number" value={form.purchase_price} onChange={(event) => onChange({ ...form, purchase_price: event.target.value })} />
          </label>
          <label>
            Prix attendu
            <input type="number" value={form.expected_price} onChange={(event) => onChange({ ...form, expected_price: event.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Date achat
            <input type="date" value={form.purchase_date} onChange={(event) => onChange({ ...form, purchase_date: event.target.value })} />
          </label>
          <label>
            Qté
            <input type="number" min={1} value={form.pair_count} onChange={(event) => onChange({ ...form, pair_count: Number(event.target.value) })} />
          </label>
        </div>
        {form.pair_count > 1 ? <small>{form.pair_count} lignes unitaires seront créées.</small> : null}
        <button className="primary-button" type="submit">Ajouter</button>
      </form>
    </section>
  );
}
