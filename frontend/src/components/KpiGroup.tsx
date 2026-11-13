import type { ReactNode } from "react";

export function KpiGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="kpi-group">
    <header><h2>{title}</h2>{description && <p>{description}</p>}</header>
    <div className="kpi-group-values">{children}</div>
  </section>;
}
