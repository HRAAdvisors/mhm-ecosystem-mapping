"use client";

import { FilterLegend, type LegendMode } from "@/components/FilterLegend";
import { Legend } from "@/components/Legend";
import { NetworkGraph } from "@/components/NetworkGraph";
import { OrganizationSelect } from "@/components/OrganizationSelect";
import { RegionSelect } from "@/components/RegionSelect";
import { buildGraph, CATEGORIES, REGIONS } from "@/lib/data";
import type { GranteeStatus } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const ALL_GRANTEE_STATUSES: GranteeStatus[] = ["current", "past", "not"];

export function NetworkExplorer({ initialRegion }: { initialRegion: string }) {
  const router = useRouter();
  const [regionCode, setRegionCode] = useState(initialRegion);
  const [legendMode, setLegendMode] = useState<LegendMode>("category");
  const [selectedCategories, setSelectedCategories] = useState(() => new Set(CATEGORIES));
  const [selectedGranteeStatuses, setSelectedGranteeStatuses] = useState(() => new Set(ALL_GRANTEE_STATUSES));
  const [focusOrgId, setFocusOrgId] = useState<string | null>(null);
  // Mirrors whatever's currently selected on the graph — set both when the
  // "Organizations" dropdown itself picks something, and by the graph
  // whenever selection changes some other way (a node click, Escape, or
  // clicking empty canvas) — so the dropdown's displayed value stays honest.
  const [selectedOrgName, setSelectedOrgName] = useState<string | null>(null);
  // Collapsed by default on mobile, where the panel would otherwise push the
  // graph below the fold; irrelevant on desktop, which always shows it (the
  // aside below ignores this state at the md breakpoint and up).
  const [panelOpen, setPanelOpen] = useState(false);

  const graph = useMemo(() => buildGraph(regionCode), [regionCode]);
  const activeRegion = REGIONS.find((r) => r.code === regionCode);
  const organizationNames = useMemo(
    () => graph.nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b)),
    [graph],
  );

  function handleRegionChange(code: string) {
    setRegionCode(code);
    setFocusOrgId(null);
    setSelectedOrgName(null);
    router.replace(`/regions/${code}`);
  }

  // "Find an organization" should surface it regardless of the current
  // filters, so jumping to it also resets them to show everything.
  function handleOrganizationSelect(name: string) {
    setSelectedCategories(new Set(CATEGORIES));
    setSelectedGranteeStatuses(new Set(ALL_GRANTEE_STATUSES));
    setFocusOrgId(name);
    setSelectedOrgName(name);
  }

  const filteredGraph = useMemo(() => {
    const nodes = graph.nodes.filter(
      (n) => selectedCategories.has(n.category) && selectedGranteeStatuses.has(n.granteeStatus),
    );
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));
    return { nodes, links };
  }, [graph, selectedCategories, selectedGranteeStatuses]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {activeRegion?.label}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          {filteredGraph.nodes.length} organizations serving residents
        </p>
      </div>

      <button
        type="button"
        onClick={() => setPanelOpen((open) => !open)}
        aria-expanded={panelOpen}
        className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 text-sm font-medium text-foreground md:hidden"
      >
        Filters &amp; Legend
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${panelOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          className={`${panelOpen ? "flex" : "hidden"} max-h-[60vh] shrink-0 flex-col overflow-y-auto border-b border-border bg-secondary/40 md:flex md:h-full md:max-h-none md:w-72 md:overflow-y-auto md:border-b-0 md:border-r lg:w-80 xl:w-[26rem]`}
        >
          <div className="flex flex-col gap-5 px-4 py-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Region
              </h3>
              <RegionSelect regions={REGIONS} value={regionCode} onChange={handleRegionChange} />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Organizations
              </h3>
              <OrganizationSelect
                organizations={organizationNames}
                value={selectedOrgName}
                onSelect={handleOrganizationSelect}
              />
            </div>

            <div className="border-t border-border pt-4">
              <FilterLegend
                mode={legendMode}
                onModeChange={setLegendMode}
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
                selectedGranteeStatuses={selectedGranteeStatuses}
                onGranteeStatusesChange={setSelectedGranteeStatuses}
              />
            </div>

            <div className="border-t border-border pt-4">
              <Legend />
            </div>
          </div>
        </aside>

        <div className="relative min-h-0 flex-1 p-4 sm:p-6">
          <NetworkGraph
            graph={filteredGraph}
            focusNodeId={focusOrgId}
            onSelectionChange={setSelectedOrgName}
            colorMode={legendMode}
          />
        </div>
      </div>
    </div>
  );
}
