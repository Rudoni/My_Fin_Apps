import { CalendarDays } from "lucide-react";

type YearFilterProps = {
  years: number[];
  selectedYears: number[];
  onChange: (years: number[]) => void;
};

export function YearFilter({ years, selectedYears, onChange }: YearFilterProps) {
  function toggleYear(year: number) {
    if (selectedYears.includes(year)) {
      onChange(selectedYears.filter((selectedYear) => selectedYear !== year));
      return;
    }
    onChange([...selectedYears, year].sort((a, b) => b - a));
  }

  return (
    <details className="year-filter">
      <summary>
        <CalendarDays size={18} />
        {selectedYears.length === 1 ? selectedYears[0] : selectedYears.length ? selectedYears.join(", ") : "Toutes les années"}
      </summary>
      <div className="year-filter-panel">
        <button className="ghost-button" type="button" onClick={() => onChange([])}>Tout voir</button>
        <button className="ghost-button" type="button" onClick={() => onChange([new Date().getFullYear()])}>Cette année</button>
        <div className="year-options">
          {years.map((year) => (
            <button
              className={selectedYears.includes(year) ? "year-chip active" : "year-chip"}
              key={year}
              type="button"
              aria-pressed={selectedYears.includes(year)}
              onClick={() => toggleYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
