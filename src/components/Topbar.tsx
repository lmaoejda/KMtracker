"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Brand } from "./Brand";

type Props = { user: { id: number; email: string } | null };

export function Topbar({ user }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <a href="/" aria-label="KMtracker — inicio">
        <Brand />
      </a>
      <nav>
        {user ? (
          <>
            <a href="/">Mapa</a>
            <a href="/stats">Estadísticas</a>
            <span className="whoami">{user.email}</span>
            <button className="btn ghost" type="button" onClick={logout} disabled={busy}>
              {busy ? "Saliendo…" : "Salir"}
            </button>
          </>
        ) : (
          <>
            <a href="/login">Entrar</a>
            <a className="btn accent" href="/register">
              Crear cuenta
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
