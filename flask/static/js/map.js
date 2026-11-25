/* KMtracker — mapa base, marcadores manuales y suma de tramos (Leaflet) */
(function () {
  "use strict";

  var cfg = window.TRACK_CFG || { lat: -34.6037, lng: -58.3816, zoom: 13 };
  var $ = function (id) { return document.getElementById(id); };

  var map = L.map("map", { zoomControl: false, preferCanvas: true })
    .setView([cfg.lat, cfg.lng], cfg.zoom);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  var state = {
    points: [],      // [[lat, lng], ...]
    totalM: 0,
    lastM: 0,
    manual: true,    // el clic coloca puntos
    tracking: false, // el GPS está activo
    gpsPoints: 0,
    startedAt: 0,
  };

  var markers = [];
  var line = L.polyline([], { color: "#63E6BE", weight: 4, opacity: 0.9, smoothFactor: 1 }).addTo(map);
  var ghost = L.polyline([], { color: "#F2A93B", weight: 2, opacity: 0.55, dashArray: "6 8" }).addTo(map);

  function fmtKm(m) { return (m / 1000).toFixed(2); }

  function icon(gps) {
    return L.divIcon({
      className: "pin",
      html: '<span class="pin__dot' + (gps ? " is-gps" : "") + '"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  function renderLedger() {
    var ol = $("coordList");
    if (!ol) return;
    if (!state.points.length) {
      ol.innerHTML = '<li class="ledger__empty">Toca el mapa para marcar el primer punto.</li>';
    } else {
      ol.innerHTML = state.points
        .map(function (p, i) {
          return '<li><span>#' + String(i + 1).padStart(3, "0") + " " +
            p[0].toFixed(5) + ", " + p[1].toFixed(5) + "</span><b>" +
            (i === 0 ? "INICIO" : "+0.00") + "</b></li>";
        })
        .join("");
      ol.scrollTop = ol.scrollHeight;
    }
    var c = $("ledgerCount");
    if (c) c.textContent = state.points.length + " pts";
  }

  function render() {
    var total = $("totalKm");
    if (total) total.innerHTML = fmtKm(state.totalM) + '<span class="unit">km</span>';
    var last = $("lastKm");
    if (last) last.innerHTML = fmtKm(state.lastM) + '<span class="unit">km</span>';
    var count = $("pointCount");
    if (count) count.textContent = String(state.points.length);
    var save = $("btnSave");
    if (save) save.disabled = state.points.length < 2;
    renderLedger();
  }

  /** Añade un punto y suma la distancia desde el anterior (latlng.distanceTo, metros). */
  function addPoint(latlng, source) {
    var gps = source === "gps";
    var prev = state.points.length ? state.points[state.points.length - 1] : null;
    var segment = 0;

    if (prev) {
      // API de Leaflet:.LatLng.distanceTo(LatLng) -> metros
      segment = L.latLng(prev[0], prev[1]).distanceTo(latlng);
      if (!isFinite(segment)) segment = 0;
      // Filtro anti-saltos: descarta segmentos absurdos (> 5 km en un tramo)
      if (segment > 5000) segment = 0;
    }

    state.points.push([latlng.lat, latlng.lng]);
    state.totalM += segment;
    state.lastM = segment;
    if (gps) state.gpsPoints += 1;

    var marker = L.marker(latlng, { icon: icon(gps), keyboard: false }).addTo(map);
    markers.push(marker);
    line.setLatLngs(state.points);
    ghost.setLatLngs(state.points);

    render();
    return segment;
  }

  function reset() {
    markers.forEach(function (m) { map.removeLayer(m); });
    markers = [];
    state.points = [];
    state.totalM = 0;
    state.lastM = 0;
    state.gpsPoints = 0;
    line.setLatLngs([]);
    ghost.setLatLngs([]);
    render();
  }

  function setMode(manual) {
    state.manual = manual;
    var badge = $("modeBadge");
    if (badge) badge.textContent = manual ? "MODO MANUAL" : "MODO GPS";
    var tracker = $("tracker");
    if (tracker) tracker.classList.toggle("is-gps", !manual);
  }

  map.on("click", function (e) {
    if (!state.manual || state.tracking) return;
    addPoint(e.latlng, "manual");
  });

  window.TrackMap = {
    map: map,
    state: state,
    addPoint: addPoint,
    reset: reset,
    setMode: setMode,
    render: render,
    line: line,
  };

  render();
})();
