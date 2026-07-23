'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vacker/ui';
import { createClient } from '../../lib/supabase/client';

/**
 * Pantalla de login propia de /admin. A diferencia del login de la Home
 * (components/home/login-panel.tsx), no rebota por la Home ni usa ?redirect=:
 * siempre aterriza en /admin. Cuando no hay sesión, admin/layout.tsx la
 * renderiza en lugar de mandar a la Home. El chequeo de rol admin_plataforma
 * lo sigue haciendo el layout (server-side) una vez que hay sesión.
 */
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // El login contra Supabase Auth es rápido, pero el refresh() que sigue vuelve
  // a correr el layout (server) que le pega a /me — con Render en free tier
  // (cold start) esa espera se nota. Sin este estado se quedaba en "Ingresando…".
  const [sesionIniciada, setSesionIniciada] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Email o clave incorrectos.');
      setLoading(false);
      return;
    }

    setSesionIniciada(true);
    // Ya estamos en /admin: re-renderiza el Server Component (layout) con la
    // sesión nueva, que valida el rol admin_plataforma y muestra el panel.
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="relative w-full overflow-hidden rounded-brand border border-line bg-white p-7 shadow-sm">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-red to-brand-red-dark"
        />

        {sesionIniciada ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div
              aria-hidden
              className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-red"
            />
            <p className="text-sm font-semibold text-ink">Cargando el panel…</p>
            <p className="text-xs text-muted">Puede tardar unos segundos si el servidor estaba inactivo.</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Administración</p>
            <h1 className="mt-1 text-xl font-extrabold text-ink">Panel de plataforma</h1>
            <p className="mt-1 text-sm text-muted">Acceso reservado al administrador de la plataforma.</p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-email" className="text-sm font-medium text-ink">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-password" className="text-sm font-medium text-ink">
                  Clave
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={mostrarClave ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-brand border border-line px-3 pr-10 text-sm text-ink outline-none focus:border-brand-red"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarClave((v) => !v)}
                    aria-label={mostrarClave ? 'Ocultar clave' : 'Mostrar clave'}
                    aria-pressed={mostrarClave}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink"
                  >
                    {mostrarClave ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm font-medium text-brand-red">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" disabled={loading} className="mt-1">
                {loading ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
