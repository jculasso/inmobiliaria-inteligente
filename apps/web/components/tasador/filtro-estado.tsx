'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EstadoTasacionSchema } from '@vacker/types';

const ESTADOS = EstadoTasacionSchema.options;

/** Filtro por estado de tasación (con "Todos los estados"), vía query param. */
export function FiltroEstado({ estado }: { estado?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function actualizar(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('estado', value);
    else params.delete('estado');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      aria-label="Estado"
      value={estado ?? ''}
      onChange={(e) => actualizar(e.target.value)}
      className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink"
    >
      <option value="">Todos los estados</option>
      {ESTADOS.map((e) => (
        <option key={e} value={e}>
          {e}
        </option>
      ))}
    </select>
  );
}
