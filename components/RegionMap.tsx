"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface RegionMapItem {
  code: string;
  label: string;
  orgCount: number;
}

/** Path to the region-boundary GeoJSON (features carry a `REGION` property). */
const GEOJSON_URL = "/service-area-regions.json";

/** Faded full-state outline drawn behind the regions for geographic context. */
const TEXAS_URL = "/texas-outline.json";

/** Dark-blue canvas that matches the site's hero/footer (`--raisin`). */
const CANVAS = "#1b1b33";

/**
 * Distinct fill color per active MHM region. These are categorical map colors
 * (a choropsleth-style exception to the site's small palette) chosen to stay
 * legible on the dark canvas. Region I exists in the boundary file but has no
 * ecosystem page, so it renders as a neutral, non-interactive filler.
 */
const REGION_COLORS: Record<string, string> = {
  A: "#3c4ed6", // cobalt
  B: "#2f9e8f", // teal
  C: "#c99a2e", // gold
  D: "#7a5fb0", // purple
  E: "#c4433a", // red
  F: "#4b9fe0", // sky
  G: "#56b870", // green
  H: "#e08a3c", // orange
  J: "#d05f9d", // pink
  K: "#8fb339", // lime
  L: "#5bc2c2", // cyan
};
const INACTIVE_COLOR = "#3a3a52";
const INACTIVE_REGION = "I";

// --- Geometry helpers: area-weighted centroid of each region's largest ring,
// used to anchor its pin and label somewhere inside the shape. -------------

type Ring = [number, number][];

function ringSignedArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function ringCentroid(ring: Ring): [number, number] {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  a /= 2;
  if (a === 0) {
    // Degenerate ring — fall back to the average vertex.
    const avg = ring.reduce(
      (acc, [px, py]) => [acc[0] + px, acc[1] + py] as [number, number],
      [0, 0] as [number, number],
    );
    return [avg[0] / ring.length, avg[1] / ring.length];
  }
  return [x / (6 * a), y / (6 * a)];
}

/** Outer ring of the largest polygon in a Polygon/MultiPolygon geometry. */
function largestOuterRing(geometry: GeoJSON.Geometry): Ring | null {
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0] as Ring;
  }
  if (geometry.type === "MultiPolygon") {
    let best: Ring | null = null;
    let bestArea = -Infinity;
    for (const poly of geometry.coordinates) {
      const ring = poly[0] as Ring;
      const area = Math.abs(ringSignedArea(ring));
      if (area > bestArea) {
        bestArea = area;
        best = ring;
      }
    }
    return best;
  }
  return null;
}

