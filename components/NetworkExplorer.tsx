"use client";

import { FilterLegend, type LegendMode } from "@/components/FilterLegend";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { Legend } from "@/components/Legend";
import {
  NetworkGraph,
  SIZE_MODE_OPTIONS,
  type ConnectivityFilter,
  type SizeMode,
} from "@/components/NetworkGraph";
import { OrganizationSelect } from "@/components/OrganizationSelect";
import { RegionSelect } from "@/components/RegionSelect";
import { buildGraph, CATEGORIES, REGIONS } from "@/lib/data";
import { fuzzyKey, type OrgKpiSummary } from "@/lib/kpi";
import type { GranteeStatus } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const ALL_GRANTEE_STATUSES: GranteeStatus[] = ["current", "past", "not"];

const TOUR_DISMISS_KEY = "mhm-ecosystem-tour-dismissed";
const TOUR_SESSION_KEY = "mhm-ecosystem-tour-seen-session";

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to the Ecosystem Map",
    body: "This map shows how MHM's Digital Equity grantees and their partner organizations connect across a region. Take a 30-second tour, or skip it anytime. You can reopen it later from the “How to use” button.",
  },
  {
    target: '[data-tour="region"]',
    title: "1. Pick a region",
    body: "Each region has its own network. Choose one here and the whole map redraws to show the organizations serving that area.",
  },
  {
    target: '[data-tour="organizations"]',
    title: "2. Find a specific organization",
    body: "Know who you're looking for? Select them here to jump straight to their circle on the map, highlight it, and open their details.",
  },
  {
    target: '[data-tour="filters"]',
    title: "3. Color and filter the map",
    body: "Switch the coloring between Service Type (what an organization does) and Grantee Status (their funding relationship with MHM). Click any item in the list to show or hide those organizations.",
  },
  {
    target: '[data-tour="size-mode"]',
    title: "4. Size the circles",
    body: "Choose what a circle's size represents: number of Connections, Grant size (dollars awarded), or People served. It's a quick way to spot the biggest players by each measure.",
  },
  {
    target: '[data-tour="legend"]',
    title: "5. Read the map's key",
    body: "Lines show relationships: a solid line is a grantee collaboration and a dashed line is funding. Thicker, darker lines are active relationships; thin ones are existing. A ringed circle is an MHM grantee, and a filled circle is a partner organization.",
  },
  {
    target: '[data-tour="connectivity"]',
    title: "6. Connected or all organizations",
    body: "Switch between every organization in the region and only those with a relationship here. “Connected only” hides organizations that aren't linked to anyone in the region, so you can focus on the active network — and see at a glance who stands apart.",
  },
  {
    target: '[data-tour="graph"]',
    title: "7. Explore the network",
    body: "Every circle is an organization. Click one to focus it and bold its connections. Drag circles to rearrange them, and scroll to zoom in and out.",
  },
  {
    target: '[data-tour="panel"]',
    openPanel: true,
    title: "8. Read an organization's full profile",
    body: "When a circle is selected, this panel shows its service type, grantee status, funding, primary service area, live KPI reporting pulled from grantee submissions, and every connection it has in this region.",
  },
  {
    title: "You're all set",
    body: "That's everything. Pick a region, explore the circles, and open any organization to dig into its details. Happy exploring!",
  },
];

