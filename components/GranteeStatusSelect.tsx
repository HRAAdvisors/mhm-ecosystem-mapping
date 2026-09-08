"use client";

import { GRANTEE_STATUS_LABELS } from "@/lib/labels";
import type { GranteeStatus } from "@/lib/types";

export type GranteeStatusFilter = GranteeStatus | "all";

const OPTIONS: { value: GranteeStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "current", label: GRANTEE_STATUS_LABELS.current },
  { value: "past", label: GRANTEE_STATUS_LABELS.past },
  { value: "not", label: GRANTEE_STATUS_LABELS.not },
];

export function GranteeStatusSelect({
  value,
  onChange,
}: {
  value: GranteeStatusFilter;
  onChange: (value: GranteeStatusFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as GranteeStatusFilter)}
      className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
