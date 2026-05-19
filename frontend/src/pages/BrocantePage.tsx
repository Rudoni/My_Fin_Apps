import { FormEvent, useDeferredValue, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pencil, Plus, Search, Settings2, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import {
  BrocanteCategory,
  BrocanteItem,
  BrocanteSummary,
  createBrocanteCategory,
  createBrocanteItem,
  createBrocantePurchase,
  createBrocanteSale,
  deleteBrocanteItem,
  getBrocanteCategories,
  getBrocanteItems,
  getBrocanteSummary,
  updateBrocanteLatestSale,
  updateBrocanteItem,
} from "../api/brocante";
import { MetricCard } from "../components/MetricCard";
import { Modal } from "../components/Modal";

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const today = new Date().toISOString().slice(0, 10);
const BROCANTE_PAGE_SIZE = 50;

type BrocanteView = "bulk" | "binder" | "settings";
type BinderStatusFilter = "all" | "available" | "sold";

function money(value: string | null | undefined) {
  return euroFormatter.format(Number(value ?? 0));
}

function chartNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function percent(value: string | number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} %`;
}

function ownershipLabel(mode: string) {
  return mode === "common" ? "Commun" : "Solo";
}

const emptyReferenceForm = {
  name: "",
  brocante_category_id: 0,
  inventory_group: "bulk",
  ownership_mode: "solo",
  card_type: "",
  target_sale_unit_price: "",
  minimum_sale_unit_price: "",
  notes: "",
};

const emptyBinderForm = {
  name: "",
  ownership_mode: "solo",
  purchase_price: "",
  target_sale_unit_price: "",
  purchase_date: today,
};

const emptyMovementForm = {
  brocante_item_id: 0,
  quantity: 1,
  total_amount: "",
  movement_date: today,
  notes: "",
};

export function BrocantePage() {
  const [view, setView] = useState<BrocanteView>("bulk");
  const [summary, setSummary] = useState<BrocanteSummary | null>(null);
  const [items, setItems] = useState<BrocanteItem[]>([]);
  const [categories, setCategories] = useState<BrocanteCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [referenceForm, setReferenceForm] = useState(emptyReferenceForm);
  const [binderForm, setBinderForm] = useState(emptyBinderForm);
  const [purchaseForm, setPurchaseForm] = useState(emptyMovementForm);
  const [saleForm, setSaleForm] = useState(emptyMovementForm);
  const [binderSaleDrafts, setBinderSaleDrafts] = useState<Record<number, { total_amount: string; movement_date: string }>>({});
  const [binderSaleModalItem, setBinderSaleModalItem] = useState<BrocanteItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [editingItem, setEditingItem] = useState<BrocanteItem | null>(null);
  const [editForm, setEditForm] = useState(emptyReferenceForm);
  const [itemToDelete, setItemToDelete] = useState<BrocanteItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [binderStatusFilter, setBinderStatusFilter] = useState<BinderStatusFilter>("all");
  const deferredSearch = useDeferredValue(search);

  const inventoryGroup = view === "binder" ? "binder" : "bulk";
  const isSettingsView = view === "settings";
  const viewTitle = view === "binder" ? "Binder / Top loader" : view === "settings" ? "Paramètres" : "Stock brocante";
  const viewDescription =
    view === "binder"
      ? "Ici tu suis tes belles cartes, top loaders et pièces premium avec un inventaire dédié."
      : view === "settings"
        ? "Tu peux faire vivre ton système brocante ici, sans toucher au stock."
        : "Tu gères ici les cartes et lots en quantité : prix moyen, stock restant et ventes en bloc.";
  const defaultBinderCategoryId = categories.find((category) => category.name === "Pokemon")?.id ?? categories[0]?.id ?? 0;

  async function loadCategoriesOnly() {
    try {
      const categoriesData = await getBrocanteCategories();
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function loadContent() {
    setError(null);
    try {
      if (isSettingsView) {
        return;
      }

      const [summaryData, itemsData] = await Promise.all([
        getBrocanteSummary(categoryId, deferredSearch, inventoryGroup),
        getBrocanteItems(categoryId, deferredSearch, inventoryGroup),
      ]);
      setSummary(summaryData);
      setItems(itemsData);
      setReferenceForm((form) => ({
        ...form,
        inventory_group: inventoryGroup,
        brocante_category_id: form.brocante_category_id || categories[0]?.id || 0,
      }));
      setPurchaseForm((form) => ({ ...form, brocante_item_id: form.brocante_item_id || itemsData[0]?.brocante_item_id || 0 }));
      setSaleForm((form) => ({ ...form, brocante_item_id: form.brocante_item_id || itemsData[0]?.brocante_item_id || 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  useEffect(() => {
    void loadContent();
  }, [view, categoryId, deferredSearch]);

  useEffect(() => {
    void loadCategoriesOnly();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [view, categoryId, deferredSearch, binderStatusFilter]);

  useEffect(() => {
    if (!categories.length) return;
    setReferenceForm((form) => ({
      ...form,
      brocante_category_id: form.brocante_category_id || categories[0].id,
    }));
  }, [categories]);

  async function submitReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createBrocanteItem({
      ...referenceForm,
      inventory_group: inventoryGroup,
      ownership_mode: referenceForm.ownership_mode,
      target_sale_unit_price: referenceForm.target_sale_unit_price || "0",
      minimum_sale_unit_price: referenceForm.minimum_sale_unit_price || "0",
      notes: referenceForm.notes || null,
    });
    setReferenceForm((form) => ({
      ...emptyReferenceForm,
      brocante_category_id: form.brocante_category_id,
      inventory_group: inventoryGroup,
    }));
    await loadContent();
  }

  async function submitBinderCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const createdItem = await createBrocanteItem({
      name: binderForm.name,
      brocante_category_id: defaultBinderCategoryId,
      inventory_group: "binder",
      ownership_mode: binderForm.ownership_mode,
      card_type: "",
      target_sale_unit_price: binderForm.target_sale_unit_price || "0",
      minimum_sale_unit_price: "0",
      notes: null,
    });
    await createBrocantePurchase({
      brocante_item_id: createdItem.brocante_item_id,
      quantity: 1,
      total_amount: binderForm.purchase_price || "0",
      movement_date: binderForm.purchase_date,
      notes: null,
    });
    setBinderForm(emptyBinderForm);
    await loadContent();
  }

  async function submitPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createBrocantePurchase({
      ...purchaseForm,
      total_amount: purchaseForm.total_amount || "0",
      notes: purchaseForm.notes || null,
    });
    setPurchaseForm((form) => ({ ...form, quantity: 1, total_amount: "", movement_date: today, notes: "" }));
    await loadContent();
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createBrocanteSale({
      ...saleForm,
      total_amount: saleForm.total_amount || "0",
      notes: saleForm.notes || null,
    });
    setSaleForm((form) => ({ ...form, quantity: 1, total_amount: "", movement_date: today, notes: "" }));
    await loadContent();
  }

  function getBinderSaleDraft(item: BrocanteItem) {
    return binderSaleDrafts[item.brocante_item_id] ?? {
      total_amount: item.stock_quantity > 0 ? "" : item.sales_total,
      movement_date: item.stock_quantity > 0 ? today : (item.last_sale_date ?? today),
    };
  }

  function updateBinderSaleDraft(itemId: number, patch: Partial<{ total_amount: string; movement_date: string }>) {
    setBinderSaleDrafts((drafts) => ({
      ...drafts,
      [itemId]: {
        ...(drafts[itemId] ?? { total_amount: "", movement_date: today }),
        ...patch,
      },
    }));
  }

  function openBinderSaleModal(item: BrocanteItem) {
    const draft = getBinderSaleDraft(item);
    setBinderSaleDrafts((drafts) => ({
      ...drafts,
      [item.brocante_item_id]: draft,
    }));
    setBinderSaleModalItem(item);
  }

  async function submitBinderRowSale(item: BrocanteItem) {
    const draft = getBinderSaleDraft(item);
    if (item.stock_quantity > 0) {
      await createBrocanteSale({
        brocante_item_id: item.brocante_item_id,
        quantity: 1,
        total_amount: draft.total_amount || "0",
        movement_date: draft.movement_date || today,
        notes: null,
      });
    } else {
      await updateBrocanteLatestSale(item.brocante_item_id, {
        total_amount: draft.total_amount || "0",
        movement_date: draft.movement_date || today,
        notes: null,
      });
    }
    setBinderSaleDrafts((drafts) => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[item.brocante_item_id];
      return nextDrafts;
    });
    await loadContent();
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createBrocanteCategory({ name: categoryForm.name.trim() });
    setCategoryForm({ name: "" });
    await loadCategoriesOnly();
  }

  function openEdit(item: BrocanteItem) {
    setEditingItem(item);
    const category = categories.find((entry) => entry.name === item.category);
    setEditForm({
      name: item.name,
      brocante_category_id: category?.id ?? 0,
      inventory_group: item.inventory_group,
      ownership_mode: item.ownership_mode,
      card_type: item.card_type,
      target_sale_unit_price: item.target_sale_unit_price,
      minimum_sale_unit_price: item.minimum_sale_unit_price,
      notes: item.notes ?? "",
    });
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    await updateBrocanteItem(editingItem.brocante_item_id, {
      ...editForm,
      ownership_mode: editForm.ownership_mode,
      target_sale_unit_price: editForm.target_sale_unit_price || "0",
      minimum_sale_unit_price: editForm.minimum_sale_unit_price || "0",
      notes: editForm.notes || null,
    });
    setEditingItem(null);
    await loadContent();
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    await deleteBrocanteItem(itemToDelete.brocante_item_id);
    setItemToDelete(null);
    await loadContent();
  }

  const filteredItems =
    view === "binder"
      ? items.filter((item) => {
          if (binderStatusFilter === "available") return item.stock_quantity > 0;
          if (binderStatusFilter === "sold") return item.stock_quantity <= 0;
          return true;
        })
      : items;

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / BROCANTE_PAGE_SIZE));
  const pageStart = (currentPage - 1) * BROCANTE_PAGE_SIZE;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + BROCANTE_PAGE_SIZE);
  const currentMonthDailyRealizedChart = (summary?.realized_pnl_by_day_current_month ?? []).map((row) => ({
    day: row.label.slice(8),
    fullDate: row.label,
    value: chartNumber(row.value),
  }));

  return (
    <main className="page-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Stock agrégé</p>
          <h1>{viewTitle}</h1>
          <p>{viewDescription}</p>
        </div>
        <div className="hero-actions">
          <button className={view === "bulk" ? "primary-button" : "ghost-button"} type="button" onClick={() => setView("bulk")}>Stock</button>
          <button className={view === "binder" ? "primary-button" : "ghost-button"} type="button" onClick={() => setView("binder")}><Sparkles size={16} /> Binder</button>
          <button className={view === "settings" ? "primary-button" : "ghost-button"} type="button" onClick={() => setView("settings")}><Settings2 size={16} /> Paramètres</button>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      {isSettingsView ? (
        <section className="content-grid">
          <form className="panel form-panel" onSubmit={(event) => void submitCategory(event)}>
            <div className="section-title">
              <Plus size={18} />
              Ajouter une catégorie
            </div>
            <label>
              Nom catégorie
              <input value={categoryForm.name} onChange={(event) => setCategoryForm({ name: event.target.value })} placeholder="Pokemon, One Piece, Binder premium..." />
            </label>
            <button className="primary-button">Créer catégorie</button>
          </form>

          <section className="panel table-panel compact-table">
            <div className="section-title">Catégories existantes</div>
            <div className="table-scroll">
              <table>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : (
        <>
          <section className="metric-grid">
            <MetricCard label="Références" value={`${summary?.reference_count ?? 0}`} />
            <MetricCard label="Stock restant" value={`${summary?.stock_quantity ?? 0}`} />
            <MetricCard label="Valeur cible stock" value={money(summary?.target_stock_value)} />
            <MetricCard label="P/L latente" value={money(summary?.unrealized_pnl)} hint="Basée sur ton prix de vente cible" />
          </section>

          <section className="metric-grid">
            <MetricCard label="Achats cumulés" value={money(summary?.purchase_total)} />
            <MetricCard label="Ventes cumulées" value={money(summary?.sales_total)} />
            <MetricCard label="P/L réalisée" value={money(summary?.realized_pnl)} />
            <MetricCard label="PRU moyen" value={items.length ? money(String(items.reduce((acc, item) => acc + Number(item.average_buy_unit_price || 0), 0) / items.length)) : money("0")} />
          </section>

          <section className="metric-grid">
            <MetricCard
              label="Seuil de rentabilité"
              value={Number(summary?.break_even_remaining ?? 0) > 0 ? money(summary?.break_even_remaining) : "Atteint"}
              hint={
                Number(summary?.break_even_remaining ?? 0) > 0
                  ? "Encore à encaisser pour avoir remboursé ta mise"
                  : "Tes ventes ont déjà couvert ton investissement"
              }
            />
            <MetricCard
              label="Couverture de mise"
              value={percent(summary?.break_even_progress_pct)}
              hint={
                summary?.break_even_possible_with_target
                  ? "Rentable si le stock restant part à ton prix cible"
                  : "Même au prix cible actuel, la mise n'est pas encore couverte"
              }
            />
          </section>

          <section className="panel chart-panel full-width-section">
            <div className="section-title">P/L réalisée par jour · mois en cours</div>
            <p className="section-copy">Zoom sur la plus-value encaissée jour par jour sur le mois actuel.</p>
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

          {view === "binder" ? (
            <section className="content-grid">
              <form className="panel form-panel" onSubmit={(event) => void submitBinderCard(event)}>
                <div className="section-title">
                  <Sparkles size={18} />
                  Ajouter une carte binder
                </div>
                <label>
                  Nom de la carte
                  <input value={binderForm.name} onChange={(event) => setBinderForm({ ...binderForm, name: event.target.value })} placeholder="Dracaufeu, Pikachu Van Gogh..." />
                </label>
                <label>
                  Part
                  <select value={binderForm.ownership_mode} onChange={(event) => setBinderForm({ ...binderForm, ownership_mode: event.target.value })}>
                    <option value="solo">Solo</option>
                    <option value="common">Commun</option>
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    Prix d'achat
                    <input type="number" value={binderForm.purchase_price} onChange={(event) => setBinderForm({ ...binderForm, purchase_price: event.target.value })} />
                  </label>
                  <label>
                    Prix de vente désiré
                    <input type="number" value={binderForm.target_sale_unit_price} onChange={(event) => setBinderForm({ ...binderForm, target_sale_unit_price: event.target.value })} />
                  </label>
                </div>
                <label>
                  Date d'achat
                  <input type="date" value={binderForm.purchase_date} onChange={(event) => setBinderForm({ ...binderForm, purchase_date: event.target.value })} />
                </label>
                <button className="primary-button">Ajouter la carte</button>
              </form>
            </section>
          ) : (
          <section className="content-grid three-col">
            <form className="panel form-panel" onSubmit={(event) => void submitReference(event)}>
              <div className="section-title">
                <Plus size={18} />
                Ajouter une référence
              </div>
              <label>
                Catégorie
                <select value={referenceForm.brocante_category_id} onChange={(event) => setReferenceForm({ ...referenceForm, brocante_category_id: Number(event.target.value) })}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Nom de référence
                <input value={referenceForm.name} onChange={(event) => setReferenceForm({ ...referenceForm, name: event.target.value })} placeholder="Dracaufeu holo, Pikachu lot..." />
              </label>
              <label>
                Part
                <select value={referenceForm.ownership_mode} onChange={(event) => setReferenceForm({ ...referenceForm, ownership_mode: event.target.value })}>
                  <option value="solo">Solo</option>
                  <option value="common">Commun</option>
                </select>
              </label>
              <label>
                Type de carte
                <input value={referenceForm.card_type} onChange={(event) => setReferenceForm({ ...referenceForm, card_type: event.target.value })} placeholder="Holo, Reverse, Lot, Commune..." />
              </label>
              <div className="form-row">
                <label>
                  Prix cible / ex
                  <input type="number" value={referenceForm.target_sale_unit_price} onChange={(event) => setReferenceForm({ ...referenceForm, target_sale_unit_price: event.target.value })} />
                </label>
                <label>
                  Prix mini / ex
                  <input type="number" value={referenceForm.minimum_sale_unit_price} onChange={(event) => setReferenceForm({ ...referenceForm, minimum_sale_unit_price: event.target.value })} />
                </label>
              </div>
              <button className="primary-button">Créer la référence</button>
            </form>

            <form className="panel form-panel" onSubmit={(event) => void submitPurchase(event)}>
              <div className="section-title">
                <ShoppingBag size={18} />
                Enregistrer un achat
              </div>
              <label>
                Référence
                <select value={purchaseForm.brocante_item_id} onChange={(event) => setPurchaseForm({ ...purchaseForm, brocante_item_id: Number(event.target.value) })}>
                  {items.map((item) => <option key={item.brocante_item_id} value={item.brocante_item_id}>{item.name} · {item.category}</option>)}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Quantité achetée
                  <input type="number" min={1} value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: Number(event.target.value) })} />
                </label>
                <label>
                  Prix total payé
                  <input type="number" value={purchaseForm.total_amount} onChange={(event) => setPurchaseForm({ ...purchaseForm, total_amount: event.target.value })} />
                </label>
              </div>
              <label>
                Date achat
                <input type="date" value={purchaseForm.movement_date} onChange={(event) => setPurchaseForm({ ...purchaseForm, movement_date: event.target.value })} />
              </label>
              <button className="primary-button">Ajouter l'achat</button>
            </form>

            <form className="panel form-panel" onSubmit={(event) => void submitSale(event)}>
              <div className="section-title">Enregistrer une vente</div>
              <label>
                Référence
                <select value={saleForm.brocante_item_id} onChange={(event) => setSaleForm({ ...saleForm, brocante_item_id: Number(event.target.value) })}>
                  {items.filter((item) => item.stock_quantity > 0).map((item) => <option key={item.brocante_item_id} value={item.brocante_item_id}>{item.name} · stock {item.stock_quantity}</option>)}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Quantité vendue
                  <input type="number" min={1} value={saleForm.quantity} onChange={(event) => setSaleForm({ ...saleForm, quantity: Number(event.target.value) })} />
                </label>
                <label>
                  Prix total vendu
                  <input type="number" value={saleForm.total_amount} onChange={(event) => setSaleForm({ ...saleForm, total_amount: event.target.value })} />
                </label>
              </div>
              <label>
                Date vente
                <input type="date" value={saleForm.movement_date} onChange={(event) => setSaleForm({ ...saleForm, movement_date: event.target.value })} />
              </label>
              <button className="primary-button">Ajouter la vente</button>
            </form>
          </section>
          )}

          <section className="panel table-panel">
            <div className="table-toolbar">
              <div className="section-title">{view === "binder" ? "Inventaire binder / top loader" : "Références brocante"}</div>
              <div className="filters">
                <label className="search-field">
                  <Search size={16} />
                  <input placeholder="Rechercher..." value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                {view === "binder" ? (
                  <select value={binderStatusFilter} onChange={(event) => setBinderStatusFilter(event.target.value as BinderStatusFilter)}>
                    <option value="all">Tous statuts</option>
                    <option value="available">En stock</option>
                    <option value="sold">Vendu</option>
                  </select>
                ) : (
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Toutes catégories</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  {view === "binder" ? (
                    <tr>
                      <th>Carte</th>
                      <th>Part</th>
                      <th>Prix achat</th>
                      <th>Date achat</th>
                      <th>Prix vente désiré</th>
                      <th>Date vente</th>
                      <th>Prix vendu</th>
                      <th>Status</th>
                      <th>P/L</th>
                      <th />
                    </tr>
                  ) : (
                    <tr>
                      <th>Référence</th>
                      <th>Part</th>
                      <th>Catégorie</th>
                      <th>Type</th>
                      <th>Stock</th>
                      <th>PRU moyen</th>
                      <th>Prix cible</th>
                      <th>Coût stock</th>
                      <th>Valeur cible</th>
                      <th>P/L réalisée</th>
                      <th>P/L latente</th>
                      <th />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={item.brocante_item_id}>
                      {view === "binder" ? (
                        <>
                          <td>{item.name}</td>
                          <td><span className="status-pill">{ownershipLabel(item.ownership_mode)}</span></td>
                          <td>{money(item.purchase_total)}</td>
                          <td>{item.last_purchase_date ?? "-"}</td>
                          <td>{money(item.target_sale_unit_price)}</td>
                          <td>{item.stock_quantity > 0 ? "-" : (item.last_sale_date ?? getBinderSaleDraft(item).movement_date ?? "-")}</td>
                          <td>{item.stock_quantity > 0 ? "-" : money(getBinderSaleDraft(item).total_amount || item.sales_total)}</td>
                          <td><span className="status-pill">{item.stock_quantity > 0 ? "En stock" : "Vendu"}</span></td>
                          <td className={Number(item.stock_quantity > 0 ? item.unrealized_pnl : item.realized_pnl) >= 0 ? "positive" : "negative"}>
                            {money(item.stock_quantity > 0 ? item.unrealized_pnl : item.realized_pnl)}
                          </td>
                          <td className="actions">
                            <button type="button" onClick={() => openBinderSaleModal(item)}>
                              {item.stock_quantity > 0 ? "Vendre" : "Maj vente"}
                            </button>
                            <button type="button" onClick={() => openEdit(item)}><Pencil size={16} /> Modifier</button>
                            <button className="danger-button" type="button" onClick={() => setItemToDelete(item)}><Trash2 size={16} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{item.name}</td>
                          <td><span className="status-pill">{ownershipLabel(item.ownership_mode)}</span></td>
                          <td>{item.category}</td>
                          <td>{item.card_type || "-"}</td>
                          <td>{item.stock_quantity}</td>
                          <td>{money(item.average_buy_unit_price)}</td>
                          <td>{money(item.target_sale_unit_price)}</td>
                          <td>{money(item.remaining_cost_basis)}</td>
                          <td>{money(item.target_stock_value)}</td>
                          <td className={Number(item.realized_pnl) >= 0 ? "positive" : "negative"}>{money(item.realized_pnl)}</td>
                          <td className={Number(item.unrealized_pnl) >= 0 ? "positive" : "negative"}>{money(item.unrealized_pnl)}</td>
                          <td className="actions">
                            <button type="button" onClick={() => openEdit(item)}><Pencil size={16} /> Modifier</button>
                            <button className="danger-button" type="button" onClick={() => setItemToDelete(item)}><Trash2 size={16} /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredItems.length > BROCANTE_PAGE_SIZE ? (
              <div className="table-footer">
                <span>{filteredItems.length} lignes · page {currentPage} / {totalPages}</span>
                <div className="pagination-actions">
                  <button className="ghost-button" type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Prec.</button>
                  <button className="ghost-button" type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Suiv.</button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}

      {editingItem ? (
        <Modal title="Modifier la référence" eyebrow={editingItem.category} onClose={() => setEditingItem(null)}>
          <form className="modal-form" onSubmit={(event) => void submitEdit(event)}>
            <label>
              Nom
              <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </label>
            <label>
              Catégorie
              <select value={editForm.brocante_category_id} onChange={(event) => setEditForm({ ...editForm, brocante_category_id: Number(event.target.value) })}>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {editingItem.inventory_group !== "binder" ? (
              <>
                <label>
                  Inventaire
                  <select value={editForm.inventory_group} onChange={(event) => setEditForm({ ...editForm, inventory_group: event.target.value })}>
                    <option value="bulk">Stock brocante</option>
                    <option value="binder">Binder / Top loader</option>
                  </select>
                </label>
                <label>
                  Part
                  <select value={editForm.ownership_mode} onChange={(event) => setEditForm({ ...editForm, ownership_mode: event.target.value })}>
                    <option value="solo">Solo</option>
                    <option value="common">Commun</option>
                  </select>
                </label>
                <label>
                  Type de carte
                  <input value={editForm.card_type} onChange={(event) => setEditForm({ ...editForm, card_type: event.target.value })} />
                </label>
              </>
            ) : (
              <label>
                Part
                <select value={editForm.ownership_mode} onChange={(event) => setEditForm({ ...editForm, ownership_mode: event.target.value })}>
                  <option value="solo">Solo</option>
                  <option value="common">Commun</option>
                </select>
              </label>
            )}
            <div className="form-row">
              <label>
                Prix cible / ex
                <input type="number" value={editForm.target_sale_unit_price} onChange={(event) => setEditForm({ ...editForm, target_sale_unit_price: event.target.value })} />
              </label>
              <label>
                Prix mini / ex
                <input type="number" value={editForm.minimum_sale_unit_price} onChange={(event) => setEditForm({ ...editForm, minimum_sale_unit_price: event.target.value })} />
              </label>
            </div>
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

      {binderSaleModalItem ? (
        <Modal
          title={binderSaleModalItem.stock_quantity > 0 ? "Enregistrer une vente binder" : "Modifier une vente binder"}
          eyebrow="Binder"
          onClose={() => setBinderSaleModalItem(null)}
        >
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitBinderRowSale(binderSaleModalItem).then(() => setBinderSaleModalItem(null));
            }}
          >
            <label>
              Carte
              <input value={binderSaleModalItem.name} readOnly />
            </label>
            <div className="form-row">
              <label>
                Date de vente
                <input
                  type="date"
                  value={getBinderSaleDraft(binderSaleModalItem).movement_date}
                  onChange={(event) => updateBinderSaleDraft(binderSaleModalItem.brocante_item_id, { movement_date: event.target.value })}
                />
              </label>
              <label>
                Prix vendu
                <input
                  type="number"
                  value={getBinderSaleDraft(binderSaleModalItem).total_amount}
                  onChange={(event) => updateBinderSaleDraft(binderSaleModalItem.brocante_item_id, { total_amount: event.target.value })}
                  placeholder="Prix reel"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setBinderSaleModalItem(null)}>
                Annuler
              </button>
              <button className="primary-button" type="submit">
                {binderSaleModalItem.stock_quantity > 0 ? "Vendre" : "Mettre a jour"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {itemToDelete ? (
        <Modal title="Supprimer cette référence ?" eyebrow="Stock brocante" onClose={() => setItemToDelete(null)}>
          <p className="modal-copy">Tu vas archiver <strong>{itemToDelete.name}</strong> de ton inventaire.</p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setItemToDelete(null)}>Garder</button>
            <button className="primary-button danger-primary" type="button" onClick={() => void confirmDelete()}>Supprimer</button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
