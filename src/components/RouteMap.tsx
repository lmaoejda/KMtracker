"use client";

import type * as Leaflet from "leaflet";
import { useEffect, useRef } from "react";

type LatLngTuple = [number, number];

type Props = {
  points: LatLngTuple[];
  className?: string;
  id?: string;
};

let leaflet: typeof import("leaflet") | null = null;

/** Mapa de solo lectura con la ruta guardada (sin edición). */
export function RouteMap({ points, id = "routeMap", className = "mapwrap--page" }: Props) {
  const el = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!el.current || points.length === 0) return;
    let cancelled = false;
    let map: Leaflet.Map | null = null;

    import("leaflet").then((mod) => {
      if (cancelled || !el.current) return;
      const L = mod.default;
      leaflet = L;

      const first = points[0];
      map = L.map(el.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        center: [first[0], first[1]],
        zoom: 14,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const line = L.polyline(points, { color: "#63E6BE", weight: 4, opacity: 0.9 }).addTo(map);
      L.circleMarker(first, {
        radius: 7,
        color: "#F2A93B",
        weight: 3,
        fillColor: "#0B100E",
        fillOpacity: 1,
      }).addTo(map);
      L.circleMarker(points[points.length - 1], {
        radius: 7,
        color: "#63E6BE",
        weight: 3,
        fillColor: "#0B100E",
        fillOpacity: 1,
      }).addTo(map);
      map.fitBounds(line.getBounds().pad(0.15));
    });

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  return (
    <div className={className}>
      <div id={id} ref={el} aria-label="Recorrido guardado" />
      <p className="map__attr">
        &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
      </p>
    </div>
  );
}
