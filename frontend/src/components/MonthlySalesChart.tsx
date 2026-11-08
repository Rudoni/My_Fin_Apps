import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Metric = { label: string; value: string };
export function MonthlySalesChart({ revenue, profit }: { revenue: Metric[]; profit: Metric[] }) {
  const [all, setAll] = useState(false);
  const labels = [...new Set([...revenue, ...profit].map((row) => row.label))].sort();
  const rows = labels.map((label) => ({
    month: label,
    CA: Number(revenue.find((row) => row.label === label)?.value ?? 0),
    Bénéfice: Number(profit.find((row) => row.label === label)?.value ?? 0),
  }));
  const money = (value: unknown) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
  return <section className="panel chart-panel full-width-section">
    <div className="table-toolbar"><div className="section-title">CA et bénéfice réalisés par mois</div><button type="button" className="ghost-button" onClick={() => setAll(!all)}>{all ? "12 derniers mois de vente" : "Tout l’historique"}</button></div>
    <p className="section-copy">Selon la date de vente. Pour les articles communs, seule ta part est comptée.</p>
    {rows.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={all ? rows : rows.slice(-12)}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" minTickGap={25} /><YAxis width={60} /><Tooltip formatter={money} /><Legend />
      <Bar dataKey="CA" fill="#24634e" radius={[4, 4, 0, 0]} isAnimationActive={false} /><Bar dataKey="Bénéfice" fill="#dda35b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
    </BarChart></ResponsiveContainer> : <p className="section-copy">Aucune vente datée sur cette période.</p>}
  </section>;
}
