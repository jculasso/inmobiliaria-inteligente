'use client';

import {
  DIAS_TABLERO_PROXIMOS,
  type Indicador,
  type MonedaAlquiler,
  type TableroAlquileresDto,
} from '@vacker/types';
import { Card } from '@vacker/ui';
import { CLASE_FOCO, TituloSeccion } from '../piezas';
import { fmtTotales, totalesPorMoneda } from './formatos';
import { VISTAS, type Abrir, type Columna, type Detalle } from './vistas';

type Tarea = {
  icono: string;
  titulo: string;
  ind: Indicador;
  columnas: [Columna, string][];
  total?: MonedaAlquiler;
  accion?: Detalle['accion'];
};

/**
 * Regla 7: la próxima indexación de estos contratos ya pasó pero espera el
 * índice; en las listas no se pinta «vencida». Sale de la tarea, que es a hoy.
 */
export function contratosQueEsperanElIndice(t: TableroAlquileresDto) {
  return new Set(
    t.tareas.indexacionesEsperan.filas.map((f) => f.contrato).filter((c): c is string => !!c),
  );
}

/** Cada tarea de «Lo que hay que hacer», en el orden en que se muestran. */
function tareasDe(t: TableroAlquileresDto): Tarea[] {
  const aIndexar = { href: '/alquileres/indexaciones', texto: 'Ir a indexar' };
  return [
    {
      icono: '⏰',
      titulo: 'Indexaciones vencidas',
      ind: t.tareas.indexacionesVencidas,
      columnas: VISTAS.indexaciones,
      accion: aIndexar,
    },
    {
      icono: '⏳',
      // Regla 7: ya empezaron y esperan un índice que no salió. No son vencidas:
      // mientras tanto el mes se cobra como liquidación parcial (regla 130).
      titulo: 'Indexaciones que esperan el índice',
      ind: t.tareas.indexacionesEsperan,
      columnas: VISTAS.indexaciones,
      accion: aIndexar,
    },
    {
      icono: '📈',
      titulo: `Indexaciones de los próximos ${DIAS_TABLERO_PROXIMOS} días`,
      ind: t.tareas.indexacionesProximas,
      columnas: VISTAS.indexaciones,
      accion: aIndexar,
    },
    {
      icono: '🧮',
      // Regla 139: la diferencia de cada mes cobrado como parcial, hasta que se pague.
      titulo: 'Liquidaciones finales pendientes de cobro',
      ind: t.tareas.finalesPendientes,
      columnas: VISTAS.finales,
      total: 'ARS',
      accion: { href: '/alquileres/cobros/nuevo', texto: 'Ir a cobrar' },
    },
    {
      icono: '🪜',
      titulo: `Escalones que empiezan en los próximos ${DIAS_TABLERO_PROXIMOS} días`,
      ind: t.tareas.escalones,
      columnas: VISTAS.escalones,
    },
    ...t.tareas.vencen.map((v) => ({
      icono: '📅',
      titulo:
        v.dias === 30
          ? 'Contratos vencidos o que vencen en 30 días'
          : `Contratos que vencen ${v.dias === 60 ? 'entre 31 y 60 días' : 'entre 61 y 90 días'}`,
      ind: v.indicador,
      columnas: VISTAS.vencen,
    })),
    {
      icono: '🔐',
      titulo: 'Depósitos a devolver',
      ind: t.tareas.depositos,
      columnas: VISTAS.depositos,
    },
    {
      icono: '🧾',
      titulo: 'Propietarios para liquidar',
      ind: t.tareas.liquidaciones,
      columnas: VISTAS.liquidaciones,
      total: 'ARS',
      accion: { href: '/alquileres/liquidaciones/nueva', texto: 'Ir a liquidar' },
    },
    {
      icono: '⚠️',
      titulo: 'Inquilinos con deuda de más de 30 días',
      ind: t.tareas.deudores,
      columnas: VISTAS.deudores,
      total: 'ARS',
      accion: { href: '/alquileres/cobros/nuevo', texto: 'Ir a cobrar' },
    },
    {
      icono: '✍️',
      titulo: 'Contratos vigentes sin el firmado cargado',
      ind: t.tareas.sinFirmar,
      columnas: VISTAS.sinFirmar,
    },
    {
      icono: '🛠️',
      titulo: 'Reclamos abiertos',
      ind: t.tareas.reclamos,
      columnas: VISTAS.reclamos,
      accion: { href: '/alquileres/reclamos', texto: 'Ir a reclamos' },
    },
    {
      icono: '🛡️',
      titulo: `Pólizas vencidas o que vencen en ${DIAS_TABLERO_PROXIMOS} días`,
      ind: t.tareas.polizas,
      columnas: VISTAS.polizas,
    },
    {
      icono: '💸',
      titulo: 'Boletas que paga la inmobiliaria, vencidas o a 7 días',
      ind: t.tareas.boletas,
      columnas: VISTAS.boletas,
      total: 'ARS',
      accion: { href: '/alquileres/impuestos?ver=pagar', texto: 'Ir a «Para pagar»' },
    },
    // Regla 166: las reservas, antes de que se pierdan o de que el contrato se demore.
    {
      icono: '🔖',
      titulo: 'Reservas que vencen en 7 días o ya vencidas',
      ind: t.tareas.reservasPorVencer,
      columnas: VISTAS.reservas,
      accion: { href: '/alquileres/reservas', texto: 'Ir a reservas' },
    },
    {
      icono: '🤝',
      titulo: 'Reservas aprobadas sin contrato',
      ind: t.tareas.reservasAprobadas,
      columnas: VISTAS.reservas,
      accion: { href: '/alquileres/reservas?estado=aprobada', texto: 'Ir a reservas' },
    },
  ];
}

/** Lo que hay que hacer: cada tarea con cuántas son, y tocarla abre la lista. */
export function LoQueHayQueHacer({ t, abrir }: { t: TableroAlquileresDto; abrir: Abrir }) {
  const tareas = tareasDe(t);
  return (
    <section className="flex flex-col gap-2">
      {/* Regla 78: lo que hay que hacer es siempre de hoy; no sigue al período. */}
      <TituloSeccion icono="✅" detalle="a hoy · tocá una para ver cuáles">
        Lo que hay que hacer
      </TituloSeccion>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {tareas.map((x) => {
            const importes = x.total ? totalesPorMoneda(x.ind.filas, x.total) : null;
            return (
              <li key={x.titulo}>
                <button
                  type="button"
                  onClick={abrir(x.titulo, x.ind, x.columnas, {
                    total: x.total,
                    accion: x.accion,
                  })}
                  disabled={x.ind.valor === 0}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm enabled:hover:bg-surface/60 disabled:cursor-default ${CLASE_FOCO}`}
                >
                  <span className={x.ind.valor === 0 ? 'text-muted' : 'text-ink'}>
                    <span aria-hidden className="mr-1.5">
                      {x.icono}
                    </span>
                    {x.titulo}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {importes && x.total && (importes.ARS !== 0 || importes.USD !== 0) && (
                      <span className="hidden whitespace-nowrap text-xs tabular-nums text-muted sm:inline">
                        {fmtTotales(importes, x.total)}
                      </span>
                    )}
                    <span
                      className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${x.ind.valor === 0 ? 'bg-surface text-muted' : 'bg-warning/15 text-warning'}`}
                    >
                      {x.ind.filas.length}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