export function NetworkExplorer({
  initialRegion,
  initialOrg = null,
  kpiMap,
}: {
  initialRegion: string;
  /** Org to focus on load, e.g. when arriving from the global search
   *  (`/regions/{code}?org=…`). Reset filters and select it so its data opens
   *  immediately. */
  initialOrg?: string | null;
  kpiMap: Record<string, OrgKpiSummary>;
}) {
  const router = useRouter();
  const [regionCode, setRegionCode] = useState(initialRegion);
  const [legendMode, setLegendMode] = useState<LegendMode>("granteeStatus");
  const [selectedCategories, setSelectedCategories] = useState(() => new Set(CATEGORIES));
  const [selectedGranteeStatuses, setSelectedGranteeStatuses] = useState(() => new Set(ALL_GRANTEE_STATUSES));
  const [sizeMode, setSizeMode] = useState<SizeMode>("connections");
  // Whether the map shows every org in the region or only those with at least
  // one relationship here. This is how connected vs. unconnected orgs are
  // visualized — "connected" simply hides the isolated ones.
  const [connectivity, setConnectivity] = useState<ConnectivityFilter>("all");
  const [focusOrgId, setFocusOrgId] = useState<string | null>(initialOrg);
  // Mirrors whatever's currently selected on the graph — set both when the
  // "Organizations" dropdown itself picks something, and by the graph
  // whenever selection changes some other way (a node click, Escape, or
  // clicking empty canvas) — so the dropdown's displayed value stays honest.
  const [selectedOrgName, setSelectedOrgName] = useState<string | null>(initialOrg);
  // Collapsed by default on mobile, where the panel would otherwise push the
  // graph below the fold; irrelevant on desktop, which always shows it (the
  // aside below ignores this state at the md breakpoint and up).
  const [panelOpen, setPanelOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Auto-open the guided tour on first visit only. Guards: a permanent
  // localStorage opt-out ("don't show again"), a per-session flag so it
  // doesn't reopen when this component remounts on a region change, and a
  // desktop check since the tour points at the always-visible sidebar
  // controls (collapsed behind a toggle on mobile).
  useEffect(() => {
    let dismissed = false;
    let seenThisSession = false;
    try {
      dismissed = window.localStorage.getItem(TOUR_DISMISS_KEY) === "1";
      seenThisSession = window.sessionStorage.getItem(TOUR_SESSION_KEY) === "1";
    } catch {
      // Storage unavailable — treat as first visit; tour is harmless.
    }
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (dismissed || seenThisSession || !isDesktop) return;

    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(TOUR_SESSION_KEY, "1");
      } catch {
        // ignore
      }
      setTourOpen(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, []);

  // buildGraph is pure structure (client-safe). Live KPIs come from Airtable
  // via the server (kpiMap prop) and are attached here by the same fuzzy name
  // key the KPI source used, so a form submission flows through to the panel.
  const graph = useMemo(() => {
    const built = buildGraph(regionCode);
    return {
      ...built,
      nodes: built.nodes.map((n) => ({ ...n, kpi: kpiMap[fuzzyKey(n.id)] ?? null })),
    };
  }, [regionCode, kpiMap]);
  const activeRegion = REGIONS.find((r) => r.code === regionCode);
  const organizationNames = useMemo(
    () => graph.nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b)),
    [graph],
  );

  // A representative node for the tour's "read the panel" step: prefer one
  // with live KPI data (richest panel), then any grantee, then anything.
  const exampleOrg = useMemo(() => {
    const withKpi = graph.nodes.find((n) => n.kpi);
    if (withKpi) return withKpi.id;
    const grantee = graph.nodes.find((n) => n.isGrantee);
    if (grantee) return grantee.id;
    return graph.nodes[0]?.id ?? null;
  }, [graph]);

  // Drive host state as the tour advances: the panel step needs a selected
  // node so the detail panel exists for the tour to spotlight.
  const handleTourStep = useCallback(
    (i: number) => {
      if (TOUR_STEPS[i]?.openPanel && exampleOrg) {
        setFocusOrgId(exampleOrg);
        setSelectedOrgName(exampleOrg);
      }
    },
    [exampleOrg],
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
    setConnectivity("all");
    setFocusOrgId(name);
    setSelectedOrgName(name);
  }

  // When the ?org= param changes on an already-mounted explorer (arriving from
  // the global search while a region page is open), focus the new org too.
  useEffect(() => {
    if (!initialOrg) return;
    setSelectedCategories(new Set(CATEGORIES));
    setSelectedGranteeStatuses(new Set(ALL_GRANTEE_STATUSES));
    setConnectivity("all");
    setFocusOrgId(initialOrg);
    setSelectedOrgName(initialOrg);
  }, [initialOrg]);

  // Every org that has at least one relationship in this region, computed from
  // the full region graph (not the category-filtered subset) so "connected"
  // means the same thing regardless of which service types are toggled on.
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of graph.links) {
      ids.add(l.source);
      ids.add(l.target);
    }
    return ids;
  }, [graph]);

  const filteredGraph = useMemo(() => {
    const nodes = graph.nodes.filter(
      (n) =>
        selectedCategories.has(n.category) &&
        selectedGranteeStatuses.has(n.granteeStatus) &&
        (connectivity === "all" || connectedIds.has(n.id)),
    );
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));
    return { nodes, links };
  }, [graph, selectedCategories, selectedGranteeStatuses, connectivity, connectedIds]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {activeRegion?.label}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {filteredGraph.nodes.length} organizations serving residents
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTourOpen(true)}
          className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:text-sm"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="7.5" />
            <path d="M7.75 7.75a2.25 2.25 0 1 1 3.2 2.04c-.62.3-.95.78-.95 1.46v.25" />
            <path d="M10 14.75h.01" />
          </svg>
          How to use
        </button>
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
            <div data-tour="region">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Region
              </h3>
              <RegionSelect regions={REGIONS} value={regionCode} onChange={handleRegionChange} />
            </div>

            <div data-tour="organizations">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Organizations
              </h3>
              <OrganizationSelect
                organizations={organizationNames}
                value={selectedOrgName}
                onSelect={handleOrganizationSelect}
              />
            </div>

            <div className="border-t border-dashed border-border pt-4" data-tour="filters">
              <FilterLegend
                mode={legendMode}
                onModeChange={setLegendMode}
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
                selectedGranteeStatuses={selectedGranteeStatuses}
                onGranteeStatusesChange={setSelectedGranteeStatuses}
              />
            </div>

            <div className="border-t border-dashed border-border pt-4" data-tour="size-mode">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Size circles by
              </h3>
              <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5 text-xs">
                {SIZE_MODE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSizeMode(o.value)}
                    aria-pressed={sizeMode === o.value}
                    className={`flex-1 rounded-md px-2 py-1 text-center font-medium transition-colors ${
                      sizeMode === o.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-dashed border-border pt-4" data-tour="legend">
              <Legend />
            </div>
          </div>
        </aside>

        <div className="relative min-h-0 flex-1 p-4 sm:p-6" data-tour="graph">
          <NetworkGraph
            graph={filteredGraph}
            focusNodeId={focusOrgId}
            onSelectionChange={setSelectedOrgName}
            colorMode={legendMode}
            sizeMode={sizeMode}
            connectivity={connectivity}
            onConnectivityChange={setConnectivity}
          />
        </div>
      </div>

      <GuidedTour
        open={tourOpen}
        steps={TOUR_STEPS}
        storageKey={TOUR_DISMISS_KEY}
        onClose={() => setTourOpen(false)}
        onStepChange={handleTourStep}
      />
    </div>
  );
}
