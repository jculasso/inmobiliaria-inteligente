'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Filtro solo por año (con "Todos los años"), como las vistas de Ventas/Alquileres del prototipo. */
export function FiltroAnio({ anio }: { anio?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoy = new Date().getFullYear();
  const anios = [hoy + 1, hoy, hoy - 1, hoy - 2];

  function actualizar(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('anio', value);
    else params.delete('anio');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      aria-label="Año"
      value={anio ?? ''}
      onChange={(e) => actualizar(e.target.value)}
      className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink"
    >
      <option value="">Todos los años</option>
      {anios.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}
