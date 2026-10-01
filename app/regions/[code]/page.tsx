import { NetworkExplorer } from "@/components/NetworkExplorer";
import { REGIONS } from "@/lib/data";
import { getKpiMap } from "@/lib/kpi-source";
import type { OrgKpiSummary } from "@/lib/kpi";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return REGIONS.map((region) => ({ code: region.code }));
}

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ org?: string; view?: string }>;
}) {
  const { code } = await params;
  const { org, view } = await searchParams;
  const region = REGIONS.find((r) => r.code === code.toUpperCase());
  if (!region) notFound();

  // Airtable is the source of truth for KPIs. If it's unreachable we render
  // the explorer with no KPI data rather than stale numbers; every other part
  // of the page (the network structure) is static and unaffected.
  let kpiMap: Record<string, OrgKpiSummary> = {};
  try {
    kpiMap = await getKpiMap();
  } catch (error) {
    console.error("[v0] Failed to load KPIs from Airtable:", error);
  }

  return (
    <NetworkExplorer
      key={region.code}
      initialRegion={region.code}
      initialOrg={org ?? null}
      initialView={view === "all" ? "all" : "connected"}
      kpiMap={kpiMap}
    />
  );
}
