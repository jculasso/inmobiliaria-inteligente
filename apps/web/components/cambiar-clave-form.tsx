'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../lib/supabase/client';
import { cambiarPassword } from '../lib/password-api';

const MINIMO = 8;

/**
 * Elección de contraseña propia. Se usa en dos situaciones:
 *  - `obligatorio`: la clave la puso el implementador y hay que reemplazarla
 *    (primer ingreso o reseteo). No se pide la actual: la persona acaba de
 *    entrar con ella.
 *  - voluntario: cambio desde el perfil, pidiendo la contraseña actual.
 */
export function CambiarClaveForm({ obligatorio }: { obligatorio: boolean }) {
  const router = useRouter();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nueva.length < MINIMO) {
      setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`);
      return;
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await cambiarPassword(await getAccessToken(), {
        passwordNueva: nueva,
        ...(obligatorio ? {} : { passwordActual: actual }),
      });
      setListo(true);
      // `refresh` revalida el perfil en el server: sin esto el usuario seguiría
      // rebotando a esta pantalla con la marca vieja.
      router.refresh();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {!obligatorio && (
        <Campo label="Contraseña actual">
          <input
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </Campo>
      )}

      <Campo label="Contraseña nueva" hint={`Mínimo ${MINIMO} caracteres.`}>
        <input
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          required
          minLength={MINIMO}
          autoComplete="new-password"
          className={inputClass}
        />
      </Campo>

      <Campo label="Repetí la contraseña nueva">
        <input
          type="password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </Campo>

      {error && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={loading || listo}>
        {listo ? 'Listo ✓' : loading ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  );
}

const inputClass =
  'h-10 w-full rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red';

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
