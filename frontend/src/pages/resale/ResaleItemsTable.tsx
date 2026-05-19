import { Pencil, Search, Trash2 } from "lucide-react";
import type { ResaleItem, ResaleStatusFilter } from "../../api/resale";

type ResaleItemsTableProps = {
  items: ResaleItem[];
  totalItems: number;
  categories: string[];
  category: string;
  statusFilter: ResaleStatusFilter;
  search: string;
  loading: boolean;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  savingCategoryId: number | null;
  money: (value: string | null | undefined) => string;
  onPageSizeChange: (value: number) => void;
  onCategoryFilterChange: (value: string) => void;
  onStatusFilterChange: (value: ResaleStatusFilter) => void;
  onSearchChange: (value: string) => void;
  onInlineCategoryChange: (item: ResaleItem, category: string) => void | Promise<void>;
  onEdit: (item: ResaleItem) => void;
  onMarkSold: (item: ResaleItem) => void;
  onDelete: (item: ResaleItem) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function ResaleItemsTable({
  items,
  totalItems,
  categories,
  category,
  statusFilter,
  search,
  loading,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  savingCategoryId,
  money,
  onPageSizeChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onInlineCategoryChange,
  onEdit,
  onMarkSold,
  onDelete,
  onPreviousPage,
  onNextPage,
}: ResaleItemsTableProps) {
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div className="section-title">Lignes achat-revente</div>
        <div className="filters">
          <label className="search-field">
            <Search size={16} />
            <input placeholder="Rechercher..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
          </label>
          <select className="filter-select" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} lignes
              </option>
            ))}
          </select>
          <select className="filter-select" value={category} onChange={(event) => onCategoryFilterChange(event.target.value)}>
            <option value="">Toutes catégories</option>
            {categories.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select className="filter-select" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as ResaleStatusFilter)}>
            <option value="all">Tous statuts</option>
            <option value="available">Disponible</option>
            <option value="sold">Vendu</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Prix payé</th>
                <th>Prix attendu</th>
                <th>Prix vente</th>
                <th>Bénéfice</th>
                <th>P/L latente</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.resale_item_id}>
                  <td>{item.pair_name}</td>
                  <td>
                    <select
                      value={item.resale_category}
                      disabled={savingCategoryId === item.resale_item_id}
                      onChange={(event) => void onInlineCategoryChange(item, event.target.value)}
                    >
                      {categories.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td>{money(item.purchase_price)}</td>
                  <td>{money(item.expected_price)}</td>
                  <td>{money(item.sale_price)}</td>
                  <td className={Number(item.benefit) >= 0 ? "positive" : "negative"}>{money(item.benefit)}</td>
                  <td className={Number(item.expected_benefit) >= 0 ? "positive" : "negative"}>
                    {item.status === "Vendu" ? "-" : money(item.expected_benefit)}
                  </td>
                  <td><span className="status-pill">{item.status}</span></td>
                  <td className="actions">
                    <button type="button" onClick={() => onEdit(item)}><Pencil size={16} /> Modifier</button>
                    {item.status !== "Vendu" ? <button type="button" onClick={() => onMarkSold(item)}>Vendu</button> : null}
                    <button className="danger-button" type="button" onClick={() => onDelete(item)} aria-label="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalItems > pageSize ? (
        <div className="table-footer">
          <span>{totalItems} lignes · page {currentPage} / {totalPages}</span>
          <div className="pagination-actions">
            <button className="ghost-button" type="button" disabled={currentPage === 1} onClick={onPreviousPage}>Prec.</button>
            <button className="ghost-button" type="button" disabled={currentPage === totalPages} onClick={onNextPage}>Suiv.</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
