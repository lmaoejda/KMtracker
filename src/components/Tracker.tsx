"use client";

import type * as Leaflet from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LatLngTuple = [number, number];
type Mode = "manual" | "gps";
type StatusKind = "" | "live" | "error";

type Props = {
  user: { id: number; email: string } | null;
  cfg: { lat: number; lng: number; zoom: number };
};

const MAX_ACCURACY = 50; // metros: por encima se descarta el punto
const OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
};
const GPS_ERROR: Record<number, string> = {
  1: "Permiso de ubicación denegado. Actívalo en los ajustes del navegador y vuelve a intentar.",
  2: "No se pudo obtener tu posición (red o sensores no disponibles).",
  3: "Tiempo de espera agotado buscando el GPS. Muévete a un lugar con mejor cobertura.",
};

/** Se carga dentro de useEffect para no tocar `window` en el render del servidor. */
let leaflet: typeof import("leaflet") | null = null;

function icon(gps: boolean): Leaflet.DivIconOptions {
  return {
    className: "pin",
    html: `<span class="pin__dot${gps ? " is-gps" : ""}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  };
}

const km = (m: number) => (m / 1000).toFixed(2);
const pad = (n: number) => String(n).padStart(2, "0");

export function Tracker({ user, cfg }: Props) {
  const router = useRouter();

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Leaflet.Marker[]>([]);
  const lineRef = useRef<Leaflet.Polyline | null>(null);
  const watchRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const stRef = useRef({
    points: [] as LatLngTuple[],
    segments: [] as number[],
    totalM: 0,
    lastM: 0,
    gpsPoints: 0,
    startedAt: 0,
  });
  const modeRef = useRef<Mode>("manual");
  const trackingRef = useRef(false);

  const [mode, setModeState] = useState<Mode>("manual");
  const [tracking, setTracking] = useState(false);
  const [hud, setHud] = useState({ total: 0, last: 0, count: 0, gps: 0 });
  const [segments, setSegments] = useState<number[]>([]);
  const [points, setPoints] = useState<LatLngTuple[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({
    text: "",
    kind: "",
  });
  const [saving, setSaving] = useState(false);

  const sync = useCallback(() => {
    const st = stRef.current;
    setHud({ total: st.totalM, last: st.lastM, count: st.points.length, gps: st.gpsPoints });
    setSegments([...st.segments]);
    setPoints([...st.points]);
  }, []);

  /* ------------------------------------------------------------ init map -- */
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;

    import("leaflet").then((mod) => {
      if (cancelled || !mapEl.current) return;
      const L = mod.default;
      leaflet = L;

      map = L.map(mapEl.current, {
        zoomControl: false,
        preferCanvas: true,
        center: [cfg.lat, cfg.lng],
        zoom: cfg.zoom,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      lineRef.current = L.polyline([], {
        color: "#63E6BE",
        weight: 4,
        opacity: 0.9,
        smoothFactor: 1,
      }).addTo(map);

      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (modeRef.current !== "manual" || trackingRef.current) return;
        addPoint([e.latlng.lat, e.latlng.lng], "manual");
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (watchRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
      map?.remove();
      mapRef.current = null;
      lineRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------- add point -- */
  const addPoint = useCallback(
    (latlng: LatLngTuple, source: "manual" | "gps") => {
      const L = leaflet;
      const st = stRef.current;
      let segment = 0;

      if (st.points.length && L) {
        const prev = st.points[st.points.length - 1];
        segment = L.latLng(prev[0], prev[1]).distanceTo(L.latLng(latlng[0], latlng[1]));
        if (!isFinite(segment)) segment = 0;
        if (segment > 5000) segment = 0; // anti-saltos absurdos
      }

      st.points.push(latlng);
      st.segments.push(segment);
      st.totalM += segment;
      st.lastM = segment;
      if (source === "gps") st.gpsPoints += 1;

      const map = mapRef.current;
      if (map && L) {
        const marker = L.marker(latlng, {
          icon: L.divIcon(icon(source === "gps")),
          keyboard: false,
        }).addTo(map);
        markersRef.current.push(marker);
        lineRef.current?.setLatLngs(st.points);
      }

      sync();
      return segment;
    },
    [sync],
  );

  /* ------------------------------------------------------------- GPS ----- */
  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const c = pos.coords;

      // ---- filtro de precisión: evita saltos falsos en la distancia ----
      if (typeof c.accuracy === "number" && c.accuracy > MAX_ACCURACY) {
        setStatus({
          text: `Punto descartado · precisión ${Math.round(c.accuracy)} m (máx. ${MAX_ACCURACY} m). Buscando mejor cobertura…`,
          kind: "",
        });
        return;
      }

      const segment = addPoint([c.latitude, c.longitude], "gps");
      mapRef.current?.panTo([c.latitude, c.longitude], { animate: true, duration: 0.6 });
      setStatus({
        text: `REGISTRANDO · precisión ${Math.round(c.accuracy)} m · último tramo ${km(segment)} km`,
        kind: "live",
      });
    },
    [addPoint],
  );

  const onError = useCallback((err: GeolocationPositionError) => {
    if (err.code === 1) {
      stopWatch();
      setStatus({ text: GPS_ERROR[1], kind: "error" });
      return;
    }
    setStatus({
      text: GPS_ERROR[err.code] || "Error desconocido del GPS.",
      kind: err.code === 3 ? "" : "error",
    });
  }, []);

  function startWatch() {
    if (!("geolocation" in navigator)) {
      setStatus({ text: "Este navegador no soporta geolocalización.", kind: "error" });
      return;
    }
    const st = stRef.current;
    if (!st.startedAt) st.startedAt = Date.now();

    trackingRef.current = true;
    setTracking(true);
    setMode("gps");
    setStatus({ text: "Buscando señal GPS…", kind: "" });

    watchRef.current = navigator.geolocation.watchPosition(onPosition, onError, OPTIONS);
    tickRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - stRef.current.startedAt) / 1000));
    }, 1000);
  }

  function stopWatch() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    trackingRef.current = false;
    setTracking(false);

    const st = stRef.current;
    setStatus({
      text: st.points.length
        ? `DETENIDO · ${km(st.totalM)} km listos para guardar.`
        : "Sin puntos registrados.",
      kind: "",
    });
    if (st.startedAt) setElapsed(Math.floor((Date.now() - st.startedAt) / 1000));
  }

  /* ------------------------------------------------------------ acciones -- */
  function setMode(next: Mode) {
    modeRef.current = next;
    setModeState(next);
    if (next === "manual") {
      stopWatch();
      setStatus({ text: "", kind: "" });
    } else if (!trackingRef.current) {
      setStatus({ text: "Pulsa INICIAR para empezar a registrar el recorrido.", kind: "" });
    }
  }

  function clearRoute() {
    if (trackingRef.current) {
      setStatus({ text: "Detén el seguimiento antes de limpiar.", kind: "error" });
      return;
    }
    const st = stRef.current;
    st.points = [];
    st.segments = [];
    st.totalM = 0;
    st.lastM = 0;
    st.gpsPoints = 0;
    st.startedAt = 0;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    lineRef.current?.setLatLngs([]);
    setElapsed(0);
    setStatus({ text: "", kind: "" });
    sync();
  }

  async function saveRoute() {
    const st = stRef.current;
    if (st.points.length < 2 || saving) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: st.gpsPoints > 0 ? "tracking" : "manual",
          points: st.points,
          distance_m: st.totalM,
          duration_s: st.startedAt ? Math.round((Date.now() - st.startedAt) / 1000) : 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ text: data.error || "No se pudo guardar la ruta.", kind: "error" });
        return;
      }
      router.push(`/routes/${data.id}`);
      router.refresh();
    } catch {
      setStatus({ text: "Error de red al guardar.", kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  const avgSpeed = elapsed > 0 ? (hud.total / 1000 / (elapsed / 3600)).toFixed(1) : "0.0";
  const isGps = mode === "gps";

  return (
    <main className={`tracker${isGps ? " is-gps" : ""}`}>
      <aside className="rail">
        <div className="mode" role="tablist" aria-label="Modo de registro">
          <button
            type="button"
            role="tab"
            aria-selected={!isGps}
            className={`mode__btn${!isGps ? " is-active" : ""}`}
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isGps}
            className={`mode__btn${isGps ? " is-active" : ""}`}
            onClick={() => setMode("gps")}
          >
            GPS en vivo
          </button>
        </div>

        <section className="readouts">
          <div className="readout">
            <p className="label">Distancia total</p>
            <p className="value">
              {km(hud.total)}
              <span className="unit">km</span>
            </p>
          </div>

          <div className="readout--split">
            <div>
              <p className="label">Último tramo</p>
              <p className="value value--sm">
                {km(hud.last)}
                <span className="unit">km</span>
              </p>
            </div>
            <div>
              <p className="label">Puntos</p>
              <p className="value value--sm">{hud.count}</p>
            </div>
          </div>

          <div className="readout--split only-gps">
            <div>
              <p className="label">Tiempo</p>
              <p className="value value--sm">
                {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}
              </p>
            </div>
            <div>
              <p className="label">Vel. media</p>
              <p className="value value--sm">
                {avgSpeed}
                <span className="unit">km/h</span>
              </p>
            </div>
          </div>
        </section>

        {(status.text || !user) && (
          <div className={`status${status.kind ? ` is-${status.kind}` : ""}`} role="status">
            {status.text}
            {!user && (
              <>
                {" "}
                <a href="/login" style={{ color: "var(--amber)", textDecoration: "underline" }}>
                  Inicia sesión
                </a>{" "}
                para guardar tus rutas.
              </>
            )}
          </div>
        )}

        <div className="actions">
          {!isGps && (
            <button
              type="button"
              className="btn primary big"
              onClick={() => {
                setMode("gps");
                startWatch();
              }}
            >
              INICIAR
            </button>
          )}
          {isGps && !tracking && (
            <button type="button" className="btn primary big" onClick={startWatch}>
              INICIAR
            </button>
          )}
          {isGps && tracking && (
            <button type="button" className="btn stop big" onClick={stopWatch}>
              DETENER
            </button>
          )}

          <div className="actions__row">
            <button type="button" className="btn" onClick={clearRoute} disabled={tracking}>
              Limpiar ruta
            </button>
            <button
              type="button"
              className="btn accent"
              onClick={saveRoute}
              disabled={hud.count < 2 || saving}
            >
              {saving ? "Guardando…" : user ? "Guardar ruta" : "Entrar para guardar"}
            </button>
          </div>
        </div>

        <section className="ledger">
          <div className="ledger__head">
            <p className="label">Coordenadas</p>
            <p className="label">{hud.count} pts</p>
          </div>
          <ol>
            {points.length === 0 ? (
              <li className="ledger__empty">
                {isGps
                  ? "Pulsa INICIAR y el GPS irá dibujando tu ruta."
                  : "Toca el mapa para marcar el primer punto."}
              </li>
            ) : (
              points.map((p, i) => (
                <li key={`${p[0]}-${p[1]}-${i}`}>
                  <span>
                    #{pad(i + 1)} {p[0].toFixed(5)}, {p[1].toFixed(5)}
                  </span>
                  <b>{i === 0 ? "INICIO" : `+${km(segments[i] ?? 0)}`}</b>
                </li>
              ))
            )}
          </ol>
        </section>
      </aside>

      <div className="mapwrap">
        <div id="map" ref={mapEl} aria-label="Mapa de la ruta" />
        <p className="map__badge">{isGps ? "MODO GPS" : "MODO MANUAL"}</p>
        <p className="map__attr">
          &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
        </p>
      </div>
    </main>
  );
}
