'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '../../lib/supabase/client';

/**
 * Recupero de contraseña. Arranca en modo "pedile al administrador", que
 * funciona sin depender de nada. Cuando la inmobiliaria configure un proveedor
 * de correo en Supabase, se activa el self-service poniendo
 * NEXT_PUBLIC_RECUPERO_POR_EMAIL=1 — sin tocar código.
 *
 * Se deja explícito a propósito: un formulario de "te mandamos un mail" que en
 * realidad no manda nada es peor que no ofrecerlo.
 */
const POR_EMAIL = process.env.NEXT_PUBLIC_RECUPERO_POR_EMAIL === '1';

export function OlvideClave() {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/cambiar-clave`,
      });
      if (err) throw new Error(err.message);
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo.');
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 text-xs font-semibold text-muted hover:text-brand-red hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-brand border border-line bg-surface p-3">
      {!POR_EMAIL ? (
        <p className="text-xs leading-relaxed text-muted">
          Escribile a la persona que administra la plataforma en tu inmobiliaria: puede generarte una
          contraseña temporal en el momento. Cuando entres con ella, el sistema te va a pedir que elijas
          una propia.
        </p>
      ) : enviado ? (
        <p className="text-xs leading-relaxed text-success">
          Listo. Si <strong>{email}</strong> tiene una cuenta, te llega un correo con el enlace para elegir
          una contraseña nueva. Revisá también el correo no deseado.
        </p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={enviar}>
          <label htmlFor="email-recupero" className="text-xs font-medium text-ink">
            Te enviamos un enlace para elegir una contraseña nueva.
          </label>
          <input
            id="email-recupero"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@correo.com"
            className="h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red"
          />
          {error && (
            <p role="alert" className="text-xs font-medium text-brand-red">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-9 rounded-brand bg-brand-red text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="mt-2 text-xs font-semibold text-muted hover:text-ink hover:underline"
      >
        Volver
      </button>
    </div>
  );
}
