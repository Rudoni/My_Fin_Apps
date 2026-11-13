type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <section className="metric-card">
      <span>{label}</span>
      <strong className="sensitive-value">{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </section>
  );
}
