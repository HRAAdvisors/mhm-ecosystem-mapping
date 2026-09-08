"use client";

import type { RegionMeta } from "@/lib/types";

export function RegionSelect({
  regions,
  value,
  onChange,
}: {
  regions: RegionMeta[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {regions.map((r) => (
        <option key={r.code} value={r.code}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
