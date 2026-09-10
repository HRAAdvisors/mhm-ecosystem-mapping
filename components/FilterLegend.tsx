"use client";

import { CATEGORY_COLORS, colorForCategory, colorForGranteeStatus } from "@/lib/colors";
import { GRANTEE_STATUS_LABELS } from "@/lib/labels";
import type { GranteeStatus } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_COLORS);
const GRANTEE_STATUSES: GranteeStatus[] = ["current", "past", "not"];

export type LegendMode = "category" | "granteeStatus";

/** Doubles as legend and filter, same as the old category-only version, but
 *  toggles between two color schemes: Organization Service Type (5 colors)
 *  and Grantee Status (three shades of blue). Whichever isn't showing keeps
 *  its own selection untouched, so switching back and forth doesn't lose
 *  either filter. */
export function FilterLegend({
  mode,
  onModeChange,
  selectedCategories,
  onCategoriesChange,
  selectedGranteeStatuses,
  onGranteeStatusesChange,
}: {
  mode: LegendMode;
  onModeChange: (mode: LegendMode) => void;
  selectedCategories: Set<string>;
  onCategoriesChange: (next: Set<string>) => void;
  selectedGranteeStatuses: Set<GranteeStatus>;
  onGranteeStatusesChange: (next: Set<GranteeStatus>) => void;
}) {
  const isCategory = mode === "category";
  const items: { key: string; label: string; color: string }[] = isCategory
    ? CATEGORIES.map((c) => ({ key: c, label: c, color: colorForCategory(c) }))
    : GRANTEE_STATUSES.map((s) => ({ key: s, label: GRANTEE_STATUS_LABELS[s], color: colorForGranteeStatus(s) }));
  const selected: Set<string> = isCategory ? selectedCategories : selectedGranteeStatuses;
  const allOn = items.every((i) => selected.has(i.key));

  function commit(next: Set<string>) {
    if (isCategory) onCategoriesChange(next);
    else onGranteeStatusesChange(next as Set<GranteeStatus>);
  }

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1 rounded-lg bg-secondary/60 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => onModeChange("category")}
          aria-pressed={isCategory}
          className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
            isCategory ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Service Type
        </button>
        <button
          type="button"
          onClick={() => onModeChange("granteeStatus")}
          aria-pressed={!isCategory}
          className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
            !isCategory ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Grantee Status
        </button>
      </div>

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isCategory ? "Organization Service Type" : "Grantee Status"}
        </h3>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => commit(allOn ? new Set() : new Set(items.map((i) => i.key)))}
        >
          {allOn ? "Clear" : "Select all"}
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map(({ key, label, color }) => {
          const active = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(key)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-accent"
            >
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-foreground/20 transition-opacity"
                style={{ backgroundColor: color, opacity: active ? 1 : 0.25 }}
              />
              <span className={active ? "text-foreground/80" : "text-muted-foreground/50"}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
