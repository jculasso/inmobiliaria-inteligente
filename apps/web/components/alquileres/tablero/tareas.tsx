'use client';

import {
  DIAS_TABLERO_PROXIMOS,
  type FilaTablero,
  type Indicador,
  type MonedaAlquiler,
  type TableroAlquileresDto,
} from '@vacker/types';
import { Card } from '@vacker/ui';
import { CLASE_FOCO } from '../piezas';
import { CabezaBloque, nombreDelMes } from './bloque';
import { fmtSinCentavos, fmtTotales, totalesPorMoneda } from './formatos';
import { VISTAS, type Abrir, type Columna, type Detalle } from './vistas';

export interface Tarea {
  titulo: string;
  /** Cómo se nombra en «Al día», cuando está en cero (regla 180): corto, para que sea una línea. */
  corto: string;
  ind: Indicador;
  columnas: [Columna, string][];
  /** Si es una tarea de plata, el renglón muestra el total (regla 180). */
  total?: MonedaAlquiler;
  accion?: Detalle['accion'];
}

export type ClaveGrupo = 'atrasado' | 'porVencer' | 'pendiente';

export interface Grupo {
  clave: ClaveGrupo;
  nombre: string;
  tareas: Tarea[];
}

/**
 * Regla 7: la próxima indexación de estos contratos ya pasó pero espera el
 * índice; en las listas no se pinta «vencida». Sale de la tarea, que es a hoy.
 */
export function contratosQueEsperanElIndice(t: TableroAlquileresDto) {
  return new Set(
    t.tareas.indexacionesEsperan.filas.map((f) => f.contrato).filter((c): c is string => !!c),
  );
}

const porCantidad = (filas: FilaTablero[]): Indicador => ({ valor: filas.length, filas });

/**
 * Regla 179: una tarea que juntaba «vencidas o por vencer», partida por la
 * fecha de cada fila contra hoy —el vencimiento de la boleta, el fin de la
 * póliza, el vencimiento de la reserva, el fin del contrato—. Lo anterior a
 * hoy está atrasado; hoy y lo que viene, por vencer. Cada fila va a una sola
 * de las dos: entre las dos suman exactamente la tarea original.
 */
export function partirPorHoy(ind: Indicador, hoy: string): [Indicador, Indicador] {
  const atrasada = (f: FilaTablero) => (f.fecha ?? f.vence ?? hoy) < hoy;
  return [
    porCantidad(ind.filas.filter(atrasada)),
    porCantidad(ind.filas.filter((f) => !atrasada(f))),
  ];
}

/**
 * Regla 179: «Lo que hay que hacer» en tres grupos, cada uno en su orden
 * fijo, armado con las tareas que manda la API. Las tareas en cero también
 * vienen: la pantalla las nombra en «Al día» (regla 180). «Generar los
 * alquileres del mes siguiente» viene `null` antes de su aviso, y entonces no
 * existe, ni en «Al día» (regla 181).
 */
