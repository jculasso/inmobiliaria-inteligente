'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DirOrden, OrdenOperacion } from '@vacker/types';

interface Props {
  columna: OrdenOperacion;
  /** Clases extra para el <th> (p. ej. dejarlo fijo al desplazar). */
  thClass?: string;
  /** Si esta columna es por la que se está ordenando ahora. */
  activa: boolean;
  dir: DirOrden;
  /**
   * `true` cuando la lista vino completa y se puede reordenar sin ir al
   * servidor. `false` cuando quedó recortada: ahí hay que volver a consultar,
   * porque ordenar lo que bajó daría las 500 equivocadas.
   */
  enMemoria: boolean;
  onOrdenar: (v: { orden: OrdenOperacion; dir: DirOrden }) => void;
  children: React.ReactNode;
}

/**
 * Encabezado de columna que ordena la tabla al hacer click.
 *
 * Click sobre la columna activa → invierte el sentido. Click sobre otra →
 * la activa en descendente, que es lo que se quiere mirar: el número más alto
 * y la firma más reciente arriba.
 */
export function EncabezadoOrdenable({ columna, activa, dir, enMemoria, onOrdenar, thClass = '', children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const proximaDir: DirOrden = activa && dir === 'desc' ? 'asc' : 'desc';

  function ordenar() {
    onOrdenar({ orden: columna, dir: proximaDir });
    if (enMemoria) return; // instantáneo: ya están todas las filas acá

    const params = new URLSearchParams(searchParams);
    params.set('orden', columna);
    params.set('dir', proximaDir);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <th className={`px-2 py-2 ${thClass}`}>
      <button
        type="button"
        onClick={ordenar}
        aria-label={`Ordenar por ${String(children)} ${
          proximaDir === 'asc' ? 'de menor a mayor' : 'de mayor a menor'
        }`}
        className={`flex w-full items-center gap-0.5 rounded text-left font-semibold uppercase tracking-wide transition-colors hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 ${
          activa ? 'text-brand-red' : 'text-muted'
        }`}
      >
        {children}
        {/* El indicador ocupa SIEMPRE el mismo lugar: la flecha se reemplaza
            por el spinner mientras se consulta, en vez de sumarse. Si se
            agregara al vuelo, la columna cambiaría de ancho a mitad del click
            y la tabla entera se correría de costado. */}
        <span
          aria-hidden
          className={
            isPending
              ? 'h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand-red'
              : `w-3 shrink-0 text-center text-[10px] leading-none ${activa ? '' : 'opacity-25'}`
          }
        >
          {isPending ? '' : activa && dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}
