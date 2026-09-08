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
  category: string;
  isGrantee: boolean;
  granteeStatus: GranteeStatus;
  locationStatus: "primary" | "secondary";
  fundingAmount: string | null;
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
