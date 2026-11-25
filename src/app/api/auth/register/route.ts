import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { EMAIL_RE } from "@/lib/geo";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const confirm = String(body?.confirm ?? "");

  const fail = (error: string, status = 400) =>
    NextResponse.json({ error }, { status });

  if (!EMAIL_RE.test(email)) return fail("Introduce un email válido.");
  if (password.length < 8) {
    return fail("La contraseña debe tener al menos 8 caracteres.");
  }
  if (password !== confirm) return fail("Las contraseñas no coinciden.");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length) return fail("Ya existe una cuenta con ese email.", 409);

  const [row] = await db
    .insert(users)
    .values({ email, passwordHash: hashPassword(password) })
    .returning({ id: users.id });

  await createSession(row.id);
  return NextResponse.json({ ok: true, email });
}
