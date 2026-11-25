import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { routes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { parsePoints } from "@/lib/geo";

/** GET /api/routes -> rutas del usuario autenticado */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const rows = await db
    .select({
      id: routes.id,
      kind: routes.kind,
      distanceM: routes.distanceM,
      durationS: routes.durationS,
      createdAt: routes.createdAt,
      pointsCount: routes.points,
    })
    .from(routes)
    .where(eq(routes.userId, user.id))
    .orderBy(desc(routes.createdAt));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      distance_m: r.distanceM,
      duration_s: r.durationS,
      created_at: r.createdAt,
      points: Array.isArray(r.pointsCount) ? r.pointsCount.length : 0,
    })),
  );
}

/** POST /api/routes -> guarda una ruta del usuario autenticado */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === "tracking" ? "tracking" : "manual";

  let parsed;
  try {
    parsed = parsePoints(body?.points);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ruta inválida." },
      { status: 400 },
    );
  }

  const clientDistance = Number(body?.distance_m);
  const durationS = Math.max(0, Math.round(Number(body?.duration_s) || 0));
  const tolerance = Math.max(50, parsed.distanceM * 0.05);
  const distanceM =
    Number.isFinite(clientDistance) && Math.abs(clientDistance - parsed.distanceM) < tolerance
      ? clientDistance
      : parsed.distanceM;

  const [row] = await db
    .insert(routes)
    .values({
      userId: user.id,
      kind,
      points: parsed.points,
      distanceM: Math.round(distanceM * 10) / 10,
      durationS,
    })
    .returning({ id: routes.id });

  return NextResponse.json(
    { id: row.id, distance_m: distanceM, points: parsed.points.length },
    { status: 201 },
  );
}
