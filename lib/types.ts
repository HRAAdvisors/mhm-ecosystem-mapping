import type { OrgKpiSummary } from "./kpi";

export type TrackerSection = "relationship" | "key_regional_player";

export interface TrackerRow {
  grantee: string | null;
  organization: string;
  isGrantee: "Yes" | "No" | string | null;
  confirmationStatus: string | null;
  relationshipType: "Grantee Collaboration" | "Funding Relationship" | string | null;
  relationshipTypeRationale: string | null;
  relationshipStrength: "Strong/Active" | "Weak/Existing" | string | null;
  relationshipStrengthRationale: string | null;
  region: string | null;
  additionalRegions: string | null;
  regionSourceJustification: string | null;
  primaryServiceCategory: string | null;
  categoryConfidence: string | null;
  categoryJustification: string | null;
  granteeFundingAmount: string | null;
  fundingSource: string | null;
  evidenceQuote: string | null;
  sourceDocuments: string | null;
  locationCited: string | null;
  newVsExisting: string | null;
  notesFlags: string | null;
  activeGrant2026: string | null;
  section: TrackerSection;
  sourceRow: number;
  regionCode: string | null;
  additionalRegionCodes: string[];
}

export interface RegionMeta {
  code: string;
  label: string;
}

export interface TrackerDataset {
  generatedAt: string | null;
  sourceSheet: string;
  regions: RegionMeta[];
  categories: string[];
  rows: TrackerRow[];
}

export type GranteeStatus = "current" | "past" | "not";

export interface GraphNode {
  id: string;
  /** Organization Service Type: 5 broad groupings used for node color and
   *  the category filter/legend. */
  category: string;
  /** Service Subsector: the tracker's original, more granular "Primary
   *  Service Category" column, shown alongside the broader category above. */
  subsector: string;
  isGrantee: boolean;
  granteeStatus: GranteeStatus;
  locationStatus: "primary" | "secondary";
  /** A county if the tracker cites one, otherwise the current region's label. */
  serviceArea: string;
  fundingAmount: string | null;
  /** Year(s) the funding figure covers, e.g. "2025" or "2021, 2023, 2024",
   *  pulled from the tracker's funding-source citation. */
  fundingYear: string | null;
  /** Plain-language description of what the funding figure represents
   *  (e.g. "MHM Digital Equity Program" vs. an all-MHM-programs total). */
  fundingSourceLabel: string | null;
  activeGrant: string | null;
  primaryRegionCodes: string[];
  secondaryRegionCodes: string[];
  section: TrackerSection;
  connections: {
    other: string;
    direction: "outgoing" | "incoming";
    relationshipType: string | null;
    relationshipStrength: string | null;
  }[];
  notes: string | null;
  /** KPI report history for this org (across all MHM KPI reports on file),
   *  matched by name; null if it's never appeared in one. */
  kpi: OrgKpiSummary | null;
  // populated by the simulation at runtime
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  relationshipType: string | null;
  relationshipStrength: string | null;
  row: TrackerRow;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}
