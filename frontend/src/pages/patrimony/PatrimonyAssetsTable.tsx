import { useState } from "react";
import { Pencil, RefreshCw, Trash2, Search } from "lucide-react";
import type { PatrimonySummary } from "../../api/dashboard";

type Asset = PatrimonySummary["assets"][number];
type Props = {
  assets: Asset[];
  money: (value: string | null | undefined) => string;
  latentPnl: (asset: Asset) => number;
  showPnl: (asset: Asset) => boolean;
  onRefreshPrice: (asset: Asset) => void | Promise<void>;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
};
const groups: Record<string, string> = { financial: "Bourse", crypto: "Crypto", cash: "Liquidités", patrimony: "Biens physiques", resale: "Achat-revente", brocante: "Brocante" };

export function PatrimonyAssetsTable({ assets, money, latentPnl, showPnl, onRefreshPrice, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [busy, setBusy] = useState<number | null>(null);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = assets.filter(asset => (group === "all" || asset.group === group) && normalize(asset.name).includes(normalize(search))).sort((a, b) => Number(b.value) - Number(a.value));
  const total = assets.reduce((sum, asset) => sum + Number(asset.value), 0);
  return <section className="portfolio-positions">
    <div className="table-toolbar"><div><h2>Mes positions</h2><p className="section-copy">{filtered.length} actifs · classés par valeur</p></div><label className="portfolio-search"><Search size={17} /><input aria-label="Rechercher un actif" placeholder="Rechercher un actif…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    <div className="portfolio-filters" aria-label="Catégories d'actifs">{[["all", "Tout"], ...Object.entries(groups).filter(([key]) => assets.some(asset => asset.group === key))].map(([key, label]) => <button type="button" key={key} aria-pressed={group === key} className={group === key ? "active" : ""} onClick={() => setGroup(key)}>{label}</button>)}</div>
    <div className="portfolio-position-grid">
      {filtered.map(asset => {
        const share = total > 0 ? Number(asset.value) / total * 100 : 0;
        const market = ["financial", "crypto"].includes(asset.group);
        const quantity = Number(asset.quantity ?? 0);
        return <article className="portfolio-position" key={`${asset.group}-${asset.asset_id}-${asset.name}`}>
          <header><div className="portfolio-monogram" aria-hidden="true">{asset.name.slice(0, 2).toUpperCase()}</div><div><h3>{asset.name}</h3><small>{groups[asset.group] ?? asset.type}</small></div><span className="portfolio-share sensitive-value">{share.toFixed(1)} %</span></header>
          <div className="portfolio-position-value sensitive-value">{money(asset.value)}</div>
          <div className="portfolio-weight" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, share))}%` }} /></div>
          {market && <dl className="portfolio-position-details">
            <div><dt>Quantité</dt><dd className="sensitive-value">{asset.quantity == null ? "Non renseignée" : quantity.toLocaleString("fr-FR", { maximumFractionDigits: 8 })}</dd></div>
            <div><dt>PRU restant</dt><dd className="sensitive-value">{asset.cost_basis != null && quantity > 0 ? money(String(Number(asset.cost_basis) / quantity)) : "Non renseigné"}</dd></div>
            <div><dt>Gain latent</dt><dd className={`sensitive-value ${showPnl(asset) ? latentPnl(asset) >= 0 ? "positive" : "negative" : ""}`}>{showPnl(asset) ? money(String(latentPnl(asset))) : "Coût inconnu"}</dd></div>
          </dl>}
          <small className="portfolio-updated">{asset.valuation_date ? `Valeur au ${new Date(asset.valuation_date + "T12:00:00").toLocaleDateString("fr-FR")}` : asset.asset_id == null ? "Valeur issue du stock" : "Date de valorisation non renseignée"}</small>
          {asset.asset_id !== null && <footer>
            {market && <button type="button" disabled={busy !== null} onClick={async () => { setBusy(asset.asset_id); try { await onRefreshPrice(asset); } finally { setBusy(null); } }}><RefreshCw size={14} className={busy === asset.asset_id ? "is-spinning" : ""} /> Actualiser</button>}
            <button type="button" onClick={() => onEdit(asset)}><Pencil size={14} /> Modifier</button>
            <button type="button" aria-label={`Supprimer ${asset.name}`} onClick={() => onDelete(asset)}><Trash2 size={14} /></button>
          </footer>}
        </article>;
      })}
    </div>
    {!filtered.length && <div className="panel studio-empty">{assets.length ? "Aucun actif ne correspond à ces filtres." : "Ajoute ton premier actif dans Ajouter / importer."}</div>}
    <p className="section-copy">Gain latent au coût moyen des titres restants, hors dividendes. Les transferts au coût inconnu ne donnent pas de gain fiable. Les opérations sur titres doivent être prises en compte dans tes quantités et ton PRU.</p>
  </section>;
}
