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

/**
 * Approximate geographic core (city/county center named in each region's
 * label) for every MHM region. These are marker anchor points, not region
 * boundaries — we don't have the county-to-region crosswalk needed to draw
 * accurate borders, so each region is represented by a single clickable pin.
 */
const REGION_CORES: Record<string, { lng: number; lat: number }> = {
  A: { lng: -100.437, lat: 31.4638 }, // Concho Valley / San Angelo
  B: { lng: -99.1403, lat: 30.0474 }, // Texas Hill Country (Kerrville)
  C: { lng: -97.7431, lat: 30.2672 }, // Travis County / Austin
  D: { lng: -98.4936, lat: 29.4241 }, // Bexar County / San Antonio
  E: { lng: -97.38, lat: 29.97 }, // Bastrop-Hays-Fayette
  F: { lng: -98.55, lat: 29.28 }, // Medina-Atascosa-Guadalupe
  G: { lng: -97.0036, lat: 28.8053 }, // Victoria / Coastal Plains
  H: { lng: -97.3964, lat: 27.8006 }, // Corpus Christi / Coastal Bend
  J: { lng: -98.23, lat: 26.2034 }, // South Texas / Rio Grande Valley (McAllen)
  K: { lng: -99.5075, lat: 27.5306 }, // Tri-County (Laredo)
  L: { lng: -100.4996, lat: 28.7091 }, // Mid-Border Region (Eagle Pass)
};

export function RegionMap({ regions }: { regions: RegionMapItem[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("missing-token");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-98.6, 29.2],
      zoom: 5.1,
      attributionControl: true,
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add one clickable marker per region once the map is ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers: mapboxgl.Marker[] = [];

    for (const region of regions) {
      const core = REGION_CORES[region.code];
      if (!core) continue;

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${region.label}, ${region.orgCount} organizations`);
      el.className = "region-marker";
      el.innerHTML = `
        <span class="region-marker__dot">${region.code}</span>
        <span class="region-marker__label">${region.label.replace(/^Region [A-Z] — /, "")}</span>
      `;

      el.addEventListener("mouseenter", () => setHovered(region.code));
      el.addEventListener("mouseleave", () => setHovered(null));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        router.push(`/regions/${region.code}`);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([core.lng, core.lat])
        .addTo(map);
      markers.push(marker);
    }

    return () => {
      for (const m of markers) m.remove();
    };
  }, [ready, regions, router]);

  if (error === "missing-token") {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-xl bg-white/10 p-6 text-center text-sm text-white/80">
        The interactive map needs a Mapbox access token
        (NEXT_PUBLIC_MAPBOX_TOKEN) to display.
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/15 sm:h-[28rem]"
      />
      <p className="mt-3 text-xs text-white/60">
        {hovered
          ? regions.find((r) => r.code === hovered)?.label
          : "Click a marker to explore that region's ecosystem."}
      </p>
    </div>
  );
}