export function gruposDeTareas(t: TableroAlquileresDto): Grupo[] {
  const x = t.tareas;
  const [boletasVencidas, boletasPorVencer] = partirPorHoy(x.boletas, t.hoy);
  const [polizasVencidas, polizasPorVencer] = partirPorHoy(x.polizas, t.hoy);
  const [reservasVencidas, reservasPorVencer] = partirPorHoy(x.reservasPorVencer, t.hoy);
  const vencen = (dias: 30 | 60 | 90) =>
    x.vencen.find((v) => v.dias === dias)?.indicador ?? porCantidad([]);
  const [plazoCumplido, vencen30] = partirPorHoy(vencen(30), t.hoy);
  const renovaciones = porCantidad([...vencen(60).filas, ...vencen(90).filas]);

  const aIndexar = { href: '/alquileres/indexaciones', texto: 'Ir a indexar' };
  const aPagar = { href: '/alquileres/impuestos?ver=pagar', texto: 'Ir a «Para pagar»' };
  const aReservas = { href: '/alquileres/reservas', texto: 'Ir a reservas' };
  const generar = (mes: string, ind: Indicador): Tarea => ({
    titulo: `Generar los alquileres de ${nombreDelMes(mes)}`,
    corto: `${nombreDelMes(mes)} generado`,
    ind,
    columnas: VISTAS.generar,
    accion: { href: `/alquileres/conceptos?periodo=${mes}`, texto: 'Ir a generar' },
  });
  const siguiente = t.ciclo?.generarSiguiente.mes;

  return [
    {
      clave: 'atrasado',
      nombre: 'Atrasado',
      tareas: [
        generar(t.mes, x.generarMes),
        {
          titulo: 'Indexaciones vencidas',
          corto: 'indexaciones vencidas',
          ind: x.indexacionesVencidas,
          columnas: VISTAS.indexaciones,
          accion: aIndexar,
        },
        {
          titulo: 'Contratos con el plazo cumplido, sin renovar ni terminar',
          corto: 'plazos cumplidos',
          ind: plazoCumplido,
          columnas: VISTAS.vencen,
        },
        {
          titulo: 'Boletas vencidas que paga la inmobiliaria',
          corto: 'boletas vencidas',
          ind: boletasVencidas,
          columnas: VISTAS.boletas,
          total: 'ARS',
          accion: aPagar,
        },
        {
          titulo: 'Pólizas vencidas',
          corto: 'pólizas vencidas',
          ind: polizasVencidas,
          columnas: VISTAS.polizas,
        },
        // Regla 166: la seña va en la lista, pero no se totaliza.
        {
          titulo: 'Reservas vencidas',
          corto: 'reservas vencidas',
          ind: reservasVencidas,
          columnas: VISTAS.reservas,
          accion: aReservas,
        },
      ],
    },
    {
      clave: 'porVencer',
      nombre: 'Por vencer',
      tareas: [
        {
          titulo: 'Boletas que vencen en 7 días',
          corto: 'boletas por vencer',
          ind: boletasPorVencer,
          columnas: VISTAS.boletas,
          total: 'ARS',
          accion: aPagar,
        },
        {
          titulo: 'Reservas que vencen en 7 días',
          corto: 'reservas por vencer',
          ind: reservasPorVencer,
          columnas: VISTAS.reservas,
          accion: aReservas,
        },
        {
          titulo: 'Contratos que vencen en 30 días',
          corto: 'contratos por vencer',
          ind: vencen30,
          columnas: VISTAS.vencen,
        },
        {
          titulo: `Indexaciones de los próximos ${DIAS_TABLERO_PROXIMOS} días`,
          corto: 'indexaciones próximas',
          ind: x.indexacionesProximas,
          columnas: VISTAS.indexaciones,
          accion: aIndexar,
        },
        {
          titulo: `Escalones de los próximos ${DIAS_TABLERO_PROXIMOS} días`,
          corto: 'escalones',
          ind: x.escalones,
          columnas: VISTAS.escalones,
        },
        {
          titulo: `Pólizas que vencen en ${DIAS_TABLERO_PROXIMOS} días`,
          corto: 'pólizas por vencer',
          ind: polizasPorVencer,
          columnas: VISTAS.polizas,
        },
        {
          titulo: 'Renovaciones: contratos que vencen en 31 a 90 días',
          corto: 'renovaciones',
          ind: renovaciones,
          columnas: VISTAS.vencen,
        },
        ...(x.generarSiguiente && siguiente ? [generar(siguiente, x.generarSiguiente)] : []),
      ],
    },
    {
      clave: 'pendiente',
      nombre: 'Pendiente',
      tareas: [
        {
          // Regla 139: la diferencia de cada mes cobrado como parcial, hasta que se pague.
          titulo: 'Diferencias por índice atrasado, sin cobrar',
          corto: 'diferencias por índice',
          ind: x.finalesPendientes,
          columnas: VISTAS.finales,
          total: 'ARS',
          accion: { href: '/alquileres/cobros/nuevo', texto: 'Ir a cobrar' },
        },
        {
          titulo: 'Depósitos a devolver',
          corto: 'depósitos',
          ind: x.depositos,
          columnas: VISTAS.depositos,
        },
        {
          titulo: 'Reservas aprobadas sin contrato',
          corto: 'reservas aprobadas',
          ind: x.reservasAprobadas,
          columnas: VISTAS.reservas,
          accion: { href: '/alquileres/reservas?estado=aprobada', texto: 'Ir a reservas' },
        },
        {
          titulo: 'Reclamos abiertos',
          corto: 'reclamos',
          ind: x.reclamos,
          columnas: VISTAS.reclamos,
          accion: { href: '/alquileres/reclamos', texto: 'Ir a reclamos' },
        },
        {
          // Regla 7: ya empezaron y esperan un índice que no salió. No son vencidas:
          // mientras tanto el mes se cobra como liquidación parcial (regla 130).
          titulo: 'Indexaciones que esperan el índice',
          corto: 'indexaciones que esperan el índice',
          ind: x.indexacionesEsperan,
          columnas: VISTAS.indexaciones,
          accion: aIndexar,
        },
        {
          titulo: 'Contratos sin el firmado cargado',
          corto: 'contratos firmados',
          ind: x.sinFirmar,
          columnas: VISTAS.sinFirmar,
        },
      ],
    },
  ];
}

