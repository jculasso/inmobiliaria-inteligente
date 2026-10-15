import type { Prisma } from '@prisma/client';
import {
  ESTADOS_RESERVA_ABIERTOS,
  NOMBRE_ESTADO_RESERVA,
  type EstadoReserva,
  type FilaTablero,
  type FiltroTipoContrato,
  type Indicador,
} from '@vacker/types';
import { diasInclusive, sumarDiasIso } from '@vacker/domain';
import { decToNum, fromDate } from '../tablero/tablero.util';

/** Regla 166: cuántos días antes del vencimiento avisa el Dashboard. */
export const DIAS_AVISO_RESERVA = 7;

/** Lo que el Dashboard lee de las reservas abiertas: una consulta, con 5 o con 500. */
export const CONSULTA_RESERVAS_TABLERO = {
  where: { estado: { in: [...ESTADOS_RESERVA_ABIERTOS] } },
  select: {
    id: true,
    numero: true,
    estado: true,
    tipo: true,
    vence: true,
    senaImporte: true,
    senaMoneda: true,
    propiedad: { select: { direccion: true, unidad: true } },
    partes: {
      where: { papel: 'inquilino' },
      select: { persona: { select: { nombre: true } } },
      orderBy: { persona: { nombre: 'asc' } },
    },
  },
  orderBy: { vence: 'asc' },
} satisfies Prisma.AlqReservaFindManyArgs;

export type ReservaDelTablero = Prisma.AlqReservaGetPayload<{
  select: (typeof CONSULTA_RESERVAS_TABLERO)['select'];
}>;

/**
 * Regla 166: dos tareas de «Lo que hay que hacer». Las que vencen en 7 días
 * o ya vencieron sin cerrarse, y las aprobadas que todavía no tienen
 * contrato. Siguen al filtro por el tipo de la reserva. Cada fila es una
 * reserva y abre su ficha.
 */
export function tareasDeReservas(
  reservas: ReservaDelTablero[],
  hoy: string,
  tipo: FiltroTipoContrato,
): { reservasPorVencer: Indicador; reservasAprobadas: Indicador } {
  const delTipo = reservas.filter((r) => tipo === 'todos' || r.tipo === tipo);
  const fila = (r: ReservaDelTablero): FilaTablero => {
    const vence = fromDate(r.vence)!;
    const dias = vence < hoy ? -(diasInclusive(vence, hoy) - 1) : diasInclusive(hoy, vence) - 1;
    return {
      id: r.id,
      href: `/alquileres/reservas/${r.id}`,
      contrato: null,
      persona: null,
      detalle: `Reserva ${r.numero}`,
      fecha: vence,
      importe: r.senaImporte != null ? decToNum(r.senaImporte) : null,
      moneda: (r.senaMoneda as FilaTablero['moneda']) ?? null,
      propiedad: [r.propiedad.direccion, r.propiedad.unidad].filter(Boolean).join(' '),
      inquilino: r.partes.map((p) => p.persona.nombre).join(', ') || null,
      propietario: null,
      alquiler: null,
      indexa: null,
      vence,
      dias,
      estado:
        dias < 0
          ? `Vencida hace ${-dias} ${dias === -1 ? 'día' : 'días'}`
          : dias === 0
            ? 'Vence hoy'
            : NOMBRE_ESTADO_RESERVA[r.estado as EstadoReserva],
    };
  };
  const limite = sumarDiasIso(hoy, DIAS_AVISO_RESERVA);
  const porVencer = delTipo.filter((r) => fromDate(r.vence)! <= limite).map(fila);
  const aprobadas = delTipo.filter((r) => r.estado === 'aprobada').map(fila);
  return {
    reservasPorVencer: { valor: porVencer.length, filas: porVencer },
    reservasAprobadas: { valor: aprobadas.length, filas: aprobadas },
  };
}
