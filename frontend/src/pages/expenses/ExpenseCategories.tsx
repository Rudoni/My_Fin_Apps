import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { apiRequest } from "../../api/client";
import type { OptionItem } from "../../api/budget";
import { Modal } from "../../components/Modal";

type Category = { id: number; name: string; group_name: string; shared: boolean; hidden: boolean };

export function ExpenseCategories({ onChanged }: { onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<Category[]>([]);
  const [groups, setGroups] = useState<OptionItem[]>([]);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<Category | null>(null);

  async function load() {
    const [categories, options] = await Promise.all([apiRequest<Category[]>("/budget/categories"), apiRequest<OptionItem[]>("/budget/categories/groups")]);
    setRows(categories); setGroups(options); setGroup(current => current || String(options[0]?.id ?? ""));
  }
  useEffect(() => { void load().catch(err => setError(err instanceof Error ? err.message : "Chargement impossible.")).finally(() => setLoading(false)); }, []);

  async function mutate(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(null); setMessage("");
    try {
      await action();
      setRemoving(null); setMessage(success);
      await Promise.all([load(), onChanged()]);
    } catch (err) { setError(err instanceof Error ? err.message : "Modification impossible."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void mutate(async () => { await apiRequest("/budget/categories", { method: "POST", body: JSON.stringify({ name: name.trim(), category_id: Number(group) }) }); setName(""); }, "Catégorie ajoutée à tes choix de dépenses.");
  }
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = rows.filter(row => row.hidden === hidden && normalize(`${row.name} ${row.group_name}`).includes(normalize(search)));
  return <section className="expense-category-settings">
    <header><h2>Tes catégories de dépenses</h2><p className="section-copy">Personnalise tes choix sans modifier ceux des autres utilisateurs. Les familles servent au regroupement dans les graphiques.</p></header>
    {error && <div role="alert" className="error-box">{error}</div>}
    {message && <div role="status" className="success-box">{message}</div>}
    <form className="panel category-create-form" onSubmit={submit}>
      <label>Nouvelle catégorie<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Sport, Animaux…" /></label>
      <label>Famille<select required value={group} onChange={event => setGroup(event.target.value)}>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button disabled={busy || loading || !name.trim() || !group} type="submit" className="primary-button"><Plus size={16} /> Ajouter</button>
    </form>
    <section className="panel">
      <div className="table-toolbar"><div className="studio-tabs"><button type="button" className={!hidden ? "active" : ""} aria-pressed={!hidden} onClick={() => setHidden(false)}>Actives</button><button type="button" className={hidden ? "active" : ""} aria-pressed={hidden} onClick={() => setHidden(true)}>Retirées</button></div><input aria-label="Rechercher une catégorie" placeholder="Rechercher…" value={search} onChange={event => setSearch(event.target.value)} /></div>
      {loading ? <p role="status">Chargement des catégories…</p> : <ul className="expense-category-list">{visible.map(row => <li key={row.id}><div><strong>{row.name}</strong><small>{row.group_name} · {row.shared ? "Par défaut" : "Personnelle"}</small></div><button disabled={busy} className="ghost-button" type="button" aria-label={`${hidden ? "Restaurer" : "Supprimer"} ${row.name}`} onClick={() => hidden ? void mutate(() => apiRequest(`/budget/categories/${row.id}/restore`, { method: "POST" }), "Catégorie restaurée.") : setRemoving(row)}>{hidden ? <RotateCcw size={16} /> : <Trash2 size={16} />}{hidden ? "Restaurer" : "Supprimer"}</button></li>)}</ul>}
      {!loading && !visible.length && <p className="studio-empty">Aucune catégorie dans cette liste.</p>}
    </section>
    {removing && <Modal title={`Retirer ${removing.name} ?`} eyebrow="Catégories" onClose={() => { if (!busy) setRemoving(null); }}><p>Cette catégorie ne sera plus proposée pour tes nouvelles dépenses. Ton historique reste intact et tu pourras la restaurer.</p>{error && <p role="alert" className="error-box">{error}</p>}<div className="modal-actions"><button disabled={busy} type="button" className="ghost-button" onClick={() => setRemoving(null)}>Annuler</button><button disabled={busy} type="button" className="primary-button" onClick={() => void mutate(() => apiRequest(`/budget/categories/${removing.id}`, { method: "DELETE" }), "Catégorie retirée. Ton historique est conservé.")}>{busy ? "Suppression…" : "Retirer de mes choix"}</button></div></Modal>}
  </section>;
}
