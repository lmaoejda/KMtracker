/* KMtracker — seguimiento en tiempo real con navigator.geolocation.watchPosition() */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var T = window.TrackMap;
  if (!T) return;

  var OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };
  var MAX_ACCURACY = 50; // metros: por encima se descarta el punto

  var watchId = null;
  var tickId = null;
  var statusEl = $("gpsStatus");
  var modeManual = $("modeManual");
  var modeGps = $("modeGps");
  var btnStart = $("btnStart");
  var btnStop = $("btnStop");

  var ERROR_MSG = {
    1: "Permiso de ubicación denegado. Actívalo en los ajustes del navegador y vuelve a intentar.",
    2: "No se pudo obtener tu posición (red o sensores no disponibles).",
    3: "Tiempo de espera agotado buscando el GPS. Muévete a un lugar con mejor cobertura.",
  };

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.hidden = !text;
    statusEl.textContent = text || "";
    statusEl.className = "status" + (kind ? " is-" + kind : "");
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function updateHud() {
    var km = T.state.totalM / 1000;
    var elapsedMs = T.state.startedAt ? Date.now() - T.state.startedAt : 0;
    var h = elapsedMs / 3600000;
    var el = $("elapsed");
    if (el) {
      var s = Math.floor(elapsedMs / 1000);
      el.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60);
    }
    var speed = $("avgSpeed");
    if (speed) speed.innerHTML = (h > 0 ? (km / h).toFixed(1) : "0.0") + '<span class="unit">km/h</span>';
  }

  function setMode(gpsMode) {
    T.setMode(!gpsMode);
    modeManual.classList.toggle("is-active", !gpsMode);
    modeGps.classList.toggle("is-active", gpsMode);
    modeManual.setAttribute("aria-selected", String(!gpsMode));
    modeGps.setAttribute("aria-selected", String(gpsMode));
    btnStart.hidden = !gpsMode;
    btnStop.hidden = true;
    if (!gpsMode) {
      stopWatch(false);
      setStatus("");
    } else if (!watchId) {
      setStatus("Pulsa INICIAR para empezar a registrar el recorrido.");
      updateHud();
    }
  }

  function onPosition(pos) {
    var c = pos.coords;

    // ---- Filtro de precisión: evita saltos falsos en la distancia ----
    if (typeof c.accuracy === "number" && c.accuracy > MAX_ACCURACY) {
      setStatus(
        "Punto descartado · precisión " + Math.round(c.accuracy) + " m (máx. " + MAX_ACCURACY + " m). Buscando mejor cobertura…",
        ""
      );
      return;
    }

    var segment = T.addPoint({ lat: c.latitude, lng: c.longitude }, "gps");
    T.map.panTo([c.latitude, c.longitude], { animate: true, duration: 0.6 });

    setStatus(
      "REGISTRANDO · precisión " + Math.round(c.accuracy) + " m · último tramo " +
        (segment / 1000).toFixed(2) + " km",
      "live"
    );
    updateHud();
  }

  function onError(err) {
    if (err && err.code === 1) {
      stopWatch(true);
      setStatus(ERROR_MSG[1], "error");
      return;
    }
    setStatus((ERROR_MSG[err && err.code] || "Error desconocido del GPS."), err && err.code === 3 ? "" : "error");
  }

  function startWatch() {
    if (!("geolocation" in navigator)) {
      setStatus("Este navegador no soporta geolocalización.", "error");
      return;
    }
    T.state.tracking = true;
    T.state.startedAt = Date.now();
    T.setMode(false);
    btnStart.hidden = true;
    btnStop.hidden = false;
    setStatus("Buscando señal GPS…", "");

    watchId = navigator.geolocation.watchPosition(onPosition, onError, OPTIONS);
    tickId = window.setInterval(updateHud, 1000);
  }

  function stopWatch(resetMode) {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (tickId) { window.clearInterval(tickId); tickId = null; }
    T.state.tracking = false;

    if (resetMode !== false) {
      btnStart.hidden = false;
      btnStop.hidden = true;
      if (T.state.points.length) {
        setStatus("DETENIDO · " + (T.state.totalM / 1000).toFixed(2) + " km listos para guardar.", "");
      } else {
        setStatus("Sin puntos registrados.", "");
      }
      updateHud();
    }
  }

  // ---------------------------------------------------------------- guardado
  function saveRoute() {
    var btn = $("btnSave");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "Guardando…";

    fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: T.state.gpsPoints > 0 ? "tracking" : "manual",
        points: T.state.points,
        distance_m: T.state.totalM,
        duration_s: T.state.startedAt ? Math.round((Date.now() - T.state.startedAt) / 1000) : 0,
      }),
    })
      .then(function (res) {
        if (res.status === 401) { window.location = "/login"; return null; }
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "No se pudo guardar la ruta.");
          window.location = data.redirect || "/stats";
        });
      })
      .catch(function (e) {
        setStatus(e.message, "error");
        btn.disabled = false;
        btn.textContent = "Guardar ruta";
      });
  }

  // ----------------------------------------------------------------- enlaces
  modeManual.addEventListener("click", function () { setMode(false); });
  modeGps.addEventListener("click", function () { setMode(true); });
  btnStart.addEventListener("click", startWatch);
  btnStop.addEventListener("click", function () { stopWatch(true); });
  $("btnClear").addEventListener("click", function () {
    if (T.state.tracking) return setStatus("Detén el seguimiento antes de limpiar.", "error");
    T.reset();
    setStatus("");
  });
  $("btnSave").addEventListener("click", saveRoute);

  setMode(false);
})();
