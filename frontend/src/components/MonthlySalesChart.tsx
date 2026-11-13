import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Metric = { label: string; value: string };
export function MonthlySalesChart({ revenue, profit }: { revenue: Metric[]; profit: Metric[] }) {
  const [all, setAll] = useState(false);
  const [series, setSeries] = useState<"both" | "CA" | "Bénéfice">("both");
  const labels = [...new Set([...revenue, ...profit].map((row) => row.label))].sort();
  const rows = labels.map((label) => ({
    month: label,
    CA: Number(revenue.find((row) => row.label === label)?.value ?? 0),
    Bénéfice: Number(profit.find((row) => row.label === label)?.value ?? 0),
  }));
  const money = (value: unknown) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
  const monthLabel = (value: string) => /^\d{4}-\d{2}/.test(value) ? new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1)) : value;
  return <section className="panel chart-panel full-width-section sales-dashboard">
    <div className="table-toolbar"><div><p className="eyebrow">Le rythme de ton activité</p><h2>Des ventes aux bénéfices.</h2></div><button type="button" className="ghost-button" aria-pressed={all} onClick={() => setAll(!all)}>{all ? "12 derniers mois de vente" : "Tout l’historique"}</button></div>
    <div className="sales-chart-controls"><p className="section-copy">Selon la date de vente · articles communs : ta part uniquement.</p><div className="studio-tabs" aria-label="Indicateurs du graphique">{([['both', 'Comparer'], ['CA', 'Chiffre d’affaires'], ['Bénéfice', 'Bénéfice']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={series === key} className={series === key ? "active" : ""} onClick={() => setSeries(key)}>{label}</button>)}</div></div>
    {rows.length ? <div className="sensitive-chart"><ResponsiveContainer width="100%" height={280}><BarChart data={all ? rows : rows.slice(-12)} barCategoryGap="28%" margin={{ top: 16, right: 4, left: 0, bottom: 4 }}>
      <CartesianGrid vertical={false} stroke="#e3e8de" /><XAxis dataKey="month" tickFormatter={monthLabel} minTickGap={25} tickLine={false} axisLine={false} /><YAxis width={58} tickLine={false} axisLine={false} tickFormatter={(value: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} /><Tooltip formatter={money} labelFormatter={label => monthLabel(String(label))} cursor={{ fill: '#edf3e6' }} /><Legend />
      {series !== "Bénéfice" && <Bar dataKey="CA" fill="#24634e" radius={[4, 4, 0, 0]} isAnimationActive={false} />}{series !== "CA" && <Bar dataKey="Bénéfice" fill="#dda35b" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
    </BarChart></ResponsiveContainer></div> : <div className="studio-empty">Tes premières ventes dessineront la courbe ici.<br />Enregistre une vente datée pour commencer.</div>}
    <small className="sales-chart-note">Montants en euros · {all ? "Tous les mois renseignés" : "Jusqu’à 12 derniers mois de vente renseignés"}</small>
  </section>;
}
