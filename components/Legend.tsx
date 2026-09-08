export function Legend() {
  return (
    <div className="flex flex-col gap-5 text-xs">
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relationship Type
        </h3>
        <LegendLine dash={null} label="Grantee Collaboration" />
        <LegendLine dash="6,4" label="Funding Relationship" />
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relationship Strength
        </h3>
        <LegendLine dash={null} width={2.4} opacity={0.85} label="Strong / Active" />
        <LegendLine dash={null} width={1} opacity={0.45} label="Weak / Existing" />
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Primary Service Location
        </h3>
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-foreground/70" />
          <span className="text-foreground/80">Primary location</span>
        </div>
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed border-foreground/70" />
          <span className="text-foreground/80">Secondary location</span>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Node Border Weight
        </h3>
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full border-[2.5px] border-foreground/70" />
          <span className="text-foreground/80">MHM grantee</span>
        </div>
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full border border-foreground/70" />
          <span className="text-foreground/80">Partner organization</span>
        </div>
      </div>
    </div>
  );
}

function LegendLine({
  dash,
  label,
  width = 1.6,
  opacity = 0.85,
}: {
  dash: string | null;
  label: string;
  width?: number;
  opacity?: number;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <svg width="28" height="10" className="shrink-0">
        <line
          x1="0"
          y1="5"
          x2="28"
          y2="5"
          stroke="var(--muted-foreground)"
          strokeWidth={width}
          strokeOpacity={opacity}
          strokeDasharray={dash ?? undefined}
        />
      </svg>
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}
