/** Distancia haversine en metros (respaldo del servidor del latlng.distanceTo() de Leaflet). */
export function haversineMeters(
  [lat1, lng1]: [number, number],
  [lat2, lng2]: [number, number],
): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type ParsedRoute = { points: [number, number][]; distanceM: number };

/** Valida la lista de coordenadas y calcula la distancia total. */
export function parsePoints(raw: unknown): ParsedRoute {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error("La ruta necesita al menos 2 puntos.");
  }
  if (raw.length > 5000) throw new Error("Máximo 5000 puntos por ruta.");

  const points: [number, number][] = raw.map((item) => {
    const pair = item as [unknown, unknown];
    const lat = Number(pair?.[0]);
    const lng = Number(pair?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("Coordenada inválida.");
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("Coordenada fuera de rango.");
    }
    return [Math.round(lat * 1e7) / 1e7, Math.round(lng * 1e7) / 1e7];
  });

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return { points, distanceM: total };
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
