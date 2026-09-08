"use client";

import { CATEGORY_COLORS, colorForCategory } from "@/lib/colors";

const CATEGORIES = Object.keys(CATEGORY_COLORS);

/** Doubles as the category legend and the category filter: every row is
 *  clickable, dimming out (rather than disappearing) when toggled off so it
 *  still reads as "this color means this category" even while inactive. */
export function CategoryLegend({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const allOn = CATEGORIES.every((c) => selected.has(c));

  function toggle(category: string) {
    const next = new Set(selected);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Primary Service Category
        </h3>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => onChange(allOn ? new Set() : new Set(CATEGORIES))}
        >
          {allOn ? "Clear" : "Select all"}
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        {CATEGORIES.map((category) => {
          const active = selected.has(category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(category)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-accent"
            >
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-foreground/20 transition-opacity"
                style={{ backgroundColor: colorForCategory(category), opacity: active ? 1 : 0.25 }}
              />
              <span className={active ? "text-foreground/80" : "text-muted-foreground/50"}>{category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
