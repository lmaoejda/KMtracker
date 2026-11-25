import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { routes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, id), eq(routes.userId, user.id)))
    .limit(1);

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    kind: row.kind,
    points: row.points,
    distance_m: row.distanceM,
    duration_s: row.durationS,
    created_at: row.createdAt,
  });
}
