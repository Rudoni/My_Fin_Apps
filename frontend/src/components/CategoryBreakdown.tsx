export function CategoryBreakdown({ rows }: { rows: Array<{ name: string; value: string }> }) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value)), 0);
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  return <section className="panel category-breakdown">
    <p className="eyebrow">Où va ton budget ?</p><h2>Les postes de dépenses</h2>
    <p className="section-copy">Part de chaque catégorie sur la période sélectionnée.</p>
    {rows.length ? <ul>{[...rows].sort((a, b) => Number(b.value) - Number(a.value)).map(row => {
      const share = total > 0 ? Math.max(0, Number(row.value)) / total * 100 : 0;
      return <li key={row.name}><div><span>{row.name}</span><strong className="sensitive-value">{money.format(Number(row.value))}</strong></div><div className="category-breakdown-track sensitive-chart" aria-hidden="true"><span style={{ width: `${share}%` }} /></div><small className="sensitive-value">{share.toFixed(1).replace('.', ',')} %</small></li>;
    })}</ul> : <p className="studio-empty">Ajoute une dépense pour découvrir ta répartition.</p>}
  </section>;
}
