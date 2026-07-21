'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@vacker/ui';

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

/** El mes siempre está seleccionado (como el prototipo): "año completo" se
 * elige con el tab "Acumulado Anual" del Resumen, no con "todos los meses". */
export function FiltroPeriodo({ anio, mes }: { anio: number; mes: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoy = new Date();
  const anios = [hoy.getFullYear() + 1, hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2];

  function actualizar(next: { anio?: number; mes?: number }) {
    const params = new URLSearchParams(searchParams);
    if (next.anio !== undefined) params.set('anio', String(next.anio));
    if (next.mes !== undefined) params.set('mes', String(next.mes));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
        value={mes}
        onChange={(e) => actualizar({ mes: Number(e.target.value) })}
        className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink"
      >
        {MESES.map((nombre, i) => (
          <option key={nombre} value={i + 1}>
            {nombre}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => actualizar({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 })}
      >
        Hoy
      </Button>
    </div>
  );
}
