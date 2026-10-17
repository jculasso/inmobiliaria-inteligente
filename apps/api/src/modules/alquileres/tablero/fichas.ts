import type { Prisma } from '@prisma/client';
import type { FilaTablero, MonedaAlquiler } from '@vacker/types';
import { alquilerDeHoy, diasInclusive, proximoCambio } from '@vacker/domain';
import { decToNum, fromDate } from '../../tablero/tablero.util';
import { aContrato } from './comun';

/** Lo que se lee de cada contrato, para contar la cartera y para que cada fila del detalle sirva. */
export const SELECT_CONTRATO = {
  id: true,
  codigo: true,
  estado: true,
  tipo: true,
  moneda: true,
  ajuste: true,
  inicio: true,
  fin: true,
  rescindidoEl: true,
  depositoImporte: true,
  depositoDevolucion: true,
  propiedad: { select: { direccion: true, unidad: true } },
  partes: { select: { personaId: true, papel: true, persona: { select: { nombre: true } } } },
  tramos: {
    select: { numero: true, desde: true, importe: true },
    orderBy: { numero: 'asc' },
  },
  documentos: { select: { estadoFirma: true } },
} satisfies Prisma.AlqContratoSelect;
export type ContratoLeido = Prisma.AlqContratoGetPayload<{ select: typeof SELECT_CONTRATO }>;

export const ORDEN_CONTRATOS = [
  { codigoNum: 'asc' },
  { codigo: 'asc' },
] satisfies Prisma.AlqContratoOrderByWithRelationInput[];

export const tramosDe = (c: ContratoLeido) =>
  c.tramos.map((t) => ({
    numero: t.numero,
    desde: fromDate(t.desde)!,
    importe: t.importe == null ? null : decToNum(t.importe),
  }));

/**
 * Lo que se sabe de cada contrato, para que cada fila del detalle sirva
 * (Javier, 6/10/2026: «Propietario, Inquilino, Importe Alquiler vigente,
 * cuando indexa, cuando vence»). Todo sale de lo ya leído: ninguna consulta más.
 */
export function fichas(contratos: ContratoLeido[], hoy: string) {
  const porId = new Map(contratos.map((c) => [c.id, c]));
  const nombresDe = (c: ContratoLeido, papel: string) =>
    c.partes
      .filter((p) => p.papel === papel)
      .map((p) => p.persona.nombre)
      .join(', ') || null;
  const direccionDe = (c: ContratoLeido) =>
    [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' ');
  // Las mismas definiciones que la lista de contratos (@vacker/domain).
  const importeDeHoy = (c: ContratoLeido) => alquilerDeHoy(tramosDe(c), hoy);
  const terminaEl = (c: ContratoLeido) => fromDate(c.rescindidoEl ?? c.fin)!;
  const vacia = { detalle: '', fecha: null, importe: null, dias: null, estado: null };
  const datosDe = (c: ContratoLeido | undefined) =>
    c
      ? {
          contrato: c.codigo,
          propiedad: direccionDe(c),
          inquilino: nombresDe(c, 'inquilino'),
          propietario: nombresDe(c, 'propietario'),
          persona: nombresDe(c, 'inquilino'),
          moneda: c.moneda as MonedaAlquiler,
          alquiler: importeDeHoy(c),
          indexa: c.estado === 'vigente' ? proximoCambio(tramosDe(c), hoy) : null,
          vence: terminaEl(c),
        }
      : {
          contrato: null,
          propiedad: null,
          inquilino: null,
          propietario: null,
          persona: null,
          moneda: null,
          alquiler: null,
          indexa: null,
          vence: null,
        };
  const filaContrato = (c: ContratoLeido, extra: Partial<FilaTablero> = {}): FilaTablero => ({
    id: c.id,
    href: aContrato(c.id),
    ...vacia,
    ...datosDe(c),
    ...extra,
  });
  /** Una fila de algo de un contrato (un concepto, un reclamo): los datos del contrato y lo propio. */
  const filaDe = (
    contratoId: string | null,
    extra: Partial<FilaTablero> & { id: string; href: string | null },
  ): FilaTablero => ({
    ...vacia,
    ...datosDe(contratoId ? porId.get(contratoId) : undefined),
    ...extra,
  });
  const diasHasta = (iso: string) => diasInclusive(hoy, iso) - 1;
  return { vacia, datosDe, filaContrato, filaDe, importeDeHoy, terminaEl, diasHasta };
}
export type Fichas = ReturnType<typeof fichas>;
