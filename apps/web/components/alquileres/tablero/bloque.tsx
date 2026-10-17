import type { ReactNode } from 'react';
import { NOMBRES_MES } from '../../../lib/meses';

/**
 * El título de cada bloque del Dashboard (regla 176), sin ícono (regla 185):
 * el nombre, un detalle en gris y, si el bloque los tiene, sus filtros a la
 * derecha (en el teléfono, abajo).
 */
export function CabezaBloque({
  id,
  titulo,
  detalle,
  children,
}: {
  id: string;
  titulo: string;
  detalle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <h3 id={id} className="text-xs font-extrabold uppercase tracking-wider text-ink">
        {titulo}
      </h3>
      {detalle && <span className="text-xs text-muted">{detalle}</span>}
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const diaDeLaSemana = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay();

/** «jueves 15 de octubre de 2026». Un día calendario, sin zona. */
export function fechaLarga(iso: string) {
  const mes = NOMBRES_MES[Number(iso.slice(5, 7)) - 1]!.toLowerCase();
  return `${DIAS[diaDeLaSemana(iso)]} ${Number(iso.slice(8, 10))} de ${mes} de ${iso.slice(0, 4)}`;
}

/** «lun 5»: el día de la semana, corto, y el número. */
export function diaCorto(iso: string) {
  return `${DIAS[diaDeLaSemana(iso)]!.slice(0, 3)} ${Number(iso.slice(8, 10))}`;
}

/** «octubre», el nombre del mes `AAAA-MM`. */
export const nombreDelMes = (mes: string) =>
  NOMBRES_MES[Number(mes.slice(5, 7)) - 1]!.toLowerCase();
