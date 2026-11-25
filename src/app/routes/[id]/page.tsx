import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { RouteMap } from "@/components/RouteMap";
import { Topbar } from "@/components/Topbar";
import { db } from "@/db";
import { routes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const km = (m: number) => (m / 1000).toFixed(2);
const mmss = (s: number) =>
  s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—";

export default async function RoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();

  const rows = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, id), eq(routes.userId, user.id)))
    .limit(1);

  const route = rows[0];
  if (!route) notFound();

  const points = Array.isArray(route.points) ? route.points : [];

  return (
    <>
      <Topbar user={user} />
      <main className="page">
        <header className="page__sub">
          <div>
            <p className="label">
              {route.kind === "tracking" ? "Seguimiento GPS" : "Ruta manual"} ·{" "}
              {new Intl.DateTimeFormat("es-ES", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(route.createdAt))}
            </p>
            <h1>Ruta #{route.id}</h1>
          </div>

          <div className="page__sub-figures">
            <div>
              <p className="label">Distancia</p>
              <p className="value value--sm">
                {km(route.distanceM)}
                <span className="unit">km</span>
              </p>
            </div>
            <div>
              <p className="label">Puntos</p>
              <p className="value value--sm">{points.length}</p>
            </div>
            <div>
              <p className="label">Duración</p>
              <p className="value value--sm">{mmss(route.durationS)}</p>
            </div>
          </div>

          <a className="btn ghost" href="/stats">
            ← Volver
          </a>
        </header>

        <RouteMap points={points as [number, number][]} />

        <section className="ledger ledger--page">
          <p className="label">Coordenadas registradas</p>
          <ol>
            {points.map((p, i) => (
              <li key={`${p[0]}-${p[1]}-${i}`}>
                {Number(p[0]).toFixed(5)}, {Number(p[1]).toFixed(5)}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
