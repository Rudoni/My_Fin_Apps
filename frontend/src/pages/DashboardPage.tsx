import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw, Wallet, Boxes, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboardSummary, type DashboardSummary } from "../api/dashboard";
import { getBudgetYears } from "../api/budget";
import { getResaleYears } from "../api/resale";
import { type AppPage } from "../components/AppLayout";
import { YearFilter } from "../components/YearFilter";
import { MetricCard } from "../components/MetricCard";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const colors = ["#1e6353", "#a0bc70", "#dda35b", "#637f93", "#b88777", "#778663"];
const money = (value: string | number | undefined) => currency.format(Number(value ?? 0));
const month = (label: string) => label.length >= 7 ? `${label.slice(5, 7)}/${label.slice(2, 4)}` : label;
type View = "overview" | "cashflow" | "wealth";

export function DashboardPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [view, setView] = useState<View>("overview");
  const [range, setRange] = useState<"recent" | "all">("recent");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getDashboardSummary(selectedYears), getBudgetYears(), getResaleYears()])
      .then(([summary, budgetYears, resaleYears]) => {
        if (!active) return;
        setData(summary);
        setYears([...new Set([...budgetYears, ...resaleYears])].sort((a, b) => b - a));
      })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Chargement impossible"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedYears, revision]);

  const budget = data?.budget;
  const value = Number(data?.patrimony.total_value ?? 0);
  const income = Number(budget?.total_income_with_complementary ?? 0);
  const spending = Number(budget?.expense_total ?? 0);
  const investment = Number(budget?.investment_effort_total ?? 0);
  const monthly = [...new Set([
    ...(budget?.income_with_complementary_by_month ?? []).map((r) => r.label),
    ...(budget?.expense_by_month ?? []).map((r) => r.label),
    ...(budget?.investment_effort_by_month ?? []).map((r) => r.label),
  ])].sort().map((label) => {
    const revenue = Number(budget?.income_with_complementary_by_month.find((r) => r.label === label)?.value ?? 0);
    const expenses = Number(budget?.expense_by_month.find((r) => r.label === label)?.value ?? 0);
    const invested = Number(budget?.investment_effort_by_month.find((r) => r.label === label)?.value ?? 0);
    return { label, Revenus: revenue, Dépenses: -expenses, Investissements: -invested, Net: revenue - expenses - invested, Disponible: revenue - expenses };
  });
  const timeline = [...new Set([
    ...(data?.patrimony_timeline ?? []).map((r) => r.label),
    ...(data?.patrimony_invested_timeline ?? []).map((r) => r.label),
    ...(data?.patrimony_cumulative_invested_timeline ?? []).map((r) => r.label),
  ])].sort().map((label) => ({
    label,
    Patrimoine: Number(data?.patrimony_timeline.find((r) => r.label === label)?.value ?? 0),
    "Capital investi": Number(data?.patrimony_invested_timeline.find((r) => r.label === label)?.value ?? 0),
    "Investi cumulé": Number(data?.patrimony_cumulative_invested_timeline.find((r) => r.label === label)?.value ?? 0),
  }));
  const blocks = (data?.patrimony.by_group ?? []).map((r, i) => ({ name: r.name, value: Number(r.value), color: colors[i % colors.length] }));
  const average = monthly.length ? monthly.reduce((sum, r) => sum + r.Disponible, 0) / monthly.length : 0;
  const netAverage = monthly.length ? monthly.reduce((sum, r) => sum + r.Net, 0) / monthly.length : 0;
  const period = selectedYears.length ? selectedYears.join(", ") : "Tout l’historique";
  const tooltip = <Tooltip formatter={(v) => money(String(v))} labelFormatter={(v) => month(String(v))} />;

  return (
    <main className="page-shell studio-dashboard">
      <header className="hero">
        <div><p className="eyebrow">Ton espace financier</p><h1>Une vue d’avance.</h1><p>Ton argent, tes projets, les bonnes décisions.</p></div>
        <div className="hero-actions">
          <YearFilter years={years} selectedYears={selectedYears} onChange={setSelectedYears} />
          <button className="icon-button" type="button" aria-label="Actualiser le dashboard" disabled={loading} onClick={() => setRevision((v) => v + 1)}><RefreshCw size={18} className={loading ? "is-spinning" : ""} /></button>
        </div>
      </header>
      <div className="studio-toolbar">
        <nav className="studio-tabs" aria-label="Vues du dashboard">
          {([["overview", "Vue d’ensemble"], ["cashflow", "Flux & budget"], ["wealth", "Patrimoine"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}
        </nav>
        <span className="studio-period">{loading ? "Actualisation…" : period}</span>
      </div>
      {error ? <div className="error-box" role="alert">{error} <button type="button" className="ghost-button" onClick={() => setRevision((v) => v + 1)}>Réessayer</button></div> : null}
      {!data ? <section className="panel studio-empty" role="status">{loading ? "Nous préparons ta vue d’ensemble…" : "Les données ne sont pas disponibles."}</section> : (
        <>
          {view === "overview" && <>
            <section className="studio-overview">
              <article className="studio-wealth-card">
                <div className="studio-card-top"><span><Wallet size={18} /> Patrimoine suivi</span><span className="studio-chip">Valeur actuelle</span></div>
                <strong className="studio-wealth-number sensitive-value">{money(value)}</strong>
                <p>Actifs, brocante et stock achat-revente réunis.</p>
                <div className="studio-wealth-footer"><span>Plus-value latente <b className="sensitive-value">{money(data.patrimony.unrealized_pnl)}</b></span><button type="button" onClick={() => setView("wealth")} aria-label="Explorer le patrimoine"><ArrowUpRight size={24} /></button></div>
              </article>
              <article className="panel studio-compass">
                <p className="eyebrow">Ta marge de manœuvre</p>
                <h2 className="sensitive-value">{money(average)}<small> / mois</small></h2>
                <p>Revenus moins dépenses de vie, avant investissement.</p>
                <div className="studio-compass-note"><TrendingUp size={20} /><span>{monthly.length ? `Moyenne sur ${monthly.length} mois renseignés.` : "Ajoute tes premiers revenus et dépenses."}</span></div>
                <button className="ghost-button" type="button" onClick={() => setView("cashflow")}>Comprendre mes flux <ArrowUpRight size={16} /></button>
              </article>
            </section>
            <section className="studio-quick-actions" aria-label="Actions rapides">
              <button type="button" onClick={() => onNavigate("expenses")}><span className="studio-action-icon"><Plus size={20} /></span><span><strong>Ajouter une dépense</strong><small>Garder le fil du quotidien</small></span><ArrowUpRight size={18} /></button>
              <button type="button" onClick={() => onNavigate("brocante")}><span className="studio-action-icon"><Boxes size={20} /></span><span><strong>Gérer ma brocante</strong><small>Stock, binder et ventes</small></span><ArrowUpRight size={18} /></button>
              <button type="button" onClick={() => onNavigate("resale")}><span className="studio-action-icon"><TrendingUp size={20} /></span><span><strong>Achat-revente</strong><small>Saisir et suivre mes opérations</small></span><ArrowUpRight size={18} /></button>
            </section>
          </>}

          {view === "cashflow" && <section className="metric-grid">
            <MetricCard label="Revenus de la période" value={money(income)} hint="Revenus saisis et bénéfices complémentaires" />
            <MetricCard label="Dépenses de vie" value={money(spending)} hint="Sur la période sélectionnée" />
            <MetricCard label="Effort d’investissement" value={money(investment)} hint="Allocations et achats achat-revente" />
            <MetricCard label="Net moyen après investissement" value={money(netAverage)} hint="Par mois renseigné" />
          </section>}

          {(view === "overview" || view === "wealth") && <section className="studio-chart-grid">
            <article className="panel chart-panel">
              <div className="studio-panel-heading"><div><p className="eyebrow">La trajectoire</p><h2>Ton patrimoine dans le temps</h2></div><span className="studio-chip">Historique disponible</span></div>
              {timeline.length ? <div className="sensitive-chart"><ResponsiveContainer width="100%" height={300}><AreaChart data={timeline} margin={{ left: 0, right: 12, top: 18 }}>
                <defs><linearGradient id="wealth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4e987d" stopOpacity={0.3} /><stop offset="100%" stopColor="#4e987d" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e8ece5" /><XAxis dataKey="label" tickFormatter={month} minTickGap={36} axisLine={false} tickLine={false} /><YAxis width={48} tickFormatter={(v) => compact.format(Number(v))} axisLine={false} tickLine={false} />
                {tooltip}<Area dataKey="Patrimoine" type="monotone" stroke="#1e6353" strokeWidth={3} fill="url(#wealth-fill)" isAnimationActive={false} />
                {view === "wealth" && <Area dataKey="Capital investi" type="monotone" stroke="#dda35b" fill="transparent" isAnimationActive={false} />}
                {view === "wealth" && <Area dataKey="Investi cumulé" type="monotone" stroke="#637f93" strokeDasharray="5 5" fill="transparent" isAnimationActive={false} />}
                {view === "wealth" && <Legend />}
              </AreaChart></ResponsiveContainer></div> : <p className="studio-empty">Ajoute un actif pour démarrer ton historique.</p>}
            </article>
            <article className="panel studio-allocation">
              <div className="studio-panel-heading"><div><p className="eyebrow">L’équilibre</p><h2>Répartition des actifs</h2></div></div>
              {blocks.some((b) => b.value > 0) ? <div className="sensitive-chart"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={blocks.filter((b) => b.value > 0)} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none" isAnimationActive={false}>{blocks.filter((b) => b.value > 0).map((b) => <Cell key={b.name} fill={b.color} />)}</Pie><Tooltip formatter={(v) => money(String(v))} /></PieChart></ResponsiveContainer></div> : <p className="studio-empty">La répartition apparaîtra ici.</p>}
              <div className="studio-allocation-list">{blocks.map((b) => <div key={b.name}><span><i style={{ background: b.color }} />{b.name}</span><strong className="sensitive-value">{value ? (b.value / value * 100).toFixed(1) : "0"} %</strong></div>)}</div>
            </article>
          </section>}

          {view === "cashflow" && <article className="panel chart-panel">
            <div className="studio-panel-heading"><div><p className="eyebrow">Entrées & sorties</p><h2>Chaque mois compte.</h2></div><div className="studio-tabs"><button type="button" className={range === "recent" ? "active" : ""} aria-pressed={range === "recent"} onClick={() => setRange("recent")}>12 derniers mois</button><button type="button" className={range === "all" ? "active" : ""} aria-pressed={range === "all"} onClick={() => setRange("all")}>Tout</button></div></div>
            <p className="section-copy">Les investissements apparaissent séparément des dépenses de vie. La ligne représente le net après investissement.</p>
            {monthly.length ? <div className="sensitive-chart"><ResponsiveContainer width="100%" height={340}><ComposedChart data={range === "recent" ? monthly.slice(-12) : monthly}>
              <CartesianGrid vertical={false} stroke="#e8ece5" /><XAxis dataKey="label" tickFormatter={month} minTickGap={25} axisLine={false} tickLine={false} /><YAxis width={48} tickFormatter={(v) => compact.format(Number(v))} axisLine={false} tickLine={false} />{tooltip}<ReferenceLine y={0} stroke="#a5afa7" />
              <Bar dataKey="Revenus" fill="#1e6353" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} /><Bar dataKey="Dépenses" fill="#dda35b" maxBarSize={24} isAnimationActive={false} /><Bar dataKey="Investissements" fill="#9bafa1" maxBarSize={24} isAnimationActive={false} /><Line dataKey="Net" stroke="#446d8c" strokeWidth={2} dot={false} isAnimationActive={false} /><Legend />
            </ComposedChart></ResponsiveContainer></div> : <p className="studio-empty">Aucun flux pour cette période.</p>}
            <div className="studio-flow-footer"><span><ArrowDownLeft size={18} /> Avant investissement <b className="sensitive-value">{money(average)} / mois</b></span><span><ArrowUpRight size={18} /> Après investissement <b className="sensitive-value">{money(netAverage)} / mois</b></span></div>
          </article>}
          {view === "wealth" && <>
            <section className="metric-grid"><MetricCard label="Valeur actuelle" value={money(value)} /><MetricCard label="Capital investi" value={money(data.patrimony.total_invested)} /><MetricCard label="Plus-value latente" value={money(data.patrimony.unrealized_pnl)} /><MetricCard label="Stock achat-revente estimé" value={money(data.resale_unsold_value)} /></section>
            <button className="primary-button studio-detail-link" type="button" onClick={() => onNavigate("patrimony")}>Gérer mes actifs <ArrowUpRight size={18} /></button>
          </>}
        </>
      )}
    </main>
  );
}
