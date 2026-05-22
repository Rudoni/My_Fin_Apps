import { useEffect, useState } from "react";
import { Bar, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Legend, Line, LineChart, ComposedChart, ReferenceLine } from "recharts";
import { getDashboardSummary, DashboardSummary } from "../api/dashboard";
import { getBudgetYears } from "../api/budget";
import { getResaleYears } from "../api/resale";
import { YearFilter } from "../components/YearFilter";
import { useIsMobile } from "../hooks/useIsMobile";

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const percentFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const patrimonyColors = ["#17211d", "#0f766e", "#f59e0b", "#b45309", "#4f46e5", "#7c5c34", "#68756f"];

function money(value: string | number | null | undefined) {
  return euroFormatter.format(Number(value ?? 0));
}

function percent(value: number) {
  return `${percentFormatter.format(value)} %`;
}

function safeRatio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
}

export function DashboardPage() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [summary, budgetYears, resaleYears] = await Promise.all([
        getDashboardSummary(selectedYears),
        getBudgetYears(),
        getResaleYears(),
      ]);
      setData(summary);
      setAvailableYears(Array.from(new Set([...budgetYears, ...resaleYears])).sort((a, b) => b - a));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  useEffect(() => {
    void load();
  }, [selectedYears]);

  const incomeTotal = Number(data?.budget.total_income_with_complementary ?? 0);
  const baseIncome = Number(data?.budget.income_total ?? 0);
  const complementaryIncome = Number(data?.budget.complementary_income_total ?? 0);
  const expenses = Number(data?.budget.expense_total ?? 0);
  const allocations = Number(data?.budget.allocation_total ?? 0);
  const resalePurchases = Number(data?.budget.resale_purchase_total ?? 0);
  const investmentEffort = Number(data?.budget.investment_effort_total ?? 0);
  const cashflow = Number(data?.budget.cashflow_with_complementary ?? 0);
  const freeCash = Number(data?.budget.cashflow_after_allocations ?? 0);
  const patrimony = Number(data?.patrimony.total_value ?? 0);
  const patrimonyPnl = Number(data?.patrimony.unrealized_pnl ?? 0);
  const resaleBenefit = Number(data?.resale_benefit_total ?? 0);
  const resaleStock = Number(data?.resale_unsold_value ?? 0);

  const savingsRate = safeRatio(freeCash, incomeTotal);
  const lifestyleRate = safeRatio(expenses, incomeTotal);
  const allocationRate = safeRatio(investmentEffort, incomeTotal);
  const complementaryIncomeRate = safeRatio(complementaryIncome, incomeTotal);

  const monthly = Array.from(
    new Set([
      ...(data?.budget.income_with_complementary_by_month ?? []).map((row) => row.label),
      ...(data?.budget.expense_by_month ?? []).map((row) => row.label),
      ...(data?.budget.investment_effort_by_month ?? []).map((row) => row.label),
    ]),
  )
    .sort()
    .map((label) => ({
      label,
      shortLabel: monthLabel(label),
      Revenus: Number(data?.budget.income_with_complementary_by_month.find((row) => row.label === label)?.value ?? 0),
      Depenses: Number(data?.budget.expense_by_month.find((row) => row.label === label)?.value ?? 0),
      Investissements: Number(data?.budget.investment_effort_by_month.find((row) => row.label === label)?.value ?? 0),
    }))
    .map((row) => ({
      ...row,
      SortiesVie: -row.Depenses,
      SortiesInvest: -row.Investissements,
      Net: row.Revenus - row.Depenses - row.Investissements,
    }));

  const patrimonyBlocks = (data?.patrimony.by_group ?? []).map((row, index) => ({
    name: row.name,
    value: Number(row.value),
    share: patrimony > 0 ? (Number(row.value) / patrimony) * 100 : 0,
    fill: patrimonyColors[index % patrimonyColors.length],
  }));
  const patrimonyTimeline = Array.from(
    new Set([
      ...(data?.patrimony_timeline ?? []).map((row) => row.label),
      ...(data?.patrimony_invested_timeline ?? []).map((row) => row.label),
      ...(data?.patrimony_cumulative_invested_timeline ?? []).map((row) => row.label),
    ]),
  )
    .sort()
    .map((label) => ({
      label,
      Patrimoine: Number(data?.patrimony_timeline.find((row) => row.label === label)?.value ?? 0),
      Investi: Number(data?.patrimony_invested_timeline.find((row) => row.label === label)?.value ?? 0),
      "Investi cumulé": Number(data?.patrimony_cumulative_invested_timeline.find((row) => row.label === label)?.value ?? 0),
    }));

  const financialHealthState =
    freeCash > 0 && savingsRate >= 15 ? "Solide" : freeCash > 0 ? "Sous contrôle" : "À surveiller";
  const bestNetMonth = monthly.reduce<(typeof monthly)[number] | null>((best, row) => (!best || row.Net > best.Net ? row : best), null);
  const worstNetMonth = monthly.reduce<(typeof monthly)[number] | null>((worst, row) => (!worst || row.Net < worst.Net ? row : worst), null);
  const averageNet =
    monthly.length > 0 ? monthly.reduce((sum, row) => sum + row.Net, 0) / monthly.length : 0;
  const averageNetExcludingInvestments =
    monthly.length > 0 ? monthly.reduce((sum, row) => sum + (row.Revenus - row.Depenses), 0) / monthly.length : 0;

  return (
    <main className="page-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Pilotage global</p>
          <h1>Dashboard</h1>
          <p>Une lecture simple de ton train de vie, de ta capacité d’investissement, de ta revente et de ton patrimoine.</p>
        </div>
        <div className="hero-actions">
          <YearFilter years={availableYears} selectedYears={selectedYears} onChange={setSelectedYears} />
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      {isMobile ? (
        <section className="panel mobile-note-card">
          <div className="section-title">Mode mobile</div>
          <p className="section-copy">
            Ici tu gardes l’essentiel sous la main. Pour le pilotage complet et les comparaisons fines, la vue desktop reste la plus confortable.
          </p>
        </section>
      ) : null}

      <section className="dashboard-hero-grid">
        <article className="panel dashboard-spotlight">
          <p className="eyebrow">Vue d'ensemble</p>
          <h2>{money(patrimony)}</h2>
          <p>Patrimoine total suivi, stock brocante et revente inclus.</p>
          <div className="dashboard-pill-row">
            <span className="dashboard-pill">{financialHealthState}</span>
            <span className="dashboard-pill">{percent(savingsRate)} de reste libre</span>
          </div>
        </article>

        <article className="panel dashboard-kpi-stack">
          <div className="dashboard-stat-row">
            <span>Cashflow enrichi</span>
            <strong>{money(cashflow)}</strong>
          </div>
          <div className="dashboard-stat-row">
            <span>Reste après allocation</span>
            <strong>{money(freeCash)}</strong>
          </div>
          <div className="dashboard-stat-row">
            <span>P/L latent patrimoine</span>
            <strong>{money(patrimonyPnl)}</strong>
          </div>
          <div className="dashboard-stat-row">
            <span>Bénéfice revente</span>
            <strong>{money(resaleBenefit)}</strong>
          </div>
        </article>
      </section>

      <section className="dashboard-rhythm-grid">
        <article className="panel dashboard-ratio-card">
          <span>Revenus complets</span>
          <strong>{money(incomeTotal)}</strong>
          <small>{money(baseIncome)} saisis + {money(complementaryIncome)} complémentaires</small>
        </article>
        <article className="panel dashboard-ratio-card">
          <span>Dépenses de vie</span>
          <strong>{money(expenses)}</strong>
          <small>{percent(lifestyleRate)} des revenus complets</small>
        </article>
        <article className="panel dashboard-ratio-card">
          <span>Alloué / investi</span>
          <strong>{money(investmentEffort)}</strong>
          <small>{money(allocations)} d'allocations + {money(resalePurchases)} d'achat-revente</small>
        </article>
        <article className="panel dashboard-ratio-card">
          <span>Revenus complémentaires</span>
          <strong>{money(complementaryIncome)}</strong>
          <small>{percent(complementaryIncomeRate)} du total</small>
        </article>
      </section>

      {isMobile ? (
        <>
          <section className="panel table-panel">
            <div className="section-title">Lecture rapide</div>
            <div className="dashboard-reading-list">
              <div className="dashboard-reading-item">
                <span>Patrimoine total</span>
                <strong>{money(patrimony)}</strong>
              </div>
              <div className="dashboard-reading-item">
                <span>Reste après allocation</span>
                <strong>{money(freeCash)}</strong>
              </div>
              <div className="dashboard-reading-item">
                <span>Cashflow enrichi</span>
                <strong>{money(cashflow)}</strong>
              </div>
              <div className="dashboard-reading-item">
                <span>Effort d’investissement</span>
                <strong>{money(investmentEffort)}</strong>
              </div>
              <div className="dashboard-reading-item">
                <span>Stock revente</span>
                <strong>{money(resaleStock)}</strong>
              </div>
            </div>
          </section>

          <section className="panel chart-panel">
            <div className="section-title">Évolution du patrimoine</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={patrimonyTimeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => money(String(value))} />
                <Line type="monotone" dataKey="Patrimoine" stroke="#0f766e" strokeWidth={3} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="Investi" stroke="#17211d" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </>
      ) : (
      <section className="content-grid wide-right">
        <section className="panel chart-panel">
          <div className="section-title">Flux mensuels</div>
          <p className="section-copy">Les revenus restent au-dessus de zéro, les dépenses et investissements passent en négatif, et la ligne te montre le net réel de chaque mois.</p>
          <div className="dashboard-flow-summary">
            <article className="dashboard-flow-stat">
              <span>Meilleur net</span>
              <strong>{bestNetMonth ? money(bestNetMonth.Net) : money(0)}</strong>
              <small>{bestNetMonth ? bestNetMonth.shortLabel : "-"}</small>
            </article>
            <article className="dashboard-flow-stat">
              <span>Pire net</span>
              <strong>{worstNetMonth ? money(worstNetMonth.Net) : money(0)}</strong>
              <small>{worstNetMonth ? worstNetMonth.shortLabel : "-"}</small>
            </article>
            <article className="dashboard-flow-stat">
              <span>Net moyen</span>
              <strong>{money(averageNet)}</strong>
              <small>par mois</small>
            </article>
            <article className="dashboard-flow-stat">
              <span>Net moyen hors investissement</span>
              <strong>{money(averageNetExcludingInvestments)}</strong>
              <small>revenus - dépenses</small>
            </article>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortLabel" minTickGap={24} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <Tooltip
                labelFormatter={(_value, payload) => (payload?.[0]?.payload?.label ? String(payload[0].payload.label) : "")}
                formatter={(value, name) => {
                  const normalized =
                    name === "SortiesVie" || name === "SortiesInvest" ? Math.abs(Number(value)) : Number(value);
                  const labelMap: Record<string, string> = {
                    Revenus: "Revenus",
                    SortiesVie: "Dépenses",
                    SortiesInvest: "Investissements",
                    Net: "Net",
                  };
                  return [money(normalized), labelMap[String(name)] ?? String(name)];
                }}
              />
              <ReferenceLine y={0} stroke="rgba(23, 33, 29, 0.24)" />
              <Bar dataKey="Revenus" fill="#0f766e" radius={[10, 10, 0, 0]} barSize={18} isAnimationActive={false} />
              <Bar dataKey="SortiesVie" fill="#e17c21" radius={[0, 0, 10, 10]} barSize={18} isAnimationActive={false} />
              <Bar dataKey="SortiesInvest" fill="#17211d" radius={[0, 0, 10, 10]} barSize={18} isAnimationActive={false} />
              <Line type="monotone" dataKey="Net" stroke="#4f46e5" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Legend
                verticalAlign="top"
                height={30}
                formatter={(value) =>
                  ({
                    Revenus: "Revenus",
                    SortiesVie: "Dépenses",
                    SortiesInvest: "Investissements",
                    Net: "Net du mois",
                  }[String(value)] ?? String(value))
                }
              />
            </ComposedChart>
          </ResponsiveContainer>
        </section>

        <section className="panel chart-panel">
          <div className="section-title">Répartition patrimoine</div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={patrimonyBlocks}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={110}
                paddingAngle={2}
                label={({ share }) => percent(Number(share ?? 0))}
                labelLine={false}
                isAnimationActive={false}
              >
                {patrimonyBlocks.map((item) => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value, _name, payload) => [`${money(String(value))} · ${percent(Number(payload?.payload?.share ?? 0))}`, payload?.payload?.name ?? ""]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </section>
      )}

      {!isMobile ? (
      <section className="dashboard-three-up">
        <article className="panel dashboard-insight-card">
          <p className="eyebrow">Train de vie</p>
          <h3>{percent(lifestyleRate)}</h3>
          <p>Part de tes revenus complets absorbée par les dépenses de vie.</p>
        </article>
        <article className="panel dashboard-insight-card">
          <p className="eyebrow">Effort d'investissement</p>
          <h3>{percent(allocationRate)}</h3>
          <p>Part envoyée vers les allocations internes et les achats de ton stock achat-revente.</p>
        </article>
        <article className="panel dashboard-insight-card">
          <p className="eyebrow">Stock revente</p>
          <h3>{money(resaleStock)}</h3>
          <p>Valeur estimée encore immobilisée dans le stock achat-revente.</p>
        </article>
      </section>
      ) : null}

      {!isMobile ? (
      <section className="content-grid wide-right">
        <section className="panel table-panel">
          <div className="section-title">Patrimoine par bloc</div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Bloc</th>
                  <th>Valeur</th>
                  <th>Répartition</th>
                </tr>
              </thead>
              <tbody>
                {patrimonyBlocks.map((block) => (
                  <tr key={block.name}>
                    <td>{block.name}</td>
                    <td>{money(block.value)}</td>
                    <td>{percent(block.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel">
          <div className="section-title">Lecture rapide pilotage</div>
          <div className="dashboard-reading-list">
            <div className="dashboard-reading-item">
              <span>Revenus saisis</span>
              <strong>{money(baseIncome)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>Revenus complémentaires</span>
              <strong>{money(complementaryIncome)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>Allocations internes</span>
              <strong>{money(allocations)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>Achats achat-revente</span>
              <strong>{money(resalePurchases)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>CA achat-revente</span>
              <strong>{money(data?.resale_ca_total)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>Capital investi patrimoine</span>
              <strong>{money(data?.patrimony.total_invested)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>P/L latent</span>
              <strong>{money(data?.patrimony.unrealized_pnl)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>Reste libre après allocation</span>
              <strong>{money(freeCash)}</strong>
            </div>
            <div className="dashboard-reading-item">
              <span>Effort d'investissement</span>
              <strong>{money(investmentEffort)}</strong>
            </div>
          </div>
        </section>
      </section>
      ) : null}

      {!isMobile ? (
      <section className="panel chart-panel full-width-section">
        <div className="section-title">Évolution du patrimoine</div>
        <p className="section-copy">Lecture mensuelle du début de ton historique jusqu'à aujourd'hui, avec la valeur totale, le capital encore investi et tout ce que tu as injecté en cumulé.</p>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={patrimonyTimeline}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip formatter={(value) => money(String(value))} />
            <Line type="monotone" dataKey="Patrimoine" stroke="#0f766e" strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Investi" stroke="#17211d" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Investi cumulé" stroke="#b45309" strokeWidth={2} dot={false} strokeDasharray="7 5" isAnimationActive={false} />
            <Legend verticalAlign="top" height={32} />
          </LineChart>
        </ResponsiveContainer>
      </section>
      ) : null}
    </main>
  );
}
