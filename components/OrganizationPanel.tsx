import { GRANTEE_STATUS_LABELS, relationshipStrengthLabel } from "@/lib/labels";
import { formatPeriodLabel, type OrgKpiSummary } from "@/lib/kpi";
import type { GraphNode } from "@/lib/types";

/** The org detail panel shown on both the network graph (as an overlay) and
 *  the Data page's relationships table (as a fixed-position side panel) —
 *  same content, different positioning, so `className` controls placement. */
export function OrganizationPanel({
  node,
  onClose,
  onSelectConnection,
  className = "absolute top-3 right-3 bottom-3 w-64 sm:w-72",
}: {
  node: GraphNode;
  onClose: () => void;
  onSelectConnection: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      data-tour="panel"
      className={`z-10 overflow-y-auto rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">{node.id}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <dl className="mt-2 space-y-1">
        <Row label="Organization Service Type" value={node.category} />
        <Row label="Service Subsector" value={node.subsector} />
        <Row label="Grantee Status" value={GRANTEE_STATUS_LABELS[node.granteeStatus]} />
        {node.otherMhmGrantee !== null && (
          <Row label="Other MHM Grantee Status" value={node.otherMhmGrantee ? "Grantee" : "Not a Grantee"} />
        )}
        {node.fundingAmount && <Row label="Grantee Funding" value={node.fundingAmount} />}
        {node.fundingYear && <Row label="Funding Year" value={node.fundingYear} />}
        {node.fundingSourceLabel && <Row label="Funding Source" value={node.fundingSourceLabel} />}
        <Row label="Primary Service Area" value={node.serviceArea} />
      </dl>
      {node.kpi && <KpiSection kpi={node.kpi} />}
      {node.connections.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1 font-medium text-foreground">Connections in this region</div>
          <ul className="space-y-1">
            {node.connections.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelectConnection(c.other)}
                  className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                        c.direction === "outgoing"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {c.direction === "outgoing" ? "As grantee" : "As partner"}
                    </span>
                    <span className="truncate">{c.other}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">
                    {relationshipStrengthLabel(c.relationshipStrength)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** MHM's KPI reports (Mid-Year/Year-End surveys collected from grantees) are
 *  each their own reporting window, not a running cumulative total, so
 *  "lifetime" here means summed across every report on file for this org,
 *  and the table below shows what each individual report captured. */
function KpiSection({ kpi }: { kpi: OrgKpiSummary }) {
  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="mb-1 font-medium text-foreground">KPI Reporting</div>
      <dl className="space-y-1">
        <Row label="Individuals Served (lifetime)" value={kpi.totalIndividualsServed.toLocaleString()} />
        {kpi.latestPeriod && (
          <Row
            label={`Latest Reported (${formatPeriodLabel(kpi.latestPeriod)})`}
            value={(kpi.latestIndividualsServed ?? 0).toLocaleString()}
          />
        )}
      </dl>
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full text-[10px] leading-normal">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pb-0.5 text-left font-medium">Period</th>
              <th className="pb-0.5 text-right font-medium">Served</th>
              <th className="pb-0.5 text-right font-medium">Outreach</th>
              <th className="pb-0.5 text-right font-medium">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {kpi.records.map((r) => (
              <tr key={r.period} className="border-t border-border/60">
                <td className="py-0.5 text-foreground">{formatPeriodLabel(r.period)}</td>
                <td className="py-0.5 text-right text-foreground">{r.individualsServed ?? "—"}</td>
                <td className="py-0.5 text-right text-foreground">{r.outreachEvents ?? "—"}</td>
                <td className="py-0.5 text-right text-foreground">{r.connectorSessions ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
