'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vacker/ui';
import { createClient } from '../../lib/supabase/client';

/** Formulario de login embebido en la Home (ver components/home-view.tsx, modo invitado). */
export function LoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    // Ya estamos en "/": re-renderiza el Server Component con la sesión nueva.
    router.refresh();
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
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
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
              id="password"
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
    </div>
  );
}
