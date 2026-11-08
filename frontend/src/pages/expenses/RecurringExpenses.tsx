import { useEffect, useState, type FormEvent } from "react";
import { createRecurringExpense, getRecurringExpenses, toggleRecurringExpense, type OptionItem, type RecurringExpense } from "../../api/budget";

export function RecurringExpenses({ subcategories, paymentMethods, onChanged }: {
  subcategories: OptionItem[];
  paymentMethods: OptionItem[];
  onChanged: () => Promise<void>;
}) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [rules, setRules] = useState<RecurringExpense[]>([]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [payment, setPayment] = useState("");
  const [start, setStart] = useState(month);
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (value: number | string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
  useEffect(() => { getRecurringExpenses().then(setRules).catch((err: Error) => setError(err.message)); }, []);
  async function refresh() { setRules(await getRecurringExpenses()); await onChanged(); }
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      await createRecurringExpense({ description_expense: description, price, subcategory_id: Number(category || subcategories[0]?.id), payment_method_id: Number(payment || paymentMethods[0]?.id), start_month: start + "-01", end_month: end ? end + "-01" : null });
      setDescription(""); setPrice("");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function toggle(rule: RecurringExpense) {
    setBusy(true); setError(null);
    try { await toggleRecurringExpense(rule.recurring_expense_id, !rule.is_active); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Modification impossible."); }
    finally { setBusy(false); }
  }
  const active = rules.filter((rule) => rule.is_active && rule.start_month.slice(0, 7) <= month && (!rule.end_month || rule.end_month.slice(0, 7) >= month));
  return <>
    {error && <div className="error-box" role="alert">{error}</div>}
    <section className="panel form-panel">
      <div className="section-title">Mes dépenses récurrentes</div>
      <p className="section-copy">Loyer, abonnements, assurances… Une ligne est ajoutée à tes dépenses au premier de chaque mois, dès le mois de début inclus. Les mois passés choisis seront aussi ajoutés : ne les ressaisis pas manuellement.</p>
      <form onSubmit={(event) => void create(event)}>
        <div className="form-row">
          <label>Description<input required maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Loyer" /></label>
          <label>Montant mensuel (€)<input required type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        </div>
        <div className="form-row">
          <label>Catégorie<select required value={category || subcategories[0]?.id || ""} onChange={(event) => setCategory(event.target.value)}>{subcategories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Paiement<select required value={payment || paymentMethods[0]?.id || ""} onChange={(event) => setPayment(event.target.value)}>{paymentMethods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Premier mois<input required type="month" min="2000-01" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>Dernier mois (facultatif)<input type="month" min={start} value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        </div>
        <button className="primary-button" disabled={busy || !subcategories.length || !paymentMethods.length}>{busy ? "Enregistrement…" : "Ajouter la récurrence"}</button>
      </form>
    </section>
    <section className="panel">
      <div className="section-title">Échéancier · {money(active.reduce((total, rule) => total + Number(rule.price), 0))} / mois en cours</div>
      <p className="section-copy">Mettre en pause conserve les dépenses déjà créées. La reprise ne rattrape pas les mois de pause. Pour changer un montant, mets l’ancienne règle en pause et crée la nouvelle à partir du mois souhaité.</p>
      <div className="mobile-inventory-list">
        {rules.map((rule) => <article key={rule.recurring_expense_id} className="mobile-item-card">
          <div className="mobile-item-card-head"><div><strong>{rule.description_expense} · {money(rule.price)}</strong><p className="section-copy">{rule.is_active ? "Active" : "En pause / terminée"} · Depuis {rule.start_month.slice(0, 7)}{rule.end_month ? ` jusqu’à ${rule.end_month.slice(0, 7)}` : ""}</p></div><button type="button" className="ghost-button" disabled={busy || !!(rule.end_month && rule.end_month.slice(0, 7) < month)} onClick={() => void toggle(rule)}>{rule.is_active ? "Mettre en pause" : "Reprendre"}</button></div>
        </article>)}
        {!rules.length && <p className="section-copy">Aucune dépense récurrente enregistrée.</p>}
      </div>
    </section>
  </>;
}
