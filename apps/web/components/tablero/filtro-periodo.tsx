'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function FiltroPeriodo({ anio, mes }: { anio: number; mes?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoy = new Date().getFullYear();
  const anios = [hoy + 1, hoy, hoy - 1, hoy - 2];

  function actualizar(next: { anio?: number; mes?: number | null }) {
    const params = new URLSearchParams(searchParams);
    if (next.anio !== undefined) params.set('anio', String(next.anio));
    if (next.mes !== undefined) {
      if (next.mes === null) params.delete('mes');
      else params.set('mes', String(next.mes));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Año"
        value={anio}
        onChange={(e) => actualizar({ anio: Number(e.target.value) })}
        className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink"
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select
        aria-label="Mes"
        value={mes ?? ''}
        onChange={(e) => actualizar({ mes: e.target.value ? Number(e.target.value) : null })}
        className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink"
      >
        <option value="">Todos los meses</option>
        {MESES.map((nombre, i) => (
          <option key={nombre} value={i + 1}>
            {nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
