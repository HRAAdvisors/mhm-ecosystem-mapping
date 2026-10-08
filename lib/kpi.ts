export interface KpiRecord {
  period: string;
  individualsServed: number | null;
  outreachEvents: number | null;
  organizationsEngaged: number | null;
  connectorsHired: number | null;
  connectorsTrained: number | null;
  connectorSessions: number | null;
  /** Airtable record creation time (ISO). Used to pick the most recent
   *  submission when the same org+period is reported more than once. */
  submittedAt?: string;
}

export interface KpiDataset {
  periods: string[];
  orgs: Record<string, KpiRecord[]>;
}

/** Collapse spelling/punctuation variants so a KPI report's organization
 *  name (which drifts between the Airtable form and the network tracker,
 *  e.g. "Community Tech Network, Inc. (digitalLift)" vs "Community Tech
 *  Network (CTN)") maps onto the same graph node id. Parentheticals, "&",
 *  and — importantly — trailing corporate suffixes like ", Inc." are
 *  dropped, because the two data sources disagree on whether to include
 *  them. This runs on both the graph side (node.id) and the KPI side
 *  (Airtable org name), so both must live in this shared, client-safe
 *  module. */
export function fuzzyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|llc|ltd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Turn an internal Airtable period label into the display wording the team
 *  uses. Airtable stores "H1 2024" / "H2 2024" (kept as-is for sorting and
 *  grouping); the UI shows "2024 Mid Year" / "2024 Year End". Anything that
 *  doesn't match the H1/H2 pattern is shown unchanged. */
export function formatPeriodLabel(label: string): string {
  const m = /^\s*H([12])\s+(\d{4})\s*$/i.exec(label);
  if (!m) return label;
  const half = m[1];
  const year = m[2];
  return `${year} ${half === "1" ? "Mid Year" : "Year End"}`;
}

/** One metric aggregated across every org, per reporting period, for the
 *  ecosystem-wide Data page. `period` labels are already display-formatted. */
export interface EcosystemMetricSeries {
  timeline: { period: string; count: number }[];
  /** Periods with submissions where nobody answered this question. */
  missingPeriods: string[];
  total: number;
}

/** The subset of Data-page metrics that can be computed live from Airtable
 *  responses. Everything else on that page (funding, demographics, devices,
 *  collaboration network) is not captured in the form and stays static. */
export interface EcosystemKpiTotals {
  individualsServed: EcosystemMetricSeries;
  outreachEvents: EcosystemMetricSeries;
  partnerOrganizations: EcosystemMetricSeries;
}

export interface OrgKpiSummary {
  /** One row per reporting period, oldest first. Multiple submissions for the
   *  same period are collapsed into a single row (most recent wins). */
  records: KpiRecord[];
  /** Sum of "Number of individuals served" across each distinct reporting
   *  period on file for this org. Each period is its own reporting window
   *  (not a running cumulative total), so this is a lifetime total. Repeat
   *  submissions of the same period are NOT double-counted. */
  totalIndividualsServed: number;
  latestIndividualsServed: number | null;
  latestPeriod: string | null;
}

const METRIC_KEYS = [
  "individualsServed",
  "outreachEvents",
  "organizationsEngaged",
  "connectorsHired",
  "connectorsTrained",
  "connectorSessions",
] as const satisfies readonly (keyof KpiRecord)[];

/** Collapse every submission for a single reporting period into one record.
 *  Submissions are applied oldest-first so the most recent non-null value
 *  wins for each metric — a re-submission corrects/updates that period rather
 *  than stacking on top of earlier ones. */
function mergePeriod(records: KpiRecord[]): KpiRecord {
  const ordered = [...records].sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const merged: KpiRecord = { ...ordered[0] };
  for (const rec of ordered) {
    for (const key of METRIC_KEYS) {
      const value = rec[key];
      if (value != null) merged[key] = value;
    }
    if (rec.submittedAt) merged.submittedAt = rec.submittedAt;
  }
  return merged;
}

/** Pure reducer over an org's KPI reports. `periodOrder` is the ordered list
 *  of period labels (oldest first) so "latest" and the table sort are
 *  deterministic regardless of the order records arrive from the source.
 *  Records sharing a period are merged into one before totals are computed. */
export function summarizeRecords(records: KpiRecord[], periodOrder: string[]): OrgKpiSummary {
  const rank = (p: string) => {
    const i = periodOrder.indexOf(p);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const byPeriod = new Map<string, KpiRecord[]>();
  for (const rec of records) {
    byPeriod.set(rec.period, [...(byPeriod.get(rec.period) ?? []), rec]);
  }

  const sorted = [...byPeriod.values()]
    .map(mergePeriod)
    .sort((a, b) => rank(a.period) - rank(b.period));

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
