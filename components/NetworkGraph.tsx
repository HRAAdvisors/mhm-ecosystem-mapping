"use client";

import {
  colorForCategory,
  colorForGranteeStatus,
  dashForRelationshipType,
  GRANTEE_LINK_WIDTH,
  opacityForRelationshipStrength,
} from "@/lib/colors";
import { GRANTEE_STATUS_LABELS, LOCATION_STATUS_LABELS, relationshipStrengthLabel } from "@/lib/labels";
import type { OrgKpiSummary } from "@/lib/kpi";
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
// Labels sit below/above their node rather than inside it, so wrapping/
// font-fit is keyed to a fixed notional half-width rather than each node's
// own (often much smaller) radius. Generous enough that most org names wrap
// to at most two lines instead of one word per line.
const LABEL_FIT_RADIUS = 85;
const LABEL_GAP = 4;

export type SizeMode = "connections" | "grant" | "served";

const SIZE_MODE_OPTIONS: { value: SizeMode; label: string }[] = [
  { value: "connections", label: "Connections" },
  { value: "grant", label: "Grant size" },
  { value: "served", label: "People served" },
];

// Used for "grant"/"served" sizing when a node has no grant amount or no KPI
// data to size by — a fixed, medium circle rather than shrinking to nothing.
const STANDARD_RADIUS = 16;
// Wider floor-to-ceiling spread than the "connections" mode's radius range,
// so a grant/served value near the bottom of the pack reads as visibly
// smaller than one near the top, not just a few pixels off.
const SIZE_MODE_MIN_RADIUS = 3;
const MAX_RADIUS = 58;

