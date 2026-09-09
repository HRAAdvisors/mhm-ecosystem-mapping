"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HeroRegionPicker({
  regions,
}: {
  regions: { code: string; label: string; orgCount: number }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(regions[0]?.code ?? "");

  return (
    <form
      className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) router.push(`/regions/${selected}`);
      }}
    >
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Choose a region"
        className="h-11 w-full rounded-full border-0 bg-white px-5 text-sm font-medium text-[var(--raisin)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto sm:min-w-64"
      >
        {regions.map((region) => (
          <option key={region.code} value={region.code}>
            {region.label} — {region.orgCount} organization{region.orgCount === 1 ? "" : "s"}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-11 w-full shrink-0 rounded-full bg-[var(--cobalt)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
      >
        Explore region
      </button>
    </form>
  );
}
