"use client";

import { colorForCategory, dashForRelationshipType, styleForRelationshipStrength, textColorForFill } from "@/lib/colors";
import { GRANTEE_STATUS_LABELS, relationshipStrengthLabel } from "@/lib/labels";
import type { Graph, GraphNode } from "@/lib/types";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationshipType: string | null;
  relationshipStrength: string | null;
}

interface TooltipState {
  node: GraphNode;
  x: number;
  y: number;
}

interface FittedLabel {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  radius: number;
}

const WIDTH = 960;
const HEIGHT = 680;
const VIEW_PADDING = 48;
const MIN_RADIUS = 24;
const MAX_RADIUS = 60;
const MAX_FONT = 8.5;
const MIN_FONT = 6.5;

function greedyWrap(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Wraps a node's org name to fit inside its own circle, growing the circle
 *  (up to MAX_RADIUS) for longer names and shrinking the font (down to
 *  MIN_FONT) only once growing the circle stops being enough. */
function fitLabel(text: string, baseRadius: number): FittedLabel {
  for (let fontSize = MAX_FONT; fontSize >= MIN_FONT; fontSize -= 0.5) {
    const avgCharWidth = fontSize * 0.56;
    const lineHeight = fontSize * 1.15;
    // Try every radius from the node's natural (degree-based) size up to the cap.
    for (let r = baseRadius; r <= MAX_RADIUS; r += 2) {
      const maxCharsPerLine = Math.max(4, Math.floor((r * 2 * 0.82) / avgCharWidth));
      const lines = greedyWrap(text, maxCharsPerLine);
      const longest = Math.max(...lines.map((l) => l.length));
      const halfW = (longest * avgCharWidth) / 2;
      const halfH = (lines.length * lineHeight) / 2;
      const needed = Math.sqrt(halfW ** 2 + halfH ** 2) / 0.82;
      if (needed <= r) {
        return { lines, fontSize, lineHeight, radius: Math.max(r, MIN_RADIUS) };
      }
    }
  }
  // Fallback: smallest font, biggest circle, truncate to 4 lines.
  const fontSize = MIN_FONT;
  const avgCharWidth = fontSize * 0.56;
  const lineHeight = fontSize * 1.15;
  const maxCharsPerLine = Math.max(4, Math.floor((MAX_RADIUS * 2 * 0.82) / avgCharWidth));
  let lines = greedyWrap(text, maxCharsPerLine);
  if (lines.length > 4) {
    lines = [...lines.slice(0, 3), `${lines[3].slice(0, maxCharsPerLine - 1)}…`];
  }
  return { lines, fontSize, lineHeight, radius: MAX_RADIUS };
}

export function NetworkGraph({ graph }: { graph: Graph }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const degree = new Map<string, number>();
    for (const link of graph.links) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }

    // Node size is driven by BOTH how connected a node is (hubs read as more
    // important) and how much text its name needs — labels live inside the
    // circle now, so the circle has to be big enough to hold them.
    const baseRadius = (id: string) => 20 + Math.min(degree.get(id) ?? 0, 10) * 2.4;
    const labels = new Map<string, FittedLabel>();
    for (const n of graph.nodes) {
      labels.set(n.id, fitLabel(n.id, baseRadius(n.id)));
    }
    const radius = (id: string) => labels.get(id)?.radius ?? MIN_RADIUS;

    // Seed positions on a sunflower-seed spiral rather than jittering everyone
    // into the same tiny box at the center. Starting a big region's ~180
    // nodes on top of each other means forceManyBody's repulsion has to
    // violently blast them apart in the first few ticks just to reach a
    // normal starting spread — the graph visibly explodes before it can
    // settle. Spreading the start position out (further for later nodes)
    // gives the simulation a reasonable layout to refine instead of escape.
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    const spiralSpacing = 3.4;
    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const spiralRadius = spiralSpacing * Math.sqrt(i + 0.5);
      const angle = i * GOLDEN_ANGLE;
      return {
        ...n,
        x: WIDTH / 2 + spiralRadius * Math.cos(angle),
        y: HEIGHT / 2 + spiralRadius * Math.sin(angle),
      };
    });

    const links: SimLink[] = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      relationshipType: l.relationshipType,
      relationshipStrength: l.relationshipStrength,
    }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = svg.append("g");

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => root.attr("transform", event.transform.toString()));
    svg.call(zoomBehavior);

    // Tighter than the general-purpose default: pull connected nodes in close
    // and rely on collision + a link distance keyed to actual node size to
    // keep the whole graph legible without panning; fit-to-view below then
    // snaps the camera in.
    //
    // Key Regional Player nodes have no links at all, so they feel no pull
    // toward the cluster from forceLink. Without a distanceMax, forceManyBody's
    // repulsion has unlimited range, so those unlinked nodes get pushed
    // arbitrarily far away with nothing to stop them — which then blows up the
    // fit-to-view bounding box and shrinks the real (connected) cluster to a
    // speck. forceX/forceY give every node a weak pull back toward the center,
    // and distanceMax caps how far repulsion reaches, so isolated nodes settle
    // in a loose ring around the cluster instead of flying off-canvas.
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => radius((d.source as SimNode).id ?? (d.source as unknown as string)) + radius((d.target as SimNode).id ?? (d.target as unknown as string)) + 46)
          .strength(0.55),
      )
      .force("charge", d3.forceManyBody().strength(-280).distanceMax(400))
      .force("x", d3.forceX(WIDTH / 2).strength(0.04))
      .force("y", d3.forceY(HEIGHT / 2).strength(0.04))
      .force(
        "collide",
        d3.forceCollide<SimNode>((d) => radius(d.id) + 14),
      )
      // Heavy damping (default 0.4) so nodes settle instead of oscillating/
      // overshooting on every tick, a faster decay (default ~0.0228) so it
      // reaches a calm rest sooner, and a reduced starting alpha (default 1)
      // since the spiral seeding above already gives the sim a reasonable
      // layout to refine rather than one it needs a lot of energy to escape.
      .velocityDecay(0.72)
      .alphaDecay(0.05)
      .alpha(0.6);

    const link = root
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "var(--muted-foreground)")
      .attr("stroke-width", (d) => styleForRelationshipStrength(d.relationshipStrength).width)
      .attr("stroke-opacity", (d) => styleForRelationshipStrength(d.relationshipStrength).opacity)
      .attr("stroke-dasharray", (d) => dashForRelationshipType(d.relationshipType) ?? null)
      .attr("stroke-linecap", "round");

    const node = root
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => radius(d.id))
      .attr("fill", (d) => colorForCategory(d.category))
      .attr("stroke", "var(--foreground)")
      .attr("stroke-width", (d) => (d.isGrantee ? 2.5 : 1.2))
      .attr("stroke-dasharray", (d) => (d.locationStatus === "secondary" ? "3,3" : null))
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          // A real drag has to move the pointer at least this many pixels;
          // anything less still counts as a plain click, so click-to-zoom
          // below fires reliably even with a slightly unsteady click.
          .clickDistance(6)
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (event, d) => {
        const targetScale = 2.2;
        const transform = d3.zoomIdentity
          .translate(WIDTH / 2, HEIGHT / 2)
          .scale(targetScale)
          .translate(-d.x, -d.y);
        svg.transition().duration(500).call(zoomBehavior.transform, transform);
      })
      .on("mouseenter", function (event, d) {
        const [x, y] = d3.pointer(event, svgRef.current?.parentElement);
        setTooltip({ node: d, x, y });
      })
      .on("mousemove", function (event) {
        const [x, y] = d3.pointer(event, svgRef.current?.parentElement);
        setTooltip((prev) => (prev ? { ...prev, x, y } : prev));
      })
      .on("mouseleave", function () {
        setTooltip(null);
      });

    const label = root
      .append("g")
      .attr("pointer-events", "none")
      .selectAll<SVGTextElement, SimNode>("text")
      .data(nodes)
      .join("text")
      .attr("font-family", "var(--font-sans)")
      .attr("font-weight", 600)
      .attr("fill", (d) => textColorForFill(colorForCategory(d.category)))
      .attr("text-anchor", "middle")
      .each(function (d) {
        const fit = labels.get(d.id);
        if (!fit) return;
        const el = d3.select(this).attr("font-size", fit.fontSize);
        const startDy = -((fit.lines.length - 1) / 2) * fit.lineHeight;
        fit.lines.forEach((line, i) => {
          el.append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? startDy : fit.lineHeight)
            .text(line);
        });
      });

    let settled = false;
    function fitToView() {
      if (settled || nodes.length === 0) return;
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
      const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
      const spanX = Math.max(maxX - minX, 1);
      const spanY = Math.max(maxY - minY, 1);
      // Prefer fitting everything in view, but don't shrink nodes into
      // illegibility to force a big graph to fit — below this floor it's
      // fine (better, even) to leave the rest reachable by panning/zooming
      // rather than cramming it all in.
      const fitScale = Math.min((WIDTH - VIEW_PADDING * 2) / spanX, (HEIGHT - VIEW_PADDING * 2) / spanY);
      const scale = Math.min(1.3, Math.max(0.6, fitScale));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(scale)
        .translate(-cx, -cy);
      svg.transition().duration(400).call(zoomBehavior.transform, transform);
      settled = true;
    }

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x)
        .attr("y1", (d) => (d.source as SimNode).y)
        .attr("x2", (d) => (d.target as SimNode).x)
        .attr("y2", (d) => (d.target as SimNode).y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    simulation.on("end", fitToView);

    return () => {
      simulation.stop();
      // Effects can run twice in a row in dev (React Strict Mode mounts,
      // cleans up, and remounts once to surface missing cleanup). Without
      // this, the first pass's zoom behavior stays bound to the <svg> —
      // selectAll("*").remove() only clears descendants, not listeners on
      // the root element itself — so the remount's zoom behavior stacks on
      // top of it instead of replacing it.
      svg.on(".zoom", null);
    };
  }, [graph]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" />
      {tooltip && <Tooltip state={tooltip} />}
    </div>
  );
}

function Tooltip({ state }: { state: TooltipState }) {
  const { node, x, y } = state;
  return (
    <div
      className="pointer-events-none absolute z-10 w-72 rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      style={{ left: x + 16, top: y + 16 }}
    >
      <div className="mb-1 text-sm font-semibold text-foreground">{node.id}</div>
      <dl className="space-y-1">
        <Row label="Category" value={node.category} />
        <Row label="Grantee Status" value={GRANTEE_STATUS_LABELS[node.granteeStatus]} />
        <Row label="Primary Service Area" value={node.serviceArea} />
      </dl>
      {node.connections.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1 font-medium text-foreground">Connections in this region</div>
          <ul className="max-h-32 space-y-1 overflow-y-auto">
            {node.connections.map((c, i) => (
              <li key={i} className="text-muted-foreground">
                {c.direction === "outgoing" ? "→ " : "← "}
                {c.other}
                <span className="text-muted-foreground/70"> ({relationshipStrengthLabel(c.relationshipStrength)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
