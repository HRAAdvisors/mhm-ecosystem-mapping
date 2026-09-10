"use client";

export function OrganizationSelect({
  organizations,
  value,
  onSelect,
}: {
  organizations: string[];
  /** Currently selected org, if any — kept in sync with the graph's own
   *  selection (see NetworkGraph's onSelectionChange) so this reflects
   *  clicks on the graph too, not just picks made through this control. */
  value: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <select
      value={value && organizations.includes(value) ? value : ""}
      onChange={(e) => {
        const next = e.target.value;
        if (next) onSelect(next);
      }}
      aria-label="Find an organization"
      className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="" disabled>
        Select an organization…
      </option>
      {organizations.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
