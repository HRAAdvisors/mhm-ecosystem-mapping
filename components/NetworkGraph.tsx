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

interface HoverState {
  name: string;
  x: number;
  y: number;
}

const WIDTH = 960;
const HEIGHT = 680;
const VIEW_PADDING = 48;
const MIN_RADIUS = 10;
const MAX_FONT = 9;
const MIN_FONT = 5.5;

interface FittedLabel {
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

function wrapLabel(text: string, maxCharsPerLine: number): string[] {
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

/** Fits a node's name inside its own (fixed, connectivity-driven) radius by
 *  shrinking the font and wrapping — never by growing the circle, since size
 *  should keep tracking connection count only. Falls back to the smallest
 *  font with a truncated 3-line wrap if nothing fits (a long name on a tiny,
 *  low-degree node), rather than shrinking to illegibility. */
function fitLabelToRadius(text: string, r: number): FittedLabel {
  for (let fontSize = MAX_FONT; fontSize >= MIN_FONT; fontSize -= 0.5) {
    const avgCharWidth = fontSize * 0.56;
    const lineHeight = fontSize * 1.15;
    const maxCharsPerLine = Math.max(4, Math.floor((r * 2 * 0.82) / avgCharWidth));
    const lines = wrapLabel(text, maxCharsPerLine);
    const longest = Math.max(...lines.map((l) => l.length));
    const halfW = (longest * avgCharWidth) / 2;
    const halfH = (lines.length * lineHeight) / 2;
    const needed = Math.sqrt(halfW ** 2 + halfH ** 2) / 0.82;
    if (needed <= r) return { lines, fontSize, lineHeight };
  }
  const fontSize = MIN_FONT;
  const avgCharWidth = fontSize * 0.56;
  const lineHeight = fontSize * 1.15;
  const maxCharsPerLine = Math.max(4, Math.floor((r * 2 * 1.3) / avgCharWidth));
  let lines = wrapLabel(text, maxCharsPerLine);
  if (lines.length > 3) {
    lines = [...lines.slice(0, 2), `${lines[2].slice(0, maxCharsPerLine - 1)}…`];
  }
  return { lines, fontSize, lineHeight };
}

function linkEndpointId(end: string | number | SimNode): string {
  return typeof end === "object" ? end.id : String(end);
}

export function NetworkGraph({
  graph,
  focusNodeId,
}: {
  graph: Graph;
  /** Set (to an org name present in `graph`) to programmatically zoom to and
   *  select that node, e.g. from an "Organizations" search control. */
  focusNodeId?: string | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const focusNodeRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    if (!svgRef.current) return;

    const degree = new Map<string, number>();
    for (const link of graph.links) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }

    // Node size reflects connectivity alone: a hub with more documented
    // relationships reads as bigger/more important.
    const radius = (id: string) => MIN_RADIUS + Math.min(degree.get(id) ?? 0, 12) * 2.6;

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
          .distance((d) => radius(linkEndpointId(d.source)) + radius(linkEndpointId(d.target)) + 46)
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
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke-dasharray", (d) => dashForRelationshipType(d.relationshipType) ?? null)
      .attr("stroke-linecap", "round");

    const neighborsOf = new Map<string, Set<string>>();
    for (const l of links) {
      const a = linkEndpointId(l.source);
      const b = linkEndpointId(l.target);
      (neighborsOf.get(a) ?? neighborsOf.set(a, new Set()).get(a)!).add(b);
      (neighborsOf.get(b) ?? neighborsOf.set(b, new Set()).get(b)!).add(a);
    }

    // Selecting a node (by click, or programmatically via focusNodeId) bolds
    // every edge touching it and fades the rest, and reveals the titles of
    // that node and its neighbors (titles otherwise stay hidden — hover's
    // small tooltip below is how a name shows up before then). Clicking
    // empty canvas or pressing Escape clears all of that without resetting
    // the current zoom/pan.
    let selectedNodeId: string | null = null;
    function isTouching(d: SimLink, id: string) {
      return linkEndpointId(d.source) === id || linkEndpointId(d.target) === id;
    }
    function applyHighlight() {
      link
        .attr("stroke", (d) =>
          selectedNodeId && isTouching(d, selectedNodeId) ? "var(--foreground)" : "var(--muted-foreground)",
        )
        .attr("stroke-width", (d) => {
          const base = styleForRelationshipStrength(d.relationshipStrength).width;
          return selectedNodeId && isTouching(d, selectedNodeId) ? base + 2 : base;
        })
        .attr("stroke-opacity", (d) => {
          if (!selectedNodeId) return styleForRelationshipStrength(d.relationshipStrength).opacity;
          return isTouching(d, selectedNodeId) ? 1 : 0.08;
        });
      const visible = selectedNodeId
        ? new Set([selectedNodeId, ...(neighborsOf.get(selectedNodeId) ?? [])])
        : null;
      label.style("opacity", (d) => (visible && visible.has(d.id) ? 1 : 0));
    }

    function selectNode(d: SimNode) {
      selectedNodeId = d.id;
      applyHighlight();
      setSelectedNode(d);
      const targetScale = 2.2;
      const transform = d3.zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(targetScale)
        .translate(-d.x, -d.y);
      svg.transition().duration(500).call(zoomBehavior.transform, transform);
    }
    function clearSelection() {
      selectedNodeId = null;
      applyHighlight();
      setSelectedNode(null);
    }
    focusNodeRef.current = (id: string) => {
      const target = nodes.find((n) => n.id === id);
      if (target) selectNode(target);
    };

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
      .on("click", (event, d) => selectNode(d))
      .on("mouseenter", function (event, d) {
        const [x, y] = d3.pointer(event, svgRef.current?.parentElement);
        setHover({ name: d.id, x, y });
      })
      .on("mousemove", function (event) {
        const [x, y] = d3.pointer(event, svgRef.current?.parentElement);
        setHover((prev) => (prev ? { ...prev, x, y } : prev));
      })
      .on("mouseleave", function () {
        setHover(null);
      });

    // Clicking empty canvas (not a node) clears the selection/highlight and
    // closes the organization panel; Escape does the same from anywhere.
    svg.on("click", (event) => {
      if (event.target !== svgRef.current) return;
      clearSelection();
    });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") clearSelection();
    }
    window.addEventListener("keydown", onKeyDown);

    // Hidden by default (see applyHighlight above) — a title only shows once
    // its node is selected or is a neighbor of the selection; before that,
    // hovering a node's own small tooltip is how its name is surfaced.
    const label = root
      .append("g")
      .attr("pointer-events", "none")
      .selectAll<SVGTextElement, SimNode>("text")
      .data(nodes)
      .join("text")
      .style("opacity", 0)
      .attr("font-family", "var(--font-sans)")
      .attr("font-weight", 600)
      .attr("fill", (d) => textColorForFill(colorForCategory(d.category)))
      .attr("text-anchor", "middle")
      .each(function (d) {
        const fit = fitLabelToRadius(d.id, radius(d.id));
        const el = d3.select(this).attr("font-size", fit.fontSize);
        const startDy = -((fit.lines.length - 1) / 2) * fit.lineHeight;
        fit.lines.forEach((line, i) => {
          el.append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? startDy : fit.lineHeight)
            .text(line);
        });
      });

