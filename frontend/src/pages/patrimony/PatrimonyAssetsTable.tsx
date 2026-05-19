import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { PatrimonySummary } from "../../api/dashboard";

type PatrimonyAsset = PatrimonySummary["assets"][number];

type PatrimonyAssetsTableProps = {
  assets: PatrimonyAsset[];
  money: (value: string | null | undefined) => string;
  latentPnl: (asset: PatrimonyAsset) => number;
  showPnl: (asset: PatrimonyAsset) => boolean;
  onRefreshPrice: (asset: PatrimonyAsset) => void | Promise<void>;
  onEdit: (asset: PatrimonyAsset) => void;
  onDelete: (asset: PatrimonyAsset) => void;
};

export function PatrimonyAssetsTable({
  assets,
  money,
  latentPnl,
  showPnl,
  onRefreshPrice,
  onEdit,
  onDelete,
}: PatrimonyAssetsTableProps) {
  return (
    <section className="panel table-panel compact-table">
      <div className="section-title">Détail des actifs</div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Actif</th>
              <th>Type</th>
              <th>Groupe</th>
              <th>Investi</th>
              <th>Valeur</th>
              <th>P/L latente</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={`${asset.group}-${asset.name}-${asset.asset_id ?? "aggregate"}`}>
                <td>{asset.name}</td>
                <td>{asset.type}</td>
                <td>{asset.group}</td>
                <td>{showPnl(asset) ? money(asset.invested_net) : "-"}</td>
                <td>{money(asset.value)}</td>
                <td className={latentPnl(asset) >= 0 ? "positive" : "negative"}>
                  {showPnl(asset) ? money(String(latentPnl(asset))) : "-"}
                </td>
                <td className="actions">
                  {asset.asset_id !== null ? (
                    <>
                      {["financial", "crypto"].includes(asset.group) ? (
                        <button type="button" onClick={() => void onRefreshPrice(asset)}><RefreshCw size={16} /> Prix</button>
                      ) : null}
                      <button type="button" onClick={() => onEdit(asset)}><Pencil size={16} /> Modifier</button>
                      <button className="danger-button" type="button" onClick={() => onDelete(asset)}><Trash2 size={16} /></button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
