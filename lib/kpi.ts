import kpiRaw from "@/data/mhm-kpi.json";

export interface KpiRecord {
  period: string;
  individualsServed: number | null;
  outreachEvents: number | null;
  organizationsEngaged: number | null;
  connectorsHired: number | null;
  connectorsTrained: number | null;
  connectorSessions: number | null;
}

interface KpiDataset {
  periods: string[];
  orgs: Record<string, KpiRecord[]>;
}

const dataset = kpiRaw as KpiDataset;

/** Same collapse-spelling-variants approach as lib/data.ts's canonical name
 *  map, applied here to match a KPI report's "Organization Name" (which may
 *  drift slightly release to release, e.g. "Community Tech Network, Inc."
 *  vs "Community Tech Network, Inc. (digitalLift)") to a graph node's id. */
function fuzzyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const byFuzzyKey = new Map<string, KpiRecord[]>();
for (const [org, records] of Object.entries(dataset.orgs)) {
  const key = fuzzyKey(org);
  byFuzzyKey.set(key, [...(byFuzzyKey.get(key) ?? []), ...records]);
}

const PERIOD_ORDER = dataset.periods;

export interface OrgKpiSummary {
  /** One row per KPI report the org appears in, oldest first. */
  records: KpiRecord[];
  /** Simple sum of "Number of individuals served" across every report on
   *  file for this org. Each report period is its own reporting window (not
   *  a running cumulative total), so this is a lifetime total across the
   *  reports MHM has collected so far. */
  totalIndividualsServed: number;
  latestIndividualsServed: number | null;
  latestPeriod: string | null;
}

export function getKpiForOrg(name: string): OrgKpiSummary | null {
  const records = byFuzzyKey.get(fuzzyKey(name));
  if (!records || records.length === 0) return null;

  const sorted = [...records].sort(
    (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period),
  );
  const totalIndividualsServed = sorted.reduce((sum, r) => sum + (r.individualsServed ?? 0), 0);
  const withServed = sorted.filter((r) => r.individualsServed != null);
  const latest = withServed[withServed.length - 1] ?? null;

  return {
    records: sorted,
    totalIndividualsServed,
    latestIndividualsServed: latest?.individualsServed ?? null,
    latestPeriod: latest?.period ?? null,
  };
}