    applyHighlight(); // establish the baseline (unselected) link + label styling

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
      link.attr("d", (d) => {
        const source = d.source as SimNode;
        const target = d.target as SimNode;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.hypot(dx, dy) || 1;
        // A gentle arc rather than a straight segment: bow the midpoint out
        // perpendicular to the line by ~15% of its length, so crossing/
        // overlapping edges between the same cluster of nodes stay visually
        // distinguishable instead of stacking into one straight line.
        const bow = dist * 0.15;
        const mx = (source.x + target.x) / 2 - (dy / dist) * bow;
        const my = (source.y + target.y) / 2 + (dx / dist) * bow;
        return `M${source.x},${source.y} Q${mx},${my} ${target.x},${target.y}`;
      });

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
      svg.on("click", null);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [graph]);

  // Runs after the effect above, in the same commit, whenever a caller (e.g.
  // an "Organizations" search control) asks to focus a specific org — by
  // then focusNodeRef.current is already bound to this graph's own nodes.
  useEffect(() => {
    if (focusNodeId) focusNodeRef.current(focusNodeId);
  }, [focusNodeId]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-card">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" />
      {hover && <NameTooltip x={hover.x} y={hover.y} name={hover.name} />}
      {selectedNode && <OrganizationPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
    </div>
  );
}

function NameTooltip({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: x, top: y, transform: "translate(-50%, calc(-100% - 10px))" }}
    >
      <div className="relative whitespace-nowrap rounded-md bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-foreground/10">
        {name}
        <div
          className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
          style={{
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid var(--popover)",
          }}
        />
      </div>
    </div>
  );
}

function OrganizationPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  return (
    <div className="absolute top-3 right-3 bottom-3 z-10 w-64 overflow-y-auto rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10 sm:w-72">
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
        <Row label="Category" value={node.category} />
        <Row label="Grantee Status" value={GRANTEE_STATUS_LABELS[node.granteeStatus]} />
        <Row label="Primary Service Area" value={node.serviceArea} />
      </dl>
      {node.connections.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1 font-medium text-foreground">Connections in this region</div>
          <ul className="space-y-1">
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
