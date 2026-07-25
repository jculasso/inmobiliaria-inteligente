'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@vacker/ui';
import { createClient } from '../../lib/supabase/client';
import { OlvideClave } from './olvide-clave';

/** Ruta a la que volver tras loguear (ver middleware.ts: ?redirect= es el destino original, ej. /admin, antes de rebotar a la Home). Solo se acepta un path relativo propio, para no habilitar un open redirect. */
function destinoTrasLogin(searchParams: URLSearchParams): string | null {
  const redirect = searchParams.get('redirect');
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) return redirect;
  return null;
}

/** Formulario de login embebido en la Home (ver components/home-view.tsx, modo invitado). */
/** Último email que inició sesión bien en este dispositivo. Nunca la clave. */
const CLAVE_ULTIMO_EMAIL = 'ultimo-email';

export function LoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [emailRecordado, setEmailRecordado] = useState(false);
  const [password, setPassword] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  // Se recuerda el último email que entró bien: en el celular escribir la
  // dirección entera cada vez es la parte más molesta del ingreso. La clave
  // NO se guarda nunca — de eso se encarga el llavero del teléfono.
  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_ULTIMO_EMAIL);
    if (!guardado) return;
    setEmail(guardado);
    setEmailRecordado(true);
    // El foco va directo a la clave, que es lo único que queda por escribir.
    passwordRef.current?.focus();
  }, []);

  /** "No soy yo": limpia el email recordado y deja el formulario en blanco. */
  function olvidarEmail() {
    localStorage.removeItem(CLAVE_ULTIMO_EMAIL);
    setEmail('');
    setEmailRecordado(false);
  }
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Distinto de `loading`: el login en sí (contra Supabase Auth) es rápido,
  // pero el refresh() que sigue le pega a nuestra API — con el free tier de
  // Render (cold start) esa espera puede notarse. Sin este estado, el
  // formulario se quedaba en "Ingresando…" sin ninguna pista de qué se
  // estaba esperando.
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

    localStorage.setItem(CLAVE_ULTIMO_EMAIL, email.trim());
    setSesionIniciada(true);
    const destino = destinoTrasLogin(searchParams);
    if (destino) {
      // Venías de una ruta protegida (ej. /admin) que te rebotó a loguearte acá — te manda de vuelta.
      router.push(destino);
    } else {
      // Ya estamos en "/": re-renderiza el Server Component con la sesión nueva.
      router.refresh();
    }
  }

  if (sesionIniciada) {
    return (
      <div className="relative overflow-hidden rounded-brand border border-line bg-white p-7 shadow-sm">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-red to-brand-red-dark"
        />
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-red"
          />
          <p className="text-sm font-semibold text-ink">Cargando tu cuenta…</p>
          <p className="text-xs text-muted">Puede tardar unos segundos si el servidor estaba inactivo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-brand border border-line bg-white p-7 shadow-sm">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-red to-brand-red-dark"
      />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Acceso</p>
      <h2 className="mt-1 text-xl font-extrabold text-ink">Iniciar sesión</h2>
      <p className="mt-1 text-sm text-muted">Accedé con tu cuenta para desbloquear los módulos de tu inmobiliaria.</p>

      <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              Email
            </label>
            {emailRecordado && (
              <button
                type="button"
                onClick={olvidarEmail}
                className="text-xs font-semibold text-muted hover:text-brand-red hover:underline"
              >
                No soy yo
              </button>
            )}
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Clave
          </label>
          <div className="relative">
            <input
              ref={passwordRef}
              id="password"
              name="password"
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

      <OlvideClave />
    </div>
  );
}
