'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DIR_ORDEN_DEFAULT,
  ORDEN_OPERACION_DEFAULT,
  type DirOrden,
  type OrdenOperacion,
} from '@vacker/types';

/**
 * Encabezado de columna que ordena el listado al hacer click.
 *
 * El orden se resuelve en la BASE, no acá, porque el listado viene recortado a
 * las primeras 500 filas: ordenar en el navegador ordenaría solo ese recorte y
 * mostraría "las 500 más nuevas ordenadas por precio", que no es lo que se
 * pidió. Por eso el click navega con `?orden=…&dir=…` y el server vuelve a
 * consultar.
 *
 * Click sobre la columna que ya está activa → invierte el sentido. Click sobre
 * otra columna → la activa en el sentido por defecto de la pantalla
 * (descendente: lo más nuevo y lo más reciente arriba, que es lo que se mira).
 */
export function EncabezadoOrdenable({
  columna,
  children,
}: {
  columna: OrdenOperacion;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const ordenActual = (searchParams.get('orden') as OrdenOperacion | null) ?? ORDEN_OPERACION_DEFAULT;
  const dirActual = (searchParams.get('dir') as DirOrden | null) ?? DIR_ORDEN_DEFAULT;
  const activa = ordenActual === columna;
  const proximaDir: DirOrden = activa && dirActual === 'desc' ? 'asc' : 'desc';

  function ordenar() {
    const params = new URLSearchParams(searchParams);
    params.set('orden', columna);
    params.set('dir', proximaDir);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={ordenar}
        // El lector de pantalla necesita saber el estado actual y qué va a
        // pasar; la flechita sola no se lo dice.
        aria-label={`Ordenar por ${String(children)} ${
          proximaDir === 'asc' ? 'de menor a mayor' : 'de mayor a menor'
        }`}
        className={`-mx-1 flex items-center gap-1 rounded px-1 py-0.5 font-semibold uppercase tracking-wide transition-colors hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 ${
          activa ? 'text-brand-red' : 'text-muted'
        } ${isPending ? 'opacity-60' : ''}`}
      >
        {children}
        {/* La flecha del inactivo se mantiene en el DOM y solo se atenúa: si
            apareciera al activarse, la columna cambiaría de ancho y toda la
            tabla se correría de costado con cada click. */}
        <span aria-hidden className={activa ? '' : 'opacity-25'}>
          {activa && dirActual === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}
