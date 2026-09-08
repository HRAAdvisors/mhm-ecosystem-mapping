import type { GranteeStatus } from "./types";

export const GRANTEE_STATUS_LABELS: Record<GranteeStatus, string> = {
  current: "Current Grantee",
  past: "Past Grantee",
  not: "Not a Grantee",
};

export function relationshipStrengthLabel(strength: string | null | undefined): string {
  if (strength === "Strong/Active") return "Active";
  if (strength === "Weak/Existing") return "Existing";
  return strength ?? "—";
}
