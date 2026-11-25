"""
KMtracker — web personal de tracking de rutas (Flask + SQLite + Leaflet).

Ejecutar:  python app.py   ->  http://127.0.0.1:5000
"""
import math
import os
import re

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from db import (
    close_db,
    create_user,
    get_route,
    get_user,
    get_user_by_email,
    init_db,
    list_routes,
    route_stats,
    save_route,
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
MAX_POINTS = 5000

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "dev-change-me-in-production"),
    DATABASE_PATH=os.environ.get(
        "DATABASE_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "tracking.db")
    ),
    # Mapa por defecto (configurable por variables de entorno)
    DEFAULT_LAT=float(os.environ.get("DEFAULT_LAT", "-34.6037")),
    DEFAULT_LNG=float(os.environ.get("DEFAULT_LNG", "-58.3816")),
    DEFAULT_ZOOM=int(os.environ.get("DEFAULT_ZOOM", "13")),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,  # 30 días
)
app.teardown_appcontext(close_db)


# ------------------------------------------------------------- auth utils ----
def current_user_id():
    uid = session.get("user_id")
    if uid is None:
        return None
    return uid if get_user(uid) else None


def login_required(view):
    from functools import wraps

    @wraps(view)
    def wrapper(*args, **kwargs):
        if current_user_id() is None:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Debes iniciar sesión."}), 401
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapper


# --------------------------------------------------------------- páginas ----
@app.route("/")
@login_required
def index():
    user = get_user(current_user_id())
    return render_template(
        "index.html",
        user=user,
        cfg={
            "lat": app.config["DEFAULT_LAT"],
            "lng": app.config["DEFAULT_LNG"],
            "zoom": app.config["DEFAULT_ZOOM"],
        },
        saved_routes=list_routes(user["id"]),
    )


@app.route("/stats")
@login_required
def stats():
    user = get_user(current_user_id())
    routes = list_routes(user["id"])
    totals = route_stats(user["id"])
    return render_template(
        "stats.html",
        user=user,
        routes=routes,
        total_routes=totals["total"],
        total_km=round(totals["meters"] / 1000.0, 2),
    )


@app.route("/routes/<int:route_id>")
@login_required
def route_detail(route_id):
    route = get_route(current_user_id(), route_id)
    if route is None:
        abort(404)
    return render_template("route.html", user=get_user(current_user_id()), route=route)


# ----------------------------------------------------------------- auth ----
@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user_id():
        return redirect(url_for("index"))
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        confirm = request.form.get("confirm") or ""

        if not EMAIL_RE.match(email):
            flash("Introduce un email válido.", "error")
        elif len(password) < 8:
            flash("La contraseña debe tener al menos 8 caracteres.", "error")
        elif password != confirm:
            flash("Las contraseñas no coinciden.", "error")
        elif get_user_by_email(email):
            flash("Ya existe una cuenta con ese email.", "error")
        else:
            user_id = create_user(email, generate_password_hash(password))
            session.clear()
            session["user_id"] = user_id
            session.permanent = True
            flash("Cuenta creada. Bienvenido/a.", "ok")
            return redirect(url_for("index"))
    return render_template("register.html", user=None)


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user_id():
        return redirect(url_for("index"))
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        row = get_user_by_email(email)
        if row is None or not check_password_hash(row["password_hash"], password):
            flash("Email o contraseña incorrectos.", "error")
        else:
            session.clear()
            session["user_id"] = row["id"]
            session.permanent = True
            dest = request.args.get("next") or url_for("index")
            if not dest.startswith("/"):
                dest = url_for("index")
            return redirect(dest)
    return render_template("login.html", user=None)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    flash("Sesión cerrada.", "ok")
    return redirect(url_for("login"))


# ------------------------------------------------------------------ API ----
def _parse_points(payload):
    """Valida la lista de coordenadas y calcula la distancia total."""
    points = payload.get("points") or []
    if not isinstance(points, list) or len(points) < 2:
        raise ValueError("La ruta necesita al menos 2 puntos.")
    if len(points) > MAX_POINTS:
        raise ValueError(f"Máximo {MAX_POINTS} puntos por ruta.")

    clean = []
    for p in points:
        try:
            lat, lng = float(p[0]), float(p[1])
        except (TypeError, ValueError, IndexError):
            raise ValueError("Coordenada inválida.")
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError("Coordenada fuera de rango.")
        clean.append([round(lat, 7), round(lng, 7)])

    # Distancia haversine (m). El cliente usa latlng.distanceTo() de Leaflet;
    # este cálculo es el respaldo del servidor para que el total sea consistente.
    total = 0.0
    for (lat1, lng1), (lat2, lng2) in zip(clean, clean[1:]):
        r = 6371000.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lng2 - lng1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        total += 2 * r * math.asin(math.sqrt(a))
    return clean, total


@app.route("/api/routes", methods=["POST"])
@login_required
def api_create_route():
    payload = request.get_json(silent=True) or {}
    kind = payload.get("kind", "manual")
    if kind not in ("manual", "tracking"):
        kind = "manual"
    try:
        points, computed = _parse_points(payload)
        duration_s = max(0, int(float(payload.get("duration_s") or 0)))
        client_distance = float(payload.get("distance_m") or 0)
        distance_m = client_distance if abs(client_distance - computed) < max(50, computed * 0.05) else computed
        route_id = save_route(current_user_id(), kind, points, distance_m, duration_s)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(
        {
            "id": route_id,
            "distance_m": round(distance_m, 1),
            "points": len(points),
            "redirect": url_for("route_detail", route_id=route_id),
        }
    ), 201


@app.route("/api/routes", methods=["GET"])
@login_required
def api_list_routes():
    routes = list_routes(current_user_id())
    return jsonify(
        [
            {
                "id": r["id"],
                "kind": r["kind"],
                "distance_m": r["distance_m"],
                "duration_s": r["duration_s"],
                "created_at": r["created_at"],
                "points": len(r["points"]),
            }
            for r in routes
        ]
    )


@app.route("/api/routes/<int:route_id>", methods=["GET"])
@login_required
def api_get_route(route_id):
    route = get_route(current_user_id(), route_id)
    if route is None:
        return jsonify({"error": "Ruta no encontrada."}), 404
    return jsonify(route)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ----------------------------------------------------------------- error ----
@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "No encontrado."}), 404
    return render_template("404.html", user=None), 404


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True, host="127.0.0.1", port=int(os.environ.get("PORT", "5000")))