function parseFundingAmount(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
  onSelectionChange,
  colorMode = "category",
}: {
  graph: Graph;
  /** Set (to an org name present in `graph`) to programmatically zoom to and
   *  select that node, e.g. from an "Organizations" search control. */
  focusNodeId?: string | null;
  /** Fires whenever the current selection changes — by node click, the
   *  focusNodeId prop, or clearing (background click/Escape), with the
   *  selected org's id or null. Lets a caller (e.g. the "Organizations"
   *  dropdown) keep its own display in sync with the graph's selection. */
  onSelectionChange?: (id: string | null) => void;
  /** Which legend/filter dimension currently drives node (and label) fill
   *  color — mirrors whichever side of the sidebar's Service Type/Grantee
   *  Status toggle is active, so the graph's colors match what the legend
   *  is showing. */
  colorMode?: "category" | "granteeStatus";
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sizeMode, setSizeMode] = useState<SizeMode>("connections");
  const focusNodeRef = useRef<(id: string) => void>(() => {});
  // Mirrors `selectedNode`'s id so the effect below can restore the
  // selection (bolded connections, revealed labels) after a rebuild
  // triggered by toggling sizeMode/colorMode — without depending on
  // selectedNode itself, which would make every click rebuild the whole
  // graph.
  const selectedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const degree = new Map<string, number>();
    for (const link of graph.links) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    // A plain sqrt scale (area-true) reads as too subtle here — the whole
    // point of these two modes is to make the spread between orgs obvious,
    // so a shallower exponent (more like linear) exaggerates the difference
    // between a small and a large value, over a wider radius range too.
    const fundingValues = graph.nodes
      .map((n) => parseFundingAmount(n.fundingAmount))
      .filter((v): v is number => v != null);
    const fundingScale = d3
      .scalePow()
      .exponent(0.65)
      .domain([0, Math.max(...fundingValues, 1)])
      .range([SIZE_MODE_MIN_RADIUS, MAX_RADIUS]);

    const servedValues = graph.nodes
      .map((n) => n.kpi?.latestIndividualsServed ?? n.kpi?.totalIndividualsServed ?? null)
      .filter((v): v is number => v != null);
    const servedScale = d3
      .scalePow()
      .exponent(0.65)
      .domain([0, Math.max(...servedValues, 1)])
      .range([SIZE_MODE_MIN_RADIUS, MAX_RADIUS]);

    // Node size follows whichever basis the "size by" toggle selects. A
    // node missing the relevant data (no grant, or never appears in a KPI
    // report) gets a fixed standard size rather than shrinking away.
    function radius(id: string): number {
      if (sizeMode === "connections") return MIN_RADIUS + Math.min(degree.get(id) ?? 0, 12) * 2.6;
      const n = nodeById.get(id);
      if (sizeMode === "grant") {
        const amount = n ? parseFundingAmount(n.fundingAmount) : null;
        return amount != null ? fundingScale(amount) : STANDARD_RADIUS;
      }
      const served = n ? (n.kpi?.latestIndividualsServed ?? n.kpi?.totalIndividualsServed ?? null) : null;
      return served != null ? servedScale(served) : STANDARD_RADIUS;
    }

    // Node/label fill follows whichever legend dimension is active in the
    // sidebar — Organization Service Type's 5 colors, or Grantee Status's
    // three shades of blue.
    function fillColor(d: SimNode): string {
      return colorMode === "granteeStatus" ? colorForGranteeStatus(d.granteeStatus) : colorForCategory(d.category);
    }

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

    const granteeStatusOf = new Map(nodes.map((n) => [n.id, n.granteeStatus]));
    function linkWidth(d: SimLink): number {
      const isCurrentGrantee = granteeStatusOf.get(linkEndpointId(d.source)) === "current";
      return isCurrentGrantee ? GRANTEE_LINK_WIDTH.current : GRANTEE_LINK_WIDTH.other;
    }

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
    // Restores whatever was selected before this rebuild (e.g. toggling
    // sizeMode/colorMode) rather than always starting cleared — as long as
    // that node still exists in this graph.
    let selectedNodeId: string | null = selectedNodeIdRef.current;
    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) {
      selectedNodeId = null;
      selectedNodeIdRef.current = null;
    }
    function isTouching(d: SimLink, id: string) {
      return linkEndpointId(d.source) === id || linkEndpointId(d.target) === id;
    }
    function applyHighlight() {
      link
        .attr("stroke", (d) => (selectedNodeId && isTouching(d, selectedNodeId) ? "#000000" : "var(--muted-foreground)"))
        .attr("stroke-width", linkWidth)
        .attr("stroke-opacity", (d) => {
          if (!selectedNodeId) return opacityForRelationshipStrength(d.relationshipStrength);
          return isTouching(d, selectedNodeId) ? 1 : 0.08;
        });
      // With nothing selected, every grantee's name is eligible to show (a
      // standing view of who the current/past grantees are). Once something
      // is selected, that changes to just the selected node and its direct
      // connections — grantee or not — so the focus narrows to that org's
      // neighborhood. Either way, a dense cluster can still have more
      // eligible labels than fit without overlapping, so pickNonOverlapping
      // below drops the lowest-priority ones (the selected node itself
      // always wins; after that, higher-degree hubs win) rather than
      // painting an unreadable pile of overlapping text.
      const eligible = !selectedNodeId
        ? nodes.filter((n) => n.isGrantee).map((n) => n.id)
        : [selectedNodeId, ...(neighborsOf.get(selectedNodeId) ?? [])];
      const priority = [...eligible].sort((a, b) => {
        if (a === selectedNodeId) return -1;
        if (b === selectedNodeId) return 1;
        return (degree.get(b) ?? 0) - (degree.get(a) ?? 0);
      });
      const shown = pickNonOverlapping(priority);
      labelGroup.style("opacity", (d) => (shown.has(d.id) ? 1 : 0));
    }

    // Greedily accepts labels in priority order, skipping any whose box (in
    // current, post-settle node coordinates) overlaps one already accepted
    // — so a crowded hub's labels don't render as an illegible pile-up.
    function pickNonOverlapping(idsInPriorityOrder: string[]): Set<string> {
      const accepted: { x0: number; x1: number; y0: number; y1: number }[] = [];
      const shown = new Set<string>();
      for (const id of idsInPriorityOrder) {
        const n = nodes.find((nn) => nn.id === id);
        const box = labelBoxes.get(id);
        if (!n || !box) continue;
        const x0 = n.x - box.width / 2;
        const x1 = n.x + box.width / 2;
        const y0 = n.y + box.top;
        const y1 = y0 + box.height;
        const overlapsAccepted = accepted.some((b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0);
        if (overlapsAccepted) continue;
        accepted.push({ x0, x1, y0, y1 });
        shown.add(id);
      }
      return shown;
    }

    function selectNode(d: SimNode) {
      selectedNodeId = d.id;
      selectedNodeIdRef.current = d.id;
      applyHighlight();
      setSelectedNode(d);
      onSelectionChange?.(d.id);
      const targetScale = 2.2;
      const transform = d3.zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(targetScale)
        .translate(-d.x, -d.y);
      svg.transition().duration(500).call(zoomBehavior.transform, transform);
    }
    function clearSelection() {
      selectedNodeId = null;
      selectedNodeIdRef.current = null;
      applyHighlight();
      setSelectedNode(null);
      onSelectionChange?.(null);
      svg.transition().duration(500).call(zoomBehavior.transform, computeFitTransform());
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
      .attr("fill", fillColor)
      .attr("stroke", "var(--foreground)")
      .attr("stroke-width", (d) => (d.isGrantee ? 2.5 : 0.75))
      .attr("stroke-opacity", (d) => (d.isGrantee ? 1 : 0.4))
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          // A real drag has to move the pointer at least this many pixels;
          // anything less still counts as a plain click, so click-to-zoom
          // below fires reliably even with a slightly unsteady click.
          .clickDistance(6)
          // d3-drag's "start"/"end" fire on every pointerdown/up regardless
          // of clickDistance — only "drag" itself is gated on real movement,
          // so the simulation restart (and node pin) is deferred to the
          // first actual "drag" event instead of "start"; that way a plain
          // click never nudges the layout. `event.active` is NOT useful as
          // an "is this the first drag event" guard here — it reflects
          // concurrent gesture count and is already 1 for a normal single
          // drag by the time "drag" fires, so checking `!event.active`
          // there is always false and the simulation was never actually
          // restarted (the node's fx/fy kept updating, but with the sim not
          // ticking, nothing redrew it — dragging looked "stuck" the moment
          // the initial settle finished and ticking stopped). `d.fx == null`
          // is the right one-time gate instead.
          .on("drag", (event, d) => {
            if (d.fx == null && d.fy == null) simulation.alphaTarget(0.3).restart();
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (d.fx != null || d.fy != null) simulation.alphaTarget(0);
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

    // Hidden by default — see applyHighlight above for exactly when a
    // label is visible. Text is colored to match the node's category fill
    // with a white halo (a text outline, via paint-order) so it reads
    // cleanly over the graph. Grantee names render bold.
    const labelGroup = root
      .append("g")
      .attr("pointer-events", "none")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .style("opacity", 0);

    labelGroup.each(function () {
      d3.select(this)
        .append("text")
        .attr("class", "label-text")
        .attr("font-family", "var(--font-sans)")
        .attr("text-anchor", "middle")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 3)
        .attr("stroke-linejoin", "round")
        .style("paint-order", "stroke fill");
    });

    // Picks whichever side (above/below the node) currently has fewer other
    // nodes nearby, so the label tends to land over open space rather than
    // on top of a neighboring node/label.
    const LABEL_SIDE_SEARCH_RADIUS = 70;
    function labelSide(d: SimNode): 1 | -1 {
      let above = 0;
      let below = 0;
      for (const other of nodes) {
        if (other === d) continue;
        const dx = other.x - d.x;
        const dy = other.y - d.y;
        if (Math.abs(dx) > LABEL_SIDE_SEARCH_RADIUS || Math.abs(dy) > LABEL_SIDE_SEARCH_RADIUS) continue;
        if (dy < 0) above++;
        else if (dy > 0) below++;
      }
      return above <= below ? -1 : 1;
    }

    // Each node's label footprint (in local, node-relative coordinates) —
    // filled in by renderLabels below and read by pickNonOverlapping to
    // decide which of the currently-eligible labels would actually collide
    // with one another.
    const labelBoxes = new Map<string, { width: number; height: number; top: number }>();

    // (Re)computes each label's wrap/side and redraws its tspans. Called
    // once up front (using the seed layout) and again once the simulation
    // settles, since the meaningful placement decision depends on final
    // node positions, not the starting spiral.
    function renderLabels() {
      labelGroup.each(function (d) {
        const g = d3.select(this);
        const fit = fitLabelToRadius(d.id, LABEL_FIT_RADIUS);
        const side = labelSide(d);
        const gap = radius(d.id) + LABEL_GAP;
        const blockTop = side === 1 ? gap : -(gap + (fit.lines.length - 1) * fit.lineHeight + fit.fontSize);

        const avgCharWidth = fit.fontSize * 0.56;
        const longest = Math.max(...fit.lines.map((l) => l.length));
        labelBoxes.set(d.id, {
          width: longest * avgCharWidth,
          height: fit.lines.length * fit.lineHeight,
          top: blockTop - fit.fontSize * 0.2,
        });

        const text = g
          .select<SVGTextElement>("text.label-text")
          .attr("font-size", fit.fontSize)
          .attr("font-weight", d.isGrantee ? 700 : 500)
          .attr("fill", fillColor(d));
        text.selectAll("tspan").remove();
        const startDy = blockTop + fit.fontSize * 0.8;
        fit.lines.forEach((line, i) => {
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? startDy : fit.lineHeight)
            .text(line);
        });
      });
    }

    renderLabels();
    applyHighlight(); // establish the baseline (unselected) link + label styling

    // Used by clearSelection's "zoom back out" — there's no automatic
    // fit-to-view on load/settle (removed: it was firing a zoom transition
    // right as the simulation first settled, which could land mid-gesture
    // and leave node dragging unresponsive afterward), so this is computed
    // fresh only when actually needed.
    function computeFitTransform(): d3.ZoomTransform {
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
      return d3.zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(scale).translate(-cx, -cy);
    }

    let settledOnce = false;
    function onSettle() {
      if (settledOnce || nodes.length === 0) return;
      renderLabels(); // re-decide each label's above/below side now that the layout has settled
      applyHighlight(); // re-run overlap suppression against the settled (not seed) positions
      settledOnce = true;
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
      labelGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    simulation.on("end", onSettle);

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
  }, [graph, sizeMode, colorMode, onSelectionChange]);

  // Runs after the effect above, in the same commit, whenever a caller (e.g.
  // an "Organizations" search control) asks to focus a specific org — by
  // then focusNodeRef.current is already bound to this graph's own nodes.
  useEffect(() => {
    if (focusNodeId) focusNodeRef.current(focusNodeId);
  }, [focusNodeId]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-card">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" />
      <SizeModeToggle value={sizeMode} onChange={setSizeMode} />
      {hover && <NameTooltip x={hover.x} y={hover.y} name={hover.name} />}
      {selectedNode && <OrganizationPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
    </div>
  );
}

function SizeModeToggle({ value, onChange }: { value: SizeMode; onChange: (v: SizeMode) => void }) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-0.5 rounded-lg bg-popover p-0.5 text-xs shadow-md ring-1 ring-foreground/10">
      {SIZE_MODE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2 py-1 font-medium transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
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
        <Row label="Organization Service Type" value={node.category} />
        <Row label="Service Subsector" value={node.subsector} />
        <Row label="Grantee Status" value={GRANTEE_STATUS_LABELS[node.granteeStatus]} />
        {node.fundingAmount && <Row label="Grantee Funding" value={node.fundingAmount} />}
        {node.fundingYear && <Row label="Funding Year" value={node.fundingYear} />}
        {node.fundingSourceLabel && <Row label="Funding Source" value={node.fundingSourceLabel} />}
        <Row label="Primary Service Area" value={node.serviceArea} />
        <Row label="Service Location" value={LOCATION_STATUS_LABELS[node.locationStatus]} />
      </dl>
      {node.kpi && <KpiSection kpi={node.kpi} />}
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

/** MHM's KPI reports (Mid-Year/Year-End surveys collected from grantees) are
 *  each their own reporting window, not a running cumulative total — so
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
            label={`Latest Reported (${kpi.latestPeriod})`}
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
                <td className="py-0.5 text-foreground">{r.period}</td>
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
