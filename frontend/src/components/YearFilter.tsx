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
        {selectedYears.length ? `${selectedYears.length} année${selectedYears.length > 1 ? "s" : ""}` : "Toutes les années"}
      </summary>
      <div className="year-filter-panel">
        <button className="ghost-button" type="button" onClick={() => onChange([])}>Tout voir</button>
        <div className="year-options">
          {years.map((year) => (
            <button
              className={selectedYears.includes(year) ? "year-chip active" : "year-chip"}
              key={year}
              type="button"
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
