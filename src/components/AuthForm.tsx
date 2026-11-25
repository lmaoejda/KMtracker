"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo completar la operación.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <main className="auth">
      <div
        className="auth__art"
        style={{ backgroundImage: "url('/images/instrument.jpg')" }}
        role="img"
        aria-label="Brújula y GPS sobre un mapa topográfico"
      >
        <div className="auth__quote">
          <p className="label">{isRegister ? "Alta de usuario" : "Bitácora de campo"}</p>
          <p>
            {isRegister
              ? "Tus rutas, tus datos. Nadie más ve tu bitácora."
              : "Cada tramo registrado, cada kilómetro tuyo."}
          </p>
        </div>
      </div>

      <form className="auth__panel" onSubmit={submit} noValidate>
        <p className="label">{isRegister ? "Registro" : "Acceso"}</p>
        <h1>{isRegister ? "Crea tu cuenta" : "Entra a tu bitácora"}</h1>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">
          Contraseña {!isRegister && <span className="hint">(mín. 8 caracteres)</span>}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={8}
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isRegister && (
          <>
            <label htmlFor="confirm">Repite la contraseña</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? "Un momento…" : isRegister ? "Crear cuenta" : "Iniciar sesión"}
        </button>

        <p className="alt">
          {isRegister ? (
            <>
              ¿Ya tienes cuenta? <a href="/login">Entra</a>
            </>
          ) : (
            <>
              ¿Aún no tienes cuenta? <a href="/register">Regístrate</a>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
