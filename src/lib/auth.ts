import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE_NAME = "rv_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días
const SECRET = process.env.SESSION_SECRET ?? "ruta-viva-dev-session-secret";

/* ------------------------------------------------------------- passwords -- */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/* -------------------------------------------------------------- sessions -- */
function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 48);
}

export async function createSession(userId: number): Promise<void> {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    // En producción real conviene `true` (solo HTTPS). Se deja configurable para
    // que la sesión funcione también en despliegues de prueba sobre HTTP.
    secure: process.env.COOKIE_SECURE === "1",
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, mac] = parts;
  const payload = `${userId}.${exp}`;
  if (mac !== sign(payload)) return null;
  if (Number(exp) < Date.now()) return null;
  const id = Number(userId);
  return Number.isFinite(id) ? id : null;
}

export type SessionUser = { id: number; email: string };

/** Devuelve el usuario de la sesión o null (no lanza). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = await getSessionUserId();
  if (id === null) return null;
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}
