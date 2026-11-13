import { FormEvent, useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getPatrimonySummary, PatrimonySummary } from "../api/dashboard";
import {
  addAssetPurchase,
  createCashAsset,
  createMarketAsset,
  createPhysicalAsset,
  deleteAsset,
  estimateLedgerCsv,
  importLedgerCsv,
  LedgerCsvEstimate,
  refreshAssetPrice,
  updateAsset,
} from "../api/patrimony";
import { MetricCard } from "../components/MetricCard";
import { PageLoader } from "../components/PageLoader";
import { Modal } from "../components/Modal";
import { PatrimonyAssetsTable } from "./patrimony/PatrimonyAssetsTable";
import { PatrimonyForms } from "./patrimony/PatrimonyForms";

type PatrimonyAsset = PatrimonySummary["assets"][number];

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const cryptoFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 8 });
const today = new Date().toISOString().slice(0, 10);
const patrimonyGroupColors: Record<string, string> = {
  cash: "#0f766e",
  financial: "#17211d",
  crypto: "#f59e0b",
  patrimony: "#7c5c34",
  resale: "#b45309",
  brocante: "#4f46e5",
};

function money(value: string | null | undefined) {
  return euroFormatter.format(Number(value ?? 0));
}

function percent(value: number) {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

function cryptoAmount(value: string | null | undefined, ticker: string) {
  return `${cryptoFormatter.format(Number(value ?? 0))} ${ticker}`;
}

function latentPnl(asset: PatrimonyAsset) {
  return Number(asset.unrealized_pnl ?? 0);
}

function showPnl(asset: PatrimonyAsset) {
  return ["financial", "crypto"].includes(asset.group) && asset.unrealized_pnl != null;
}

export function PatrimonyPage() {
  const [data, setData] = useState<PatrimonySummary | null>(null);
  const [physicalForm, setPhysicalForm] = useState({ name_asset: "", estimated_value: "", valuation_date: today, notes: "" });
  const [cashForm, setCashForm] = useState({ name_asset: "", amount: "", valuation_date: today, notes: "" });
  const [marketForm, setMarketForm] = useState({
    name_asset: "",
    ticker: "",
    asset_type_code: "STOCK",
    quantity: "",
    buy_unit_price: "",
    current_unit_price: "",
    valuation_date: today,
    notes: "",
  });
  const [editingAsset, setEditingAsset] = useState<PatrimonyAsset | null>(null);
  const [editForm, setEditForm] = useState({ name_asset: "", estimated_value: "", valuation_date: today, notes: "" });
  const [assetToDelete, setAssetToDelete] = useState<PatrimonyAsset | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [ledgerTicker, setLedgerTicker] = useState("BTC");
  const [ledgerEstimate, setLedgerEstimate] = useState<LedgerCsvEstimate | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerImporting, setLedgerImporting] = useState(false);
  const [patrimonyChartMode, setPatrimonyChartMode] = useState<"pie" | "mosaic">("pie");
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<"assets" | "capture" | "pilotage">("assets");
  const [saving, setSaving] = useState(false);
  const [purchaseAsset, setPurchaseAsset] = useState<PatrimonyAsset | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({ quantity: "", buy_unit_price: "", current_unit_price: "", valuation_date: today });
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  function openPurchase(asset: PatrimonyAsset) {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setPurchaseForm({ quantity: "", buy_unit_price: "", current_unit_price: "", valuation_date: localDate });
    setPurchaseError(null);
    setPurchaseAsset(asset);
  }

  async function submitPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (purchaseSaving || purchaseAsset?.asset_id == null) return;
    setPurchaseSaving(true);
    setPurchaseError(null);
    try {
      await addAssetPurchase(purchaseAsset.asset_id, { ...purchaseForm, current_unit_price: purchaseForm.current_unit_price || null });
      setPurchaseAsset(null);
      await load();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Impossible d'enregistrer cet achat.");
    } finally {
      setPurchaseSaving(false);
    }
  }

  async function load() {
    try {
      setData(await getPatrimonySummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le patrimoine.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function submitPhysical(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await createPhysicalAsset({ ...physicalForm, estimated_value: physicalForm.estimated_value || "0", notes: physicalForm.notes || null });
      setPhysicalForm({ name_asset: "", estimated_value: "", valuation_date: today, notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter cet actif.");
    }
  }

  async function submitCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await createCashAsset({ ...cashForm, amount: cashForm.amount || "0", notes: cashForm.notes || null });
      setCashForm({ name_asset: "", amount: "", valuation_date: today, notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter ce cash.");
    }
  }

  async function submitMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createMarketAsset({
        ...marketForm,
        quantity: marketForm.quantity || "0",
        buy_unit_price: marketForm.buy_unit_price || "0",
        current_unit_price: marketForm.current_unit_price || null,
        notes: marketForm.notes || null,
      });
      setMarketForm({ name_asset: "", ticker: "", asset_type_code: "STOCK", quantity: "", buy_unit_price: "", current_unit_price: "", valuation_date: today, notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter cet actif de marche.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(asset: PatrimonyAsset) {
    if (asset.asset_id === null) return;
    setEditingAsset(asset);
    setEditForm({
      name_asset: asset.name,
      estimated_value: asset.value,
      valuation_date: asset.reference_date ?? today,
      notes: asset.notes ?? "",
    });
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset?.asset_id) return;
    setError(null);
    try {
      await updateAsset(editingAsset.asset_id, {
        ...editForm,
        estimated_value: editForm.estimated_value || "0",
        notes: editForm.notes || null,
      });
      setEditingAsset(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier cet actif.");
    }
  }

  async function confirmDelete() {
    if (!assetToDelete?.asset_id) return;
    await deleteAsset(assetToDelete.asset_id);
    setAssetToDelete(null);
    await load();
  }

  async function refreshPrice(asset: PatrimonyAsset) {
    if (!asset.asset_id) return;
    setError(null);
    try {
      await refreshAssetPrice(asset.asset_id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prix indisponible pour cet actif.");
    }
  }

  async function handleLedgerEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ledgerFile) return;
    setError(null);
    setLedgerLoading(true);
    try {
      const estimate = await estimateLedgerCsv(ledgerFile, ledgerTicker);
      setLedgerEstimate(estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'analyser ce CSV Ledger.");
    } finally {
      setLedgerLoading(false);
    }
  }

  async function handleLedgerImport() {
    if (!ledgerFile) return;
    setError(null);
    setLedgerImporting(true);
    try {
      await importLedgerCsv(ledgerFile, ledgerTicker);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'importer ce CSV Ledger dans le patrimoine.");
    } finally {
      setLedgerImporting(false);
    }
  }

  const patrimonyChartData = (data?.by_group ?? [])
    .map((row) => ({
      name: row.name,
      value: Number(row.value),
      share: Number(data?.total_value ?? 0) > 0 ? (Number(row.value) / Number(data?.total_value ?? 0)) * 100 : 0,
      fill: patrimonyGroupColors[row.name] ?? "#68756f",
    }))
    .sort((a, b) => b.value - a.value);

  if (!data && !error) return <PageLoader />;
  if (!data) return <main className="page-shell"><div role="alert" className="error-box">{error}</div><button type="button" onClick={() => { setError(null); void load(); }}>Réessayer</button></main>;

  return (
    <main className="page-shell portfolio-page">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Patrimoine</p>
          <h1>Ce que tu construis.</h1>
          <p>Tes placements, tes réserves et tes biens. Une lecture claire, sans mélanger valeur et bénéfice.</p>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}
      <nav className="panel mobile-switcher-panel" aria-label="Vues patrimoine">
        <div className="mobile-section-switcher">
          {([["assets", "Mes actifs"], ["capture", "Ajouter / importer"], ["pilotage", "Répartition"]] as const).map(([id, label]) => (
            <button key={id} type="button" className={section === id ? "primary-button" : "ghost-button"} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>
          ))}
        </div>
      </nav>

      {section !== "capture" && <section className="metric-grid portfolio-summary">
        <MetricCard label="Valeur totale" value={money(data?.total_value)} />
        <MetricCard label="Apports nets suivis" value={money(data?.total_invested)} hint="Achats moins ventes, et coût du stock brocante" />
        <MetricCard label="Gain latent estimé" value={money(data?.unrealized_pnl)} hint="Positions au coût connu et stock brocante" />
        <MetricCard label="Actifs suivis" value={`${data?.assets.length ?? 0}`} />
      </section>}

      {section === "capture" && <>
      <PatrimonyForms
        saving={saving}
        marketForm={marketForm}
        cashForm={cashForm}
        physicalForm={physicalForm}
        onMarketChange={setMarketForm}
        onCashChange={setCashForm}
        onPhysicalChange={setPhysicalForm}
        onSubmitMarket={(event) => void submitMarket(event)}
        onSubmitCash={(event) => void submitCash(event)}
        onSubmitPhysical={(event) => void submitPhysical(event)}
      />

      <section className="panel form-panel">
        <div className="section-title">Synchroniser un export Ledger</div>
        <p className="section-copy">
          Charge un export Ledger Live pour recalculer le PRU estime, la valeur actuelle et mettre a jour l'actif dans ton patrimoine
          sans ressaisir chaque mouvement a la main.
        </p>
        <form onSubmit={(event) => void handleLedgerEstimate(event)}>
          <div className="form-row">
            <label>
              Actif
              <select value={ledgerTicker} onChange={(event) => setLedgerTicker(event.target.value)}>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="BNB">BNB</option>
                <option value="XTZ">XTZ</option>
              </select>
            </label>
            <label>
              Export Ledger Live
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setLedgerFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="inline-form-actions">
            <button className="primary-button" type="submit" disabled={ledgerLoading || !ledgerFile}>
              {ledgerLoading ? "Analyse..." : "Calculer l'estimation"}
            </button>
            {ledgerEstimate ? (
              <button className="ghost-button" type="button" disabled={ledgerImporting || !ledgerFile} onClick={() => void handleLedgerImport()}>
                {ledgerImporting ? "Mise a jour..." : "Mettre a jour le patrimoine"}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {ledgerEstimate ? (
        <>
          <section className="metric-grid">
            <MetricCard label={`Quantité ${ledgerEstimate.asset_ticker}`} value={cryptoAmount(ledgerEstimate.current_quantity, ledgerEstimate.asset_ticker)} />
            <MetricCard label="PRU estimé" value={money(ledgerEstimate.average_buy_price_eur)} />
            <MetricCard label="Coût estimé" value={money(ledgerEstimate.estimated_cost_basis_eur)} />
            <MetricCard label="Valeur actuelle" value={money(ledgerEstimate.current_value_eur)} />
            <MetricCard label="P/L estimée" value={money(ledgerEstimate.unrealized_pnl_eur)} />
          </section>

          {ledgerEstimate.warnings.length ? (
            <section className="panel table-panel">
              <div className="section-title">Points d'attention CSV Ledger</div>
              <div className="stack-list">
                {ledgerEstimate.warnings.map((warning) => (
                  <p key={warning} className="warning-copy">{warning}</p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel table-panel compact-table">
            <div className="section-title">Mouvements Ledger retenus</div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Compte</th>
                    <th>Variation</th>
                    <th>Prix estimé</th>
                    <th>Montant estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEstimate.movements.map((movement) => (
                    <tr key={`${movement.txid ?? "tx"}-${movement.movement_date}-${movement.operation_type}`}>
                      <td>{movement.movement_date}</td>
                      <td>{movement.operation_type}</td>
                      <td>{movement.account_name}</td>
                      <td className={Number(movement.quantity) >= 0 ? "positive" : "negative"}>
                        {cryptoAmount(movement.quantity, ledgerEstimate.asset_ticker)}
                      </td>
                      <td>{movement.historical_unit_price_eur ? money(movement.historical_unit_price_eur) : "-"}</td>
                      <td>{movement.estimated_total_eur ? money(movement.estimated_total_eur) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      </>}
      {section === "pilotage" && <section className="panel chart-panel">
        <div className="table-toolbar">
          <div className="section-title">Répartition patrimoine</div>
          <div className="filters">
            <button
              type="button"
              className={`year-chip ${patrimonyChartMode === "pie" ? "active" : ""}`}
              onClick={() => setPatrimonyChartMode("pie")}
            >
              Camembert
            </button>
            <button
              type="button"
              className={`year-chip ${patrimonyChartMode === "mosaic" ? "active" : ""}`}
              onClick={() => setPatrimonyChartMode("mosaic")}
            >
              Mosaïque
            </button>
          </div>
        </div>
        {patrimonyChartMode === "pie" ? (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={patrimonyChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={112}
                paddingAngle={2}
                isAnimationActive={false}
                label={({ share }) => percent(Number(share ?? 0))}
                labelLine={false}
              >
                {patrimonyChartData.map((row) => (
                  <Cell key={row.name} fill={row.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value, _name, payload) => [`${money(String(value))} · ${percent(Number(payload?.payload?.share ?? 0))}`, payload?.payload?.name ?? ""]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="patrimony-mosaic">
            {patrimonyChartData.map((item, index) => (
              <article key={item.name} className={`patrimony-mosaic-card ${index === 0 ? "featured" : ""}`}>
                <div className="patrimony-mosaic-accent" style={{ background: item.fill }} />
                <div className="patrimony-mosaic-header">
                  <strong>{item.name}</strong>
                  <span>{percent(item.share)}</span>
                </div>
                <div className="patrimony-mosaic-value">{money(String(item.value))}</div>
                <div className="patrimony-mosaic-bar">
                  <div className="patrimony-mosaic-bar-fill" style={{ width: `${Math.max(item.share, 4)}%`, background: item.fill }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      {section === "assets" && <PatrimonyAssetsTable
        assets={data?.assets ?? []}
        money={money}
        latentPnl={latentPnl}
        showPnl={showPnl}
        onRefreshPrice={refreshPrice}
        onEdit={openEdit}
        onDelete={setAssetToDelete}
        onPurchase={openPurchase}
      />}

      {purchaseAsset && <Modal title={`Acheter ${purchaseAsset.name}`} eyebrow="Renforcer ma position" onClose={() => { if (!purchaseSaving) setPurchaseAsset(null); }}>
        <form className="modal-form" onSubmit={(event) => void submitPurchase(event)}>
          <p className="section-copy">Cet achat s'ajoute à ta position existante. Le symbole et le type de placement sont conservés automatiquement.</p>
          {purchaseError && <div role="alert" className="error-box">{purchaseError}</div>}
          <fieldset disabled={purchaseSaving} className="purchase-fields">
            <div className="form-row">
              <label>Quantité achetée<input autoFocus required type="number" min="0.00000001" step="0.00000001" value={purchaseForm.quantity} onChange={event => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} /></label>
              <label>Prix unitaire payé (€), frais inclus<input required type="number" min="0" step="0.00000001" value={purchaseForm.buy_unit_price} onChange={event => setPurchaseForm({ ...purchaseForm, buy_unit_price: event.target.value })} /></label>
            </div>
            <label>Date d'achat<input required type="date" value={purchaseForm.valuation_date} onChange={event => setPurchaseForm({ ...purchaseForm, valuation_date: event.target.value })} /></label>
            <label>Cours actuel unitaire (€), facultatif<input type="number" min="0.00000001" step="0.00000001" placeholder="Sinon, cours EUR automatique" value={purchaseForm.current_unit_price} onChange={event => setPurchaseForm({ ...purchaseForm, current_unit_price: event.target.value })} /></label>
          </fieldset>
          <div className="portfolio-preview"><span>Montant de cet achat</span><strong className="sensitive-value">{money(String(Number(purchaseForm.quantity || 0) * Number(purchaseForm.buy_unit_price || 0)))}</strong><small>La quantité détenue et le PRU seront recalculés après l'enregistrement.</small></div>
          <div className="modal-actions"><button disabled={purchaseSaving} className="ghost-button" type="button" onClick={() => setPurchaseAsset(null)}>Annuler</button><button disabled={purchaseSaving} className="primary-button" type="submit">{purchaseSaving ? "Enregistrement…" : "Ajouter cet achat"}</button></div>
        </form>
      </Modal>}

      {editingAsset ? (
        <Modal title="Modifier l'actif" eyebrow={editingAsset.type} onClose={() => setEditingAsset(null)}>
          <form className="modal-form" onSubmit={(event) => void submitEdit(event)}>
            <label>
              Nom
              <input value={editForm.name_asset} onChange={(event) => setEditForm({ ...editForm, name_asset: event.target.value })} />
            </label>
            <div className="form-row">
              <label>
                Valeur actuelle
                <input type="number" value={editForm.estimated_value} onChange={(event) => setEditForm({ ...editForm, estimated_value: event.target.value })} />
              </label>
              <label>
                Date valeur
                <input type="date" value={editForm.valuation_date} onChange={(event) => setEditForm({ ...editForm, valuation_date: event.target.value })} />
              </label>
            </div>
            <label>
              Notes
              <textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingAsset(null)}>Annuler</button>
              <button className="primary-button" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {assetToDelete ? (
        <Modal title="Supprimer cet actif ?" eyebrow="Patrimoine" onClose={() => setAssetToDelete(null)}>
          <p className="modal-copy">Tu vas supprimer <strong>{assetToDelete.name}</strong> de ton patrimoine suivi.</p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setAssetToDelete(null)}>Garder</button>
            <button className="primary-button danger-primary" type="button" onClick={() => void confirmDelete()}>Supprimer</button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
