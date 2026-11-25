"""Capa de datos SQLite (fácil de migrar a PostgreSQL, ver README.md)."""
import json
import os
import sqlite3

from flask import current_app, g

DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tracking.db")


def get_db():
    """Una conexión por request, reutilizada vía `g`."""
    if "db" not in g:
        path = current_app.config["DATABASE_PATH"]
        g.db = sqlite3.connect(path)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT    NOT NULL,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS routes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            kind       TEXT    NOT NULL DEFAULT 'manual',   -- 'manual' | 'tracking'
            points     TEXT    NOT NULL DEFAULT '[]',       -- JSON: [[lat, lng], ...]
            distance_m REAL    NOT NULL DEFAULT 0,
            duration_s INTEGER NOT NULL DEFAULT 0,
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_routes_user ON routes (user_id, created_at DESC);
        """
    )
    db.commit()


# ---------------------------------------------------------------- helpers ----
def create_user(email, password_hash):
    db = get_db()
    cur = db.execute(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        (email, password_hash),
    )
    db.commit()
    return cur.lastrowid


def get_user_by_email(email):
    return get_db().execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def get_user(user_id):
    return get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def save_route(user_id, kind, points, distance_m, duration_s=0):
    db = get_db()
    cur = db.execute(
        """INSERT INTO routes (user_id, kind, points, distance_m, duration_s)
           VALUES (?, ?, ?, ?, ?)""",
        (user_id, kind, json.dumps(points), float(distance_m), int(duration_s)),
    )
    db.commit()
    return cur.lastrowid


def list_routes(user_id):
    rows = get_db().execute(
        """SELECT id, kind, distance_m, duration_s, created_at, points
             FROM routes WHERE user_id = ? ORDER BY created_at DESC, id DESC""",
        (user_id,),
    ).fetchall()
    return [dict(r, points=json.loads(r["points"])) for r in rows]


def get_route(user_id, route_id):
    row = get_db().execute(
        "SELECT * FROM routes WHERE id = ? AND user_id = ?",
        (route_id, user_id),
    ).fetchone()
    if row is None:
        return None
    data = dict(row)
    data["points"] = json.loads(data["points"])
    return data


def route_stats(user_id):
    row = get_db().execute(
        """SELECT COUNT(*) AS total, COALESCE(SUM(distance_m), 0) AS meters
             FROM routes WHERE user_id = ?""",
        (user_id,),
    ).fetchone()
    return {"total": row["total"], "meters": row["meters"]}