/** Regla 185: la urgencia de cada grupo, en color (`danger` es lo vencido; nunca la marca). */
const COLOR: Record<ClaveGrupo, { punto: string; cantidad: string }> = {
  atrasado: { punto: 'bg-danger', cantidad: 'bg-danger/10 text-danger' },
  porVencer: { punto: 'bg-warning', cantidad: 'bg-warning/15 text-warning' },
  pendiente: { punto: 'bg-muted', cantidad: 'bg-ink/5 text-muted' },
};

/** «a, b y c»: para la línea «Al día». */
function enUnaLinea(xs: string[]) {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

/**
 * Lo que hay que hacer (reglas 179 y 180): siempre a hoy y de toda la
 * cartera. Solo lo que tiene algo, en tres grupos; lo que está en cero se
 * nombra en «Al día». Tocar un renglón abre su lista, con su acción.
 */
export function LoQueHayQueHacer({ t, abrir }: { t: TableroAlquileresDto; abrir: Abrir }) {
  const grupos = gruposDeTareas(t);
  const conAlgo = grupos
    .map((g) => ({ ...g, tareas: g.tareas.filter((x) => x.ind.filas.length > 0) }))
    .filter((g) => g.tareas.length > 0);
  const alDia = grupos.flatMap((g) => g.tareas.filter((x) => x.ind.filas.length === 0));
  return (
    <section aria-labelledby="bloque-tareas">
      <CabezaBloque
        id="bloque-tareas"
        titulo="Lo que hay que hacer"
        detalle="a hoy · tocá un renglón para ver cuáles"
      />
      {conAlgo.length === 0 ? (
        <Card className="py-4 text-sm font-semibold text-success">Todo al día.</Card>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-3">
          {conAlgo.map((g) => (
            <Card key={g.clave} className="overflow-hidden p-0" data-grupo={g.clave}>
              <h4 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-extrabold text-ink">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${COLOR[g.clave].punto}`}
                />
                {g.nombre}
                <span className="ml-auto font-semibold text-muted">
                  {g.tareas.reduce((s, x) => s + x.ind.filas.length, 0)}
                </span>
              </h4>
              <ul className="divide-y divide-line/70">
                {g.tareas.map((x) => {
                  const importes = x.total ? totalesPorMoneda(x.ind.filas, x.total) : null;
                  return (
                    <li key={x.titulo}>
                      <button
                        type="button"
                        onClick={abrir(x.titulo, x.ind, x.columnas, {
                          total: x.total,
                          accion: x.accion,
                        })}
                        className={`flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-surface/60 ${CLASE_FOCO}`}
                      >
                        <span className="min-w-0 flex-1">{x.titulo}</span>
                        {importes && x.total && (importes.ARS !== 0 || importes.USD !== 0) && (
                          <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                            {fmtTotales(importes, x.total, fmtSinCentavos)}
                          </span>
                        )}
                        <span
                          className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-extrabold tabular-nums ${COLOR[g.clave].cantidad}`}
                        >
                          {x.ind.filas.length}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {conAlgo.length > 0 && alDia.length > 0 && (
        <p className="mt-2.5 text-xs text-muted">
          <span className="font-bold text-success">Al día:</span>{' '}
          {enUnaLinea(alDia.map((x) => x.corto))}.
        </p>
      )}
    </section>
  );
}
