import "server-only";

import {
  formatPeriodLabel,
  fuzzyKey,
  summarizeRecords,
  type EcosystemKpiTotals,
  type KpiRecord,
  type OrgKpiSummary,
} from "./kpi";

/** Live KPI data comes from an Airtable base fed by a Microsoft Form.
 *  Three linked tables:
 *   - Responses:         one record per org per reporting period (the form dump)
 *   - Organizations:     link target for a Response's org (record id -> name)
 *   - Reporting Periods: link target for a Response's period (record id -> label)
 *
 *  Table IDs (not names) are used so renaming a table in Airtable does not
 *  break the integration. If the base is ever rebuilt from scratch these ids
 *  change and must be updated here. */
const TABLES = {
  responses: "tbldysasYbNNGtxFy",
  organizations: "tbl4AjQmjETJaNvtW",
  periods: "tblm3HiljhxzriHh1",
} as const;

/** All KPI fetches share this cache tag. The Airtable automation webhook hits
 *  /api/airtable/revalidate, which purges this tag so the next visitor gets
 *  fresh numbers. `revalidate` is a safety net if the webhook never fires. */
const KPI_TAG = "kpi";
const KPI_REVALIDATE_SECONDS = 3600;

interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
}

/** Strip invisible characters (Airtable form syncs leave BOMs and trailing
 *  newlines in field names), collapse whitespace, lowercase, and drop a
 *  trailing numeric suffix — Airtable appends 1, 2, 3… to duplicate columns
 *  when a branching form repeats the same question. */
function normalizeFieldName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s*\d+$/, "");
}

/** Find the first field whose normalized name equals or starts with `want`,
 *  and return its raw value. Handles the invisible-character and duplicate
 *  column quirks above. */
function pickField(fields: Record<string, unknown>, want: string): unknown {
  for (const key of Object.keys(fields)) {
    const n = normalizeFieldName(key);
    if (n === want || n.startsWith(want)) return fields[key];
  }
  return undefined;
}

/** True when ANY of the (possibly many duplicate) "skip to the end to save
 *  progress" columns is set — i.e. the respondent bailed out early, so this
 *  is a partial draft that should not count toward the KPIs. */