function bboxOf(features: GeoJSON.Feature[]): mapboxgl.LngLatBoundsLike {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [x, y] = coords as [number, number];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    if (Array.isArray(coords)) for (const c of coords) visit(c);
  };
  for (const f of features) {
    if (f.geometry && "coordinates" in f.geometry) visit(f.geometry.coordinates);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

export function RegionMap({ regions }: { regions: RegionMapItem[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hoverIdRef = useRef<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("missing-token");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    const labelByCode = new Map(
      regions.map((r) => [r.code, r.label.replace(/^Region [A-Z]\s*[—-]\s*/, "")]),
    );
    const countByCode = new Map(regions.map((r) => [r.code, r.orgCount]));

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      // Blank dark-blue canvas — no base tiles, so only the MHM regions show.
      style: {
        version: 8,
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: {},
        layers: [{ id: "canvas", type: "background", paint: { "background-color": CANVAS } }],
      },
      center: [-98.6, 28.8],
      zoom: 5,
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.touchZoomRotate.disableRotation();

    let cancelled = false;

    map.on("load", async () => {
      let collection: GeoJSON.FeatureCollection;
      try {
        const res = await fetch(GEOJSON_URL);
        collection = (await res.json()) as GeoJSON.FeatureCollection;
      } catch {
        if (!cancelled) setError("geojson-failed");
        return;
      }
      if (cancelled || !map.getLayer("canvas")) return;

      // Build pin points from each region's centroid (active regions only).
      // Centroids are also reused to anchor the hover name popup.
      const pinFeatures: GeoJSON.Feature[] = [];
      const centroidByCode = new Map<string, [number, number]>();
      for (const feature of collection.features) {
        const code = String(feature.properties?.REGION ?? "");
        if (!code || code === INACTIVE_REGION) continue;
        const ring = feature.geometry ? largestOuterRing(feature.geometry) : null;
        if (!ring) continue;
        const centroid = ringCentroid(ring);
        centroidByCode.set(code, centroid);
        pinFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: centroid },
          properties: {
            code,
            name: labelByCode.get(code) ?? code,
            count: countByCode.get(code) ?? 0,
          },
        });
      }

      // Faded full-Texas backdrop so the whole state stays visible behind the
      // prominent color-coded regions. Fetched separately; failure is
      // non-fatal — the regions still render on the dark canvas.
      let texasFeature: GeoJSON.Feature | null = null;
      try {
        const texasRes = await fetch(TEXAS_URL);
        const texas = (await texasRes.json()) as GeoJSON.Feature;
        if (!cancelled && map.getLayer("canvas")) {
          texasFeature = texas;
          map.addSource("texas", { type: "geojson", data: texas });
          map.addLayer({
            id: "texas-fill",
            type: "fill",
            source: "texas",
            paint: { "fill-color": "#242440", "fill-opacity": 1 },
          });
          map.addLayer({
            id: "texas-outline",
            type: "line",
            source: "texas",
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.2,
              "line-opacity": 0.28,
            },
          });
        }
      } catch {
        // Ignore — the Texas backdrop is decorative.
      }

      map.addSource("regions", { type: "geojson", data: collection, generateId: true });
      map.addSource("region-pins", {
        type: "geojson",
        data: { type: "FeatureCollection", features: pinFeatures },
      });

      const fillColor: mapboxgl.Expression = [
        "match",
        ["get", "REGION"],
        ...Object.entries(REGION_COLORS).flat(),
        INACTIVE_COLOR,
      ];

      // 1. Region fills (brighten the hovered region via feature-state).
      map.addLayer({
        id: "region-fill",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": fillColor,
          "fill-opacity": [
            "case",
            ["==", ["get", "REGION"], INACTIVE_REGION],
            0.35,
            ["boolean", ["feature-state", "hover"], false],
            0.95,
            0.75,
          ],
        },
      });

      // 2. Boundary lines between regions.
      map.addLayer({
        id: "region-border",
        type: "line",
        source: "regions",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1.1,
          "line-opacity": 0.55,
        },
      });

      // 3. Pins (drawn above fills, below labels).
      map.addLayer({
        id: "region-pin",
        type: "circle",
        source: "region-pins",
        paint: {
          "circle-radius": 13,
          "circle-color": ["match", ["get", "code"], ...Object.entries(REGION_COLORS).flat(), "#888"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 4. Region letter centered on each pin.
      map.addLayer({
        id: "region-pin-code",
        type: "symbol",
        source: "region-pins",
        layout: {
          "text-field": ["get", "code"],
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 13,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      // Names are no longer drawn on the map — the region letter identifies
      // each region, and the full name appears in a hover popup (below), which
      // renders above the canvas and repositions to never be obscured.
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        className: "region-popup",
      });

      // Fit to the full Texas outline so the whole state stays in view; fall
      // back to the region bounds if the outline didn't load.
      const boundsFeatures = texasFeature ? [texasFeature] : (collection.features ?? []);
      if (boundsFeatures.length) {
        map.fitBounds(bboxOf(boundsFeatures), { padding: 32, duration: 0 });
      }

      const isActive = (code: string) => code && code !== INACTIVE_REGION;

      const navigate = (code: string) => {
        if (isActive(code)) router.push(`/regions/${code}`);
      };

      map.on("click", "region-fill", (e) => {
        const code = String(e.features?.[0]?.properties?.REGION ?? "");
        navigate(code);
      });
      map.on("click", "region-pin", (e) => {
        const code = String(e.features?.[0]?.properties?.code ?? "");
        navigate(code);
      });

      const setHover = (id: number | string | undefined, code: string) => {
        if (hoverIdRef.current !== null) {
          map.setFeatureState({ source: "regions", id: hoverIdRef.current }, { hover: false });
        }
        if (id !== undefined && isActive(code)) {
          hoverIdRef.current = id;
          map.setFeatureState({ source: "regions", id }, { hover: true });
          setHovered(code);
          map.getCanvas().style.cursor = "pointer";
          const centroid = centroidByCode.get(code);
          const name = labelByCode.get(code) ?? code;
          if (centroid) {
            popup
              .setLngLat(centroid)
              .setText(`Region ${code} · ${name}`)
              .addTo(map);
          }
        } else {
          hoverIdRef.current = null;
          setHovered(null);
          map.getCanvas().style.cursor = "";
          popup.remove();
        }
      };

      map.on("mousemove", "region-fill", (e) => {
        const f = e.features?.[0];
        setHover(f?.id, String(f?.properties?.REGION ?? ""));
      });
      map.on("mouseleave", "region-fill", () => setHover(undefined, ""));
    });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
    };
  }, [regions, router]);

  if (error === "missing-token") {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl bg-white/10 p-6 text-center text-sm text-white/80 sm:h-[28rem]">
        The interactive map needs a Mapbox access token
        (NEXT_PUBLIC_MAPBOX_TOKEN) to display.
      </div>
    );
  }

  const hoveredRegion = hovered ? regions.find((r) => r.code === hovered) : null;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/15 sm:h-[28rem]"
      />
      <p className="mt-3 text-xs text-white/60">
        {hoveredRegion
          ? `${hoveredRegion.label} · ${hoveredRegion.orgCount} organizations`
          : "Click a region to explore its ecosystem."}
      </p>
    </div>
  );
}
