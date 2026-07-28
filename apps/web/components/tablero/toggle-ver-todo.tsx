'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Check "Ver todo": expande la pantalla del trabajo propio al alcance máximo
 * que habilita el rol —dirección a toda la inmobiliaria, team leader a su
 * equipo— vía el query param `verTodo`. No cambia el rol real.
 *
 * Hasta el 28/07/2026 era al revés: el check decía "Ver solo lo mío" y
 * achicaba desde todo. Se invirtió para que cada uno entre viendo lo suyo.
 *
 * Estado optimista + useTransition: el check se marca al instante (el navigate
 * hace un round-trip al server) y el spinner indica que está actualizando.
 */
export function ToggleVerTodo() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const propActivo = searchParams.get('verTodo') === '1';
  const [activo, setActivo] = useState(propActivo);
  useEffect(() => {
    setActivo(propActivo);
  }, [propActivo]);

  function toggle() {
    const next = !activo;
    setActivo(next); // marca al instante
    const params = new URLSearchParams(searchParams);
    if (next) params.set('verTodo', '1');
    else params.delete('verTodo');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-ink transition-opacity ${
        isPending ? 'opacity-60' : ''
      }`}
    >
      <input type="checkbox" checked={activo} onChange={toggle} className="accent-brand-red" />
      Ver todo
      {/* Siempre montado y solo invisible: montarlo al vuelo agregaba ancho a
          la fila y hacía saltar todo lo que tiene al lado. */}
      <span
        aria-hidden
        className={`h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand-red ${
          isPending ? '' : 'invisible'
        }`}
      />
    </label>
  );
}
