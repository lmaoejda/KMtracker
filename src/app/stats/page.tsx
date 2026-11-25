import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { Topbar } from "@/components/Topbar";
import { db } from "@/db";
import { routes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estadísticas" };

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

const km = (m: number) => (m / 1000).toFixed(2);
const mmss = (s: number) =>
  s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—";

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(routes)
    .where(eq(routes.userId, user.id))
    .orderBy(desc(routes.createdAt));

  const totalM = rows.reduce((sum, r) => sum + (r.distanceM || 0), 0);
  const totalKm = totalM / 1000;
  const avgKm = rows.length ? totalKm / rows.length : 0;

  return (
    <>
      <Topbar user={user} />
      <main className="page">
        <header className="page__hero" style={{ backgroundImage: "url('/images/trail.jpg')" }}>
          <p className="label">Bitácora de {user.email}</p>
          <h1>Estadísticas</h1>
        </header>

        <section className="stats">
          <div className="stat">
            <p className="label">Rutas guardadas</p>
            <p className="value value--sm">{rows.length}</p>
          </div>
          <div className="stat">
            <p className="label">Kilómetros históricos</p>
            <p className="value value--sm">
              {totalKm.toFixed(2)}
              <span className="unit">km</span>
            </p>
          </div>
          <div className="stat">
            <p className="label">Distancia media / ruta</p>
            <p className="value value--sm">
              {avgKm.toFixed(2)}
              <span className="unit">km</span>
            </p>
          </div>
        </section>

        <section className="table">
          <div className="table__head">
            <p className="label">Fecha</p>
            <p className="label">Tipo</p>
            <p className="label">Puntos</p>
            <p className="label">Duración</p>
            <p className="label num">Distancia</p>
            <p className="label">Mapa</p>
          </div>

          {rows.length === 0 ? (
            <div className="table__empty">
              <p>Todavía no has guardado ninguna ruta.</p>
              <a className="btn accent" href="/">
                Marcar la primera ruta
              </a>
            </div>
          ) : (
            rows.map((r) => (
              <a className="table__row" href={`/routes/${r.id}`} key={r.id}>
                <p className="mono">{dateFmt.format(new Date(r.createdAt))}</p>
                <p>
                  <span className={`tag ${r.kind}`}>
                    {r.kind === "tracking" ? "GPS" : "Manual"}
                  </span>
                </p>
                <p className="mono cell-hide">{Array.isArray(r.points) ? r.points.length : 0}</p>
                <p className="mono cell-hide">{mmss(r.durationS)}</p>
                <p className="mono num strong">
                  {km(r.distanceM)} km
                </p>
                <p className="arrow">Ver →</p>
              </a>
            ))
          )}
        </section>
      </main>
    </>
  );
}
