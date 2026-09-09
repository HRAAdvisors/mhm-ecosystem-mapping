"use client";

import { useState } from "react";

const LIST_ID = "organizations-datalist";

/** A find-as-you-type control (native input + datalist) rather than a single
 *  giant <select> — a region can have 180+ organizations, too many to
 *  usefully scroll through, but still fine for the browser's own
 *  type-ahead filtering. */
export function OrganizationSelect({
  organizations,
  onSelect,
}: {
  organizations: string[];
  onSelect: (name: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <>
      <input
        list={LIST_ID}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (organizations.includes(next)) {
            onSelect(next);
            setValue("");
          }
        }}
        placeholder="Find an organization…"
        aria-label="Find an organization"
        className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <datalist id={LIST_ID}>
        {organizations.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
