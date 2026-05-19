import { FormEvent, useDeferredValue, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import {
  createResaleItem,
  deleteResaleItem,
  getResaleCategories,
  getResaleItems,
  getResaleSummary,
  getResaleYears,
  ResaleItem,
  ResaleStatusFilter,
  ResaleSummary,
  updateResaleItem,
} from "../api/resale";
import { MetricCard } from "../components/MetricCard";
import { Modal } from "../components/Modal";
import { YearFilter } from "../components/YearFilter";
import { ResaleCreateForm } from "./resale/ResaleCreateForm";
import { ResaleItemsTable } from "./resale/ResaleItemsTable";

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function money(value: string | null | undefined) {
  return euroFormatter.format(Number(value ?? 0));
}

function chartNumber(value: string) {
  return Number(value ?? 0);
}

function percent(value: string | null | undefined) {
  return `${percentFormatter.format(Number(value ?? 0))} %`;
}

const emptyForm = {
  pair_name: "",
  resale_category: "Sneakers",
  purchase_price: "",
  purchase_date: "",
  sale_price: "",
  sale_date: "",
  sale_site: "",
  pair_count: 1,
  expected_price: "",
  notes: "",
};

const RESALE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function ResalePage() {
  const [items, setItems] = useState<ResaleItem[]>([]);
  const [summary, setSummary] = useState<ResaleSummary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResaleStatusFilter>("all");
  const [form, setForm] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState<ResaleItem | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saleItem, setSaleItem] = useState<ResaleItem | null>(null);
  const [saleForm, setSaleForm] = useState({ sale_price: "", sale_date: new Date().toISOString().slice(0, 10) });
  const [itemToDelete, setItemToDelete] = useState<ResaleItem | null>(null);
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  async function loadStaticData() {
    try {
      const [categoriesData, yearsData] = await Promise.all([getResaleCategories(), getResaleYears()]);
      setCategories(categoriesData);
      setAvailableYears(yearsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function loadContent() {
    setLoading(true);
    setError(null);
    try {
      const [itemsData, summaryData] = await Promise.all([
        getResaleItems(deferredSearch, category, selectedYears, statusFilter),
        getResaleSummary(selectedYears),
      ]);
      setItems(itemsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContent();
  }, [deferredSearch, category, selectedYears, statusFilter]);

  useEffect(() => {
    void loadStaticData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, category, selectedYears, statusFilter, pageSize]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.pair_name.trim()) return;
    await createResaleItem({
      ...form,
      purchase_price: form.purchase_price || "0",
      sale_price: form.sale_price || null,
      expected_price: form.expected_price || null,
      purchase_date: form.purchase_date || null,
      sale_date: form.sale_date || null,
      sale_site: form.sale_site || null,
      notes: form.notes || null,
    });
    setForm(emptyForm);
    await loadContent();
  }

  function openEdit(item: ResaleItem) {
    setEditingItem(item);
    setEditForm({
      pair_name: item.pair_name,
      resale_category: item.resale_category,
      purchase_price: item.purchase_price ?? "",
      purchase_date: item.purchase_date ?? "",
      sale_price: item.sale_price ?? "",
      sale_date: item.sale_date ?? "",
      sale_site: item.sale_site ?? "",
      pair_count: item.pair_count,
      expected_price: item.expected_price ?? "",
      notes: item.notes ?? "",
    });
  }

  function openSale(item: ResaleItem) {
    setSaleItem(item);
    setSaleForm({
      sale_price: item.sale_price ?? item.expected_price ?? "",
      sale_date: item.sale_date ?? new Date().toISOString().slice(0, 10),
    });
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    await updateResaleItem(editingItem.resale_item_id, {
      ...editForm,
      purchase_price: editForm.purchase_price || "0",
      sale_price: editForm.sale_price || null,
      expected_price: editForm.expected_price || null,
      purchase_date: editForm.purchase_date || null,
      sale_date: editForm.sale_date || null,
      sale_site: editForm.sale_site || null,
      notes: editForm.notes || null,
    });
    setEditingItem(null);
    await loadContent();
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saleItem || !saleForm.sale_price) return;
    await updateResaleItem(saleItem.resale_item_id, {
      sale_price: saleForm.sale_price,
      sale_date: saleForm.sale_date || new Date().toISOString().slice(0, 10),
    });
    setSaleItem(null);
    await loadContent();
  }

  async function updateCategory(item: ResaleItem, resaleCategory: string) {
    if (item.resale_category === resaleCategory) return;
    setError(null);
    setSavingCategoryId(item.resale_item_id);
    try {
      await updateResaleItem(item.resale_item_id, { resale_category: resaleCategory });
      await loadContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier la categorie.");
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    await deleteResaleItem(itemToDelete.resale_item_id);
    setItemToDelete(null);
    await loadContent();
  }

  const categoryChart = (summary?.by_category ?? []).map((row) => ({
    category: row.category,
    CA: chartNumber(row.ca_total),
    Benefice: chartNumber(row.benefit_total),
    Stock: chartNumber(row.stock_estimated_value),
  }));
  const categoryMarginRows = [...(summary?.by_category ?? [])].sort((a, b) => Number(b.margin_rate) - Number(a.margin_rate));

  const monthlyBenefitChart = (summary?.benefit_by_month ?? []).map((row) => ({
    month: row.label,
    value: chartNumber(row.value),
  }));
  const currentMonthDailyRealizedChart = (summary?.realized_pnl_by_day_current_month ?? []).map((row) => ({
    day: row.label.slice(8),
    fullDate: row.label,
    value: chartNumber(row.value),
  }));
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(pageStart, pageStart + pageSize);

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Achat-revente</p>
          <h1>Achat-revente</h1>
          <p>Suivi des achats, ventes, bénéfices et stock estimé avec une lecture claire par catégorie et par période.</p>
        </div>
        <div className="hero-actions">
          <YearFilter years={availableYears} selectedYears={selectedYears} onChange={setSelectedYears} />
          <button className="ghost-button" onClick={() => void loadContent()}>
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="metric-grid">
        <MetricCard label="CA total" value={money(summary?.ca_total)} />
        <MetricCard label="Bénéfice total" value={money(summary?.benefit_total)} />
        <MetricCard label="P/L latente" value={money(summary?.unrealized_pnl)} hint="Prix attendu - prix payé sur le non vendu" />
        <MetricCard label="Stock estimé" value={money(summary?.unsold_value)} hint={`${summary?.unsold_count ?? 0} non vendus`} />
      </section>

      <section className="content-grid">
        <section className="panel chart-panel">
          <div className="section-title">Bénéfice par mois</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyBenefitChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="value" fill="#17211d" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel chart-panel">
          <div className="section-title">Répartition par catégorie</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => money(String(value))} />
              <Bar dataKey="CA" fill="#0f766e" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Stock" fill="#f59e0b" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>

      <section className="panel chart-panel full-width-section">
        <div className="section-title">P/L réalisée par jour · mois en cours</div>
        <p className="section-copy">Lecture jour par jour de la plus-value vraiment encaissée ce mois-ci.</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={currentMonthDailyRealizedChart}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip
              labelFormatter={(_value, payload) => (payload?.[0]?.payload?.fullDate ? String(payload[0].payload.fullDate) : "")}
              formatter={(value) => money(String(value))}
            />
            <Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel table-panel compact-table">
        <div className="section-title">Marge par catégorie</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Investi vendu</th>
                <th>Bénéfice</th>
                <th>Marge %</th>
                <th>Investi en attente</th>
                <th>Bénéfice possible</th>
                <th>Marge possible %</th>
              </tr>
            </thead>
            <tbody>
              {categoryMarginRows.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{money(row.purchase_total)}</td>
                  <td className={Number(row.benefit_total) >= 0 ? "positive" : "negative"}>{money(row.benefit_total)}</td>
                  <td className={Number(row.margin_rate) >= 0 ? "positive" : "negative"}>{percent(row.margin_rate)}</td>
                  <td>{money(row.expected_purchase_total)}</td>
                  <td className={Number(row.expected_benefit_total) >= 0 ? "positive" : "negative"}>{money(row.expected_benefit_total)}</td>
                  <td className={Number(row.expected_margin_rate) >= 0 ? "positive" : "negative"}>{percent(row.expected_margin_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ResaleCreateForm form={form} categories={categories} onChange={setForm} onSubmit={(event) => void handleCreate(event)} />

      <ResaleItemsTable
        items={paginatedItems}
        categories={categories}
        category={category}
        statusFilter={statusFilter}
        search={search}
        loading={loading}
        totalItems={items.length}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={RESALE_PAGE_SIZE_OPTIONS}
        savingCategoryId={savingCategoryId}
        money={money}
        onPageSizeChange={setPageSize}
        onCategoryFilterChange={setCategory}
        onStatusFilterChange={setStatusFilter}
        onSearchChange={setSearch}
        onInlineCategoryChange={updateCategory}
        onEdit={openEdit}
        onMarkSold={openSale}
        onDelete={setItemToDelete}
        onPreviousPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNextPage={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

      {editingItem ? (
        <Modal title="Modifier la ligne" eyebrow="Achat-revente" onClose={() => setEditingItem(null)}>
          <form className="modal-form" onSubmit={(event) => void submitEdit(event)}>
            <label>
              Nom
              <input value={editForm.pair_name} onChange={(event) => setEditForm({ ...editForm, pair_name: event.target.value })} />
            </label>
            <label>
              Catégorie
              <select value={editForm.resale_category} onChange={(event) => setEditForm({ ...editForm, resale_category: event.target.value })}>
                {categories.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <div className="form-row">
              <label>
                Prix payé
                <input type="number" value={editForm.purchase_price} onChange={(event) => setEditForm({ ...editForm, purchase_price: event.target.value })} />
              </label>
              <label>
                Prix attendu
                <input type="number" value={editForm.expected_price} onChange={(event) => setEditForm({ ...editForm, expected_price: event.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Date achat
                <input type="date" value={editForm.purchase_date} onChange={(event) => setEditForm({ ...editForm, purchase_date: event.target.value })} />
              </label>
              <label>
                Nombre
                <input type="number" min={1} value={editForm.pair_count} onChange={(event) => setEditForm({ ...editForm, pair_count: Number(event.target.value) })} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Prix vente
                <input type="number" value={editForm.sale_price} onChange={(event) => setEditForm({ ...editForm, sale_price: event.target.value })} />
              </label>
              <label>
                Date vente
                <input type="date" value={editForm.sale_date} onChange={(event) => setEditForm({ ...editForm, sale_date: event.target.value })} />
              </label>
            </div>
            <label>
              Site de vente
              <input value={editForm.sale_site} onChange={(event) => setEditForm({ ...editForm, sale_site: event.target.value })} />
            </label>
            <label>
              Notes
              <textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingItem(null)}>Annuler</button>
              <button className="primary-button" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {saleItem ? (
        <Modal title={`Marquer vendu`} eyebrow={saleItem.pair_name} onClose={() => setSaleItem(null)}>
          <form className="modal-form" onSubmit={(event) => void submitSale(event)}>
            <div className="form-row">
              <label>
                Prix de vente
                <input autoFocus type="number" value={saleForm.sale_price} onChange={(event) => setSaleForm({ ...saleForm, sale_price: event.target.value })} />
              </label>
              <label>
                Date de vente
                <input type="date" value={saleForm.sale_date} onChange={(event) => setSaleForm({ ...saleForm, sale_date: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setSaleItem(null)}>Annuler</button>
              <button className="primary-button" type="submit">Valider la vente</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {itemToDelete ? (
        <Modal title="Supprimer cette ligne ?" eyebrow="Action irréversible" onClose={() => setItemToDelete(null)}>
          <p className="modal-copy">Tu vas supprimer <strong>{itemToDelete.pair_name}</strong>. Les données ne seront plus comptées dans tes stats.</p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setItemToDelete(null)}>Garder</button>
            <button className="primary-button danger-primary" type="button" onClick={() => void confirmDelete()}>Supprimer</button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