function isDraftSubmission(fields: Record<string, unknown>): boolean {
  const marker = "would you like to skip to the end to save your current progress and come back later to edit?";
  for (const key of Object.keys(fields)) {
    if (!normalizeFieldName(key).startsWith(normalizeFieldName(marker))) continue;
    const v = fields[key];
    if (v === true) return true;
    if (typeof v === "string" && v.trim().toLowerCase() === "yes") return true;
  }
  return false;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** First linked record id from an Airtable "link to another record" field,
 *  which is always an array of record ids. */
function firstLinkedId(value: unknown): string | null {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

/** Order reporting periods chronologically. Labels look like "H1 2024" /
 *  "H2 2024"; sort by year, then first half before second. Unknown formats
 *  sort last but keep a stable order. */
function periodRank(label: string): number {
  const m = /(H([12]))?\s*(\d{4})/i.exec(label);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const half = m[2] ? Number(m[2]) : 1;
  const year = Number(m[3]);
  return year * 10 + half;
}

async function fetchTable(tableId: string): Promise<AirtableRecord[]> {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    throw new Error("AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set");
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { tags: [KPI_TAG], revalidate: KPI_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      throw new Error(`Airtable ${tableId} request failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { records?: AirtableRecord[]; offset?: string };
    records.push(...(json.records ?? []));
    offset = json.offset;
  } while (offset);

  return records;
}

/** Build a record-id -> primary-value lookup for a link-target table, using
 *  the given normalized field name as the label source. */
function buildIdMap(records: AirtableRecord[], wantField: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) {
    const value = pickField(r.fields, wantField);
    if (typeof value === "string" && value.trim()) map.set(r.id, value.trim());
  }
  return map;
}

/**
 * Fetch KPI data live from Airtable and reshape it into the same
 * fuzzy-key -> summary structure the graph attaches to each node. Cached via
 * the "kpi" fetch tag; the webhook route purges that tag on form submissions.
 *
 * Airtable is the sole source of truth: if the fetch fails, this throws and
 * the caller decides how to degrade (the region page treats it as "no KPI
 * data available" rather than showing stale numbers).
 */
export async function getKpiMap(): Promise<Record<string, OrgKpiSummary>> {
  const [responses, organizations, periods] = await Promise.all([
    fetchTable(TABLES.responses),
    fetchTable(TABLES.organizations),
    fetchTable(TABLES.periods),
  ]);

  const orgNameById = buildIdMap(organizations, "organization name");
  const periodLabelById = buildIdMap(periods, "period label");

  const METRIC_FIELDS = {
    individualsServed: "number of individuals served",
    outreachEvents: "number of community outreach events conducted",
    organizationsEngaged: "number of organizations engaged for digital equity",
    connectorsHired: "number of individuals hired as digital connectors",
    connectorsTrained: "number of individuals trained as digital connectors",
    connectorSessions: "number of sessions conducted by digital connectors",
  } as const;

  // Group KPI records by the fuzzy name key, exactly how the graph looks them up.
  const grouped = new Map<string, KpiRecord[]>();
  const periodsSeen = new Set<string>();

  for (const r of responses) {
    if (isDraftSubmission(r.fields)) continue;

    const orgId = firstLinkedId(pickField(r.fields, "organization name"));
    const orgName = orgId ? orgNameById.get(orgId) : null;
    if (!orgName) continue;

    const periodId = firstLinkedId(pickField(r.fields, "reporting period"));
    const periodLabel = periodId ? periodLabelById.get(periodId) : null;
    if (!periodLabel) continue;
    periodsSeen.add(periodLabel);

    const record: KpiRecord = {
      period: periodLabel,
      submittedAt: r.createdTime,
      individualsServed: toNumber(pickField(r.fields, METRIC_FIELDS.individualsServed)),
      outreachEvents: toNumber(pickField(r.fields, METRIC_FIELDS.outreachEvents)),
      organizationsEngaged: toNumber(pickField(r.fields, METRIC_FIELDS.organizationsEngaged)),
      connectorsHired: toNumber(pickField(r.fields, METRIC_FIELDS.connectorsHired)),
      connectorsTrained: toNumber(pickField(r.fields, METRIC_FIELDS.connectorsTrained)),
      connectorSessions: toNumber(pickField(r.fields, METRIC_FIELDS.connectorSessions)),
    };

    const key = fuzzyKey(orgName);
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  const periodOrder = [...periodsSeen].sort((a, b) => periodRank(a) - periodRank(b));

  const map: Record<string, OrgKpiSummary> = {};
  for (const [key, records] of grouped) {
    map[key] = summarizeRecords(records, periodOrder);
  }
  return map;
}

/**
 * Aggregate the live KPI data across every organization into ecosystem-wide
 * per-period totals for the Data page. Uses the same deduplicated per-org
 * summaries as the node panels (repeat submissions of a period do not
 * double-count), then sums each metric by period.
 *
 * Only the metrics the form actually captures are returned. Funding,
 * demographics, device distribution, and the collaboration network are not in
 * Airtable and remain static on the Data page.
 */
export async function getEcosystemKpiTotals(): Promise<EcosystemKpiTotals> {
  const map = await getKpiMap();

  type MetricKey = "served" | "outreach" | "partners";
  type Bucket = Record<MetricKey, number | null>;
  const byPeriod = new Map<string, Bucket>();
  const add = (current: number | null, value: number | null) =>
    value == null ? current : (current ?? 0) + value;
  for (const summary of Object.values(map)) {
    for (const rec of summary.records) {
      const bucket = byPeriod.get(rec.period) ?? { served: null, outreach: null, partners: null };
      bucket.served = add(bucket.served, rec.individualsServed);
      bucket.outreach = add(bucket.outreach, rec.outreachEvents);
      bucket.partners = add(bucket.partners, rec.organizationsEngaged);
      byPeriod.set(rec.period, bucket);
    }
  }

  // A period where no submission answered a question (for example, the
  // 2025 Year End form dropped the "individuals served" total) is listed as
  // missing instead of being drawn as a misleading zero bar.
  const orderedPeriods = [...byPeriod.keys()].sort((a, b) => periodRank(a) - periodRank(b));
  const buildSeries = (key: MetricKey) => {
    const timeline: { period: string; count: number }[] = [];
    const missingPeriods: string[] = [];
    for (const period of orderedPeriods) {
      const label = formatPeriodLabel(period);
      const count = byPeriod.get(period)![key];
      if (count == null) missingPeriods.push(label);
      else timeline.push({ period: label, count });
    }
    return { timeline, missingPeriods, total: timeline.reduce((sum, point) => sum + point.count, 0) };
  };

  return {
    individualsServed: buildSeries("served"),
    outreachEvents: buildSeries("outreach"),
    partnerOrganizations: buildSeries("partners"),
  };
}
