'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  DIAS_TABLERO_PROXIMOS,
  TRAMOS_MORA,
  type DetalleTableroQuery,
  type FilaTablero,
  type FiltroTipoContrato,
  type Indicador,
  type IndicadorDetalleTablero,
  type MonedaAlquiler,
  type TableroAlquileresDto,
  type TablerosAlquileresDto,
  type TramoMora,
} from '@vacker/types';
import { Card, KpiCard, Modal } from '@vacker/ui';
import { getDetalleTableroAlquileres } from '../../lib/alquileres-api';
import { fmtFecha, fmtK, fmtMoneda, fmtNum } from '../../lib/format';
import { ABREV_MES, periodosTranscurridos } from '../../lib/meses';
import {
  mesesDelPeriodo,
  nombreDelPeriodo,
  parametrosDelPeriodo,
  periodoPorDefecto,
  rangoDelPeriodo,
  type PeriodoTablero,
} from '../../lib/periodo-tablero';
import { getAccessToken } from '../../lib/supabase/client';
import { PeriodosChart } from '../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../tablero/periodos-tabla';
import { CLASE_FOCO, CLASE_TH, EncabezadoPagina, Segmentado, TituloSeccion } from './piezas';
import { FiltroAnio, FiltroPeriodo } from './selector-periodo';

/** Las columnas que puede mostrar el detalle de un número. */
type Columna =
  | 'contrato'
  | 'propiedad'
  | 'inquilino'
  | 'propietario'
  | 'persona'
  | 'alquiler'
  | 'indexa'
  | 'vence'
  | 'detalle'
  | 'fecha'
  | 'dias'
  | 'importe'
  | 'estado';

/** La lista de un número del período que se pide al abrirlo (regla 79). */
type Pedido = Omit<DetalleTableroQuery, 'tipo'>;

/**
 * El detalle de un número: la lista, con las columnas que sirven para ESE
 * número (Javier, 6/10/2026: «en cada uno pone información relevante»), y a
 * dónde ir a resolverlo si es una tarea.
 *
 * Lo que es a hoy viaja con el tablero (`indicador`); lo de un período se pide
 * al abrirlo (`pedido`, regla 79).
 */
interface Detalle {
  titulo: string;
  indicador?: Indicador;
  pedido?: Pedido;
  columnas: [Columna, string][];
  /** Si el número es un importe, la columna `importe` suma y lleva total. */
  total?: MonedaAlquiler;
  accion?: { href: string; texto: string };
}

const DE_CONTRATO: [Columna, string][] = [
  ['contrato', 'Contrato'],
  ['propiedad', 'Propiedad'],
  ['inquilino', 'Inquilino'],
  ['propietario', 'Propietario'],
];
const VISTAS = {
  contratos: [
    ...DE_CONTRATO,
    ['alquiler', 'Alquiler hoy'],
    ['indexa', 'Próx. indexación'],
    ['vence', 'Vence'],
  ],
  alquilerMensual: [
    ...DE_CONTRATO,
    ['importe', 'Alquiler del mes'],
    ['indexa', 'Próx. indexación'],
    ['vence', 'Vence'],
  ],
  vencen: [...DE_CONTRATO, ['alquiler', 'Alquiler hoy'], ['vence', 'Vence'], ['dias', 'Faltan']],
  nuevos: [
    ...DE_CONTRATO,
    ['fecha', 'Empieza'],
    ['importe', 'Alquiler inicial'],
    ['vence', 'Vence'],
    ['estado', 'Estado'],
  ],
  cobranza: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['fecha', 'Vence'],
    ['importe', 'Alquiler'],
    ['estado', 'Estado'],
  ],
  cobrado: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['fecha', 'Vence'],
    ['importe', 'Cobrado'],
    ['estado', 'Estado'],
  ],
  ingresos: [
    ['fecha', 'Fecha'],
    ['detalle', 'Concepto'],
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['persona', 'De quién'],
    ['importe', 'Importe'],
  ],
  mora: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Concepto'],
    ['fecha', 'Venció'],
    ['dias', 'Atraso'],
    ['importe', 'Saldo'],
  ],
  indexaciones: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Tramo'],
    ['fecha', 'Desde'],
    ['alquiler', 'Alquiler hoy'],
    ['importe', 'Nuevo'],
    ['estado', 'Estado'],
  ],
  escalones: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Escalón'],
    ['fecha', 'Desde'],
    ['dias', 'Faltan'],
    ['alquiler', 'Alquiler hoy'],
    ['importe', 'Nuevo'],
  ],
  depositos: [...DE_CONTRATO, ['vence', 'Termina'], ['estado', 'Estado'], ['importe', 'Depósito']],
  liquidaciones: [
    ['propietario', 'Propietario'],
    ['contrato', 'Contratos'],
    ['propiedad', 'Propiedades'],
    ['inquilino', 'Inquilinos'],
    ['estado', 'En espera'],
    ['importe', 'Neto a liquidar'],
  ],
  deudores: [
    ['inquilino', 'Inquilino'],
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['propietario', 'Propietario'],
    ['detalle', 'Qué debe'],
    ['fecha', 'Debe desde'],
    ['dias', 'Atraso'],
    ['importe', 'Deuda'],
  ],
  sinFirmar: [...DE_CONTRATO, ['fecha', 'Empezó'], ['vence', 'Vence'], ['estado', 'Qué falta']],
  reclamos: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Asunto'],
    ['fecha', 'Abierto'],
    ['dias', 'Hace'],
    ['estado', 'Prioridad'],
  ],
  polizas: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Póliza'],
    ['fecha', 'Vence'],
    ['estado', 'Estado'],
  ],
  boletas: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['detalle', 'Qué'],
    ['fecha', 'Vence'],
    ['estado', 'Estado'],
    ['importe', 'Importe'],
  ],
} satisfies Record<string, [Columna, string][]>;

/**
 * Un importe en una tarjeta de media pantalla no entra en un teléfono: «$» de
 * un lado y el número del otro. En el teléfono va a lo ancho; desde `sm`,
 * vuelve a su columna.
 */
function Ancha({ children }: { children: React.ReactNode }) {
  return <div className="col-span-2 sm:col-span-1">{children}</div>;
}

const pct = (parte: number, total: number) =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : '—';
const NOMBRE_TRAMO = {
  '1-30': 'Hasta 30 días',
  '31-60': '31 a 60 días',
  '61-90': '61 a 90 días',
  '90+': 'Más de 90 días',
} as const;
const plata = (n: number) => `$${fmtK(n)}`;
const porcentaje = (n: number) => `${Math.round(n)}%`;
/** Suma importes de a dos decimales sin arrastrar el error de la coma flotante. */
const suma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
const plural = (n: number, uno: string, varios: string) => `${fmtNum(n)} ${n === 1 ? uno : varios}`;

/**
 * Lo que suman las filas, moneda por moneda. Una lista puede mezclar pesos y
 * dólares (un contrato en U$S entre los propietarios a liquidar), y sumarlos
 * juntos da un número que no es de ninguna moneda. La fila sin moneda va en la
 * del número.
 */
function totalesPorMoneda(filas: FilaTablero[], porDefecto: MonedaAlquiler) {
  const t: Record<MonedaAlquiler, number> = { ARS: 0, USD: 0 };
  for (const f of filas) t[f.moneda ?? porDefecto] += f.importe ?? 0;
  return t;
}

/** «$ 1.928.307,62 · U$S 1.409,25»: cada moneda con lo suyo, sin la que está en cero. */
function fmtTotales(t: Record<MonedaAlquiler, number>, porDefecto: MonedaAlquiler) {
  const monedas = (['ARS', 'USD'] as const).filter((m) => t[m] !== 0);
  return (monedas.length ? monedas : [porDefecto]).map((m) => fmtMoneda(t[m], m)).join(' · ');
}

/**
 * La dirección del tablero con su año, su tipo y su período: se puede
 * compartir o recargar y queda igual.
 */
function direccion(
  pathname: string,
  hoy: string,
  anio: number,
  tipo: FiltroTipoContrato,
  periodo: PeriodoTablero,
) {
  const q = new URLSearchParams();
  if (anio !== Number(hoy.slice(0, 4))) q.set('anio', String(anio));
  if (tipo !== 'todos') q.set('tipo', tipo);
  for (const [k, v] of parametrosDelPeriodo(periodo, hoy, anio)) q.set(k, v);
  return `${pathname}${q.toString() ? `?${q}` : ''}`;
}

const TIPOS: [FiltroTipoContrato, string][] = [
  ['todos', 'Todos'],
  ['vivienda', 'Particulares'],
  ['comercial', 'Comerciales'],
];

/**
 * Todos / Particulares / Comerciales (punto 8 de Javier: «es importante»).
 * Filtra el tablero entero. El botón elegido se marca al instante: la API
 * tarda en traer los números, y sin eso parecía que no andaba (Javier,
 * 6/10/2026).
 */
function FiltroTipo({
  tipo,
  cambiar,
}: {
  tipo: FiltroTipoContrato;
  cambiar: (tipo: FiltroTipoContrato) => void;
}) {
  return (
    <Segmentado etiqueta="Tipo de contrato" opciones={TIPOS} valor={tipo} onCambio={cambiar} />
  );
}

/**
 * Cómo se reparte la cartera vigente entre particulares y comerciales. Una
 * fila por tipo, con su propia barra: cuántos contratos, cuánto alquiler por
 * mes y qué parte del total es. La barra única con la leyenda lejos «no se
 * entendía» (Javier, 6/10/2026). Tocar una fila filtra el tablero. Es a hoy.
 */
function RepartoTipo({
  porTipo,
  onElegir,
}: {
  porTipo: TableroAlquileresDto['cartera']['porTipo'];
  onElegir: (tipo: FiltroTipoContrato) => void;
}) {
  if (porTipo.every((x) => x.cantidad === 0)) return null;
  const contratos = suma(porTipo.map((x) => x.cantidad));
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        <span aria-hidden>⚖️</span> Particulares y comerciales
        <span className="font-normal normal-case tracking-normal">
          {' '}
          · qué parte del alquiler mensual en pesos es de cada tipo, a hoy
        </span>
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {porTipo.map((x) => (
          <li key={x.tipo}>
            <button
              type="button"
              onClick={() => onElegir(x.tipo)}
              className={`group w-full rounded-brand text-left ${CLASE_FOCO}`}
              title={`Ver solo ${x.tipo === 'vivienda' ? 'particulares' : 'comerciales'}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-semibold text-ink group-hover:text-brand-red">
                  {x.tipo === 'vivienda' ? 'Particulares' : 'Comerciales'}{' '}
                  <span className="font-normal text-muted">
                    · {x.cantidad} de {contratos} {contratos === 1 ? 'contrato' : 'contratos'}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums text-muted">
                  {fmtMoneda(x.importe, 'ARS')} por mes ·{' '}
                  <span className="font-bold text-ink">{fmtNum(x.pct)}%</span>
                </span>
              </span>
              <span
                className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-surface"
                aria-hidden
              >
                <span
                  style={{ width: `${x.pct}%` }}
                  className={`block h-full rounded-full ${x.tipo === 'vivienda' ? 'bg-brand-red' : 'bg-ink/60'}`}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type Moneda = MonedaAlquiler;
const PARTES = [
  ['honorarios', 'Honorarios', '🤝'],
  ['gastos', 'Gastos adm.', '🗂️'],
  ['punitorios', 'Punitorios', '⏱️'],
  ['comisiones', 'Comisiones e informes', '📝'],
] as const;

/**
 * Lo que la pantalla muestra del período elegido. Los flujos —alquileres,
 * ingresos, contratos nuevos— son la suma de sus meses (regla 75); las fotos
 * —cartera y deuda— son las del cierre de su último mes, o las de hoy si el
 * período llega a hoy (regla 77).
 */
function delPeriodo(t: TableroAlquileresDto, periodo: PeriodoTablero) {
  const numeros = mesesDelPeriodo(periodo);
  const meses = numeros.map((m) => `${t.anio}-${String(m).padStart(2, '0')}`);
  const enPeriodo = (mes: string) => meses.includes(mes);

  const evolucion = t.evolucion.filter((e) => enPeriodo(e.mes));
  const cobranza = [...new Set(evolucion.map((e) => e.moneda))].sort().map((moneda) => {
    const es = evolucion.filter((e) => e.moneda === moneda);
    return {
      moneda,
      emitidos: suma(es.map((e) => e.emitidos)),
      cobrados: suma(es.map((e) => e.cobrados)),
      importeEmitido: suma(es.map((e) => e.emitido)),
      importeCobrado: suma(es.map((e) => e.cobradoHoy)),
      // Regla 76: se recalcula sobre los totales, nunca el promedio de los porcentajes.
      alCierre: suma(es.map((e) => e.cobrado)),
    };
  });

  const ingresosDe = (moneda: Moneda) => {
    const is = t.ingresos.filter((i) => enPeriodo(i.mes) && i.moneda === moneda);
    const partes = {
      honorarios: suma(is.map((i) => i.honorarios)),
      gastos: suma(is.map((i) => i.gastos)),
      punitorios: suma(is.map((i) => i.punitorios)),
      comisiones: suma(is.map((i) => i.comisiones ?? 0)),
    };
    return { moneda, ...partes, total: suma(Object.values(partes)) };
  };
  const ingresos = (['ARS', 'USD'] as const)
    .map(ingresosDe)
    .filter((i) => i.moneda === 'ARS' || i.total !== 0);

  const nuevosFilas = numeros.flatMap((m) => t.nuevos.porMes[m - 1]?.filas ?? []);
  const nuevos = {
    indicador: { valor: nuevosFilas.length, filas: nuevosFilas } satisfies Indicador,
    importe: suma(numeros.map((m) => t.nuevos.importePorMes[m - 1] ?? 0)),
    anterior: suma(numeros.map((m) => t.nuevos.anterior[m - 1] ?? 0)),
  };

  const cierre = t.cierres.find((c) => c.mes === meses.at(-1));
  // Sin cierres (la API todavía no los manda), lo de hoy.
  const aHoy = !cierre || cierre.cierre >= t.hoy;
  return {
    nombre: nombreDelPeriodo(periodo, t.anio),
    rango: rangoDelPeriodo(periodo, t.anio),
    cobranza,
    ingresos,
    nuevos,
    cierre,
    aHoy,
    alCierre: aHoy ? 'a hoy' : `al ${fmtFecha(cierre.cierre)}`,
  };
}

/** Doce meses, o los cuatro trimestres sumados. */
function agrupados(porMes: number[], trimestral: boolean) {
  return trimestral ? [0, 1, 2, 3].map((q) => suma(porMes.slice(q * 3, q * 3 + 3))) : porMes;
}

/** Lo que tienen en común los dos gráficos: la escala del período y qué se marca. */
function ejeDelPeriodo(t: TableroAlquileresDto, periodo: PeriodoTablero) {
  const trimestral = periodo.por === 'trimestre';
  return {
    trimestral,
    etiquetas: trimestral ? ['Q1', 'Q2', 'Q3', 'Q4'] : ABREV_MES,
    transcurridos: periodosTranscurridos(t.anio, trimestral ? 'trimestre' : 'mes'),
    // Con el año entero no se marca ningún mes: es todo el año (regla 80).
    seleccionado: periodo.por === 'mes' ? periodo.mes : periodo.por === 'trimestre' ? periodo.q : 0,
    pista: `tocá una barra o un ${trimestral ? 'trimestre' : 'mes'}`,
    porMesOTrimestre: trimestral ? 'trimestre' : 'mes',
    anchoMinimo: trimestral ? 'min-w-[34rem]' : 'min-w-[60rem]',
  };
}

/**
 * Contratos nuevos (punto 8, «es fundamental»): los del período, como las
 * ventas del Tablero Comercial. Un contrato es «nuevo» en el mes en que
 * empieza. Sigue al selector de la pantalla (regla 75): ya no tiene sus
 * propias tarjetas Q1 a Q4.
 */
function ContratosNuevos({
  t,
  periodo,
  elegir,
  onAbrir,
}: {
  t: TableroAlquileresDto;
  periodo: PeriodoTablero;
  elegir: (p: PeriodoTablero) => void;
  onAbrir: (titulo: string, ind: Indicador, total?: Moneda) => void;
}) {
  const n = t.nuevos;
  if (n.porMes.length !== 12) return null;
  const p = delPeriodo(t, periodo);
  const eje = ejeDelPeriodo(t, periodo);
  const cantidades = agrupados(
    n.porMes.map((i) => i.valor),
    eje.trimestral,
  );
  const importes = agrupados(n.importePorMes, eje.trimestral);
  const anteriores = agrupados(n.anterior, eje.trimestral);
  const filas: FilaPeriodos[] = [
    {
      label: 'Contratos nuevos',
      valores: cantidades,
      total: suma(cantidades),
      formato: (x) => fmtNum(x),
      destaca: true,
    },
    {
      label: `Nuevos ${t.anio - 1}`,
      valores: anteriores,
      total: suma(anteriores),
      formato: (x) => fmtNum(x),
    },
    {
      label: 'Alquiler inicial $',
      valores: importes,
      total: suma(importes),
      formato: plata,
      separa: true,
    },
  ];
  const elegirBarra = (i: number) =>
    elegir(eje.trimestral ? { por: 'trimestre', q: i } : { por: 'mes', mes: i });
  return (
    <section className="flex flex-col gap-2">
      <TituloSeccion icono="🆕" detalle={`los que empiezan en ${p.nombre}`}>
        Contratos nuevos
      </TituloSeccion>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={`Nuevos en ${p.nombre}`}
          value={fmtNum(p.nuevos.indicador.valor)}
          sub={`${fmtNum(p.nuevos.anterior)} en ${t.anio - 1}`}
          icon="🆕"
          tone="brand"
          onClick={() => onAbrir(`Contratos nuevos de ${p.nombre}`, p.nuevos.indicador)}
        />
        <Ancha>
          <KpiCard
            label="Alquiler inicial"
            value={fmtMoneda(p.nuevos.importe, 'ARS')}
            sub="de los nuevos, en pesos"
            icon="💰"
            onClick={() =>
              onAbrir(`Alquiler inicial de los nuevos, ${p.nombre}`, p.nuevos.indicador, 'ARS')
            }
          />
        </Ancha>
      </div>
      <Card className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <PeriodosChart
            titulo={`Contratos nuevos por ${eje.porMesOTrimestre} de ${t.anio}`}
            etiquetas={eje.etiquetas}
            barras={cantidades}
            linea={importes}
            formatoBarras={(x) => fmtNum(x)}
            formatoLinea={plata}
            nombreBarras="Contratos nuevos"
            nombreLinea="Alquiler inicial de los nuevos $"
            nombreLineaCorto="Alquiler inicial"
            barrasEnteras
            transcurridos={eje.transcurridos}
            seleccionado={eje.seleccionado}
            onSelect={elegirBarra}
            pista={eje.pista}
          />
          <PeriodosTabla
            titulo={`Contratos nuevos por ${eje.porMesOTrimestre} de ${t.anio}`}
            etiquetas={eje.etiquetas}
            filas={filas}
            seleccionado={eje.seleccionado}
            onSelect={elegirBarra}
            anchoMinimo={eje.trimestral ? 'min-w-[34rem]' : 'min-w-[52rem]'}
          />
        </div>
      </Card>
    </section>
  );
}

/**
 * El año mes a mes —o por trimestre—, como la sección Alquileres del Tablero
 * Comercial: el gráfico de dos paneles —lo emitido y lo que gana la
 * inmobiliaria— y, abajo, la planilla con cada número. Tocar un mes o un
 * trimestre lo elige en toda la pantalla (regla 80).
 */
function EvolucionAnual({
  t,
  periodo,
  elegir,
}: {
  t: TableroAlquileresDto;
  periodo: PeriodoTablero;
  elegir: (p: PeriodoTablero) => void;
}) {
  const eje = ejeDelPeriodo(t, periodo);
  const meses = Array.from({ length: 12 }, (_, i) => `${t.anio}-${String(i + 1).padStart(2, '0')}`);
  // Los gráficos van en pesos, la moneda de toda la cartera de Vacker.
  const evolucion = (m: string) => t.evolucion.find((x) => x.mes === m && x.moneda === 'ARS');
  const ingreso = (m: string) => t.ingresos.find((x) => x.mes === m && x.moneda === 'ARS');
  const deIngreso = (campo: 'honorarios' | 'gastos' | 'punitorios' | 'comisiones') =>
    agrupados(
      meses.map((m) => ingreso(m)?.[campo] ?? 0),
      eje.trimestral,
    );
  const totalIngreso = (m: string) => {
    const i = ingreso(m);
    return i ? i.honorarios + i.gastos + i.punitorios + (i.comisiones ?? 0) : 0;
  };

  const emitido = agrupados(
    meses.map((m) => evolucion(m)?.emitido ?? 0),
    eje.trimestral,
  );
  const cobrado = agrupados(
    meses.map((m) => evolucion(m)?.cobrado ?? 0),
    eje.trimestral,
  );
  const ingresos = agrupados(meses.map(totalIngreso), eje.trimestral);
  const ingresosAntes = agrupados(
    meses.map((m) => totalIngreso(`${t.anio - 1}${m.slice(4)}`)),
    eje.trimestral,
  );
  const pctCobrado = (c: number, e: number) => (e > 0 ? (c / e) * 100 : 0);

  if (suma(emitido) === 0 && suma(ingresos) === 0) {
    return (
      <p className="p-5 text-sm text-muted">Todavía no hay alquileres generados en {t.anio}.</p>
    );
  }

  const honorarios = deIngreso('honorarios');
  const gastos = deIngreso('gastos');
  const punitorios = deIngreso('punitorios');
  const comisiones = deIngreso('comisiones');
  const filas: FilaPeriodos[] = [
    { label: 'Alquileres emitidos', valores: emitido, total: suma(emitido), formato: plata },
    { label: 'Cobrado al cierre', valores: cobrado, total: suma(cobrado), formato: plata },
    {
      label: '% cobrado',
      valores: emitido.map((e, i) => pctCobrado(cobrado[i]!, e)),
      // Se recalcula sobre los totales: el promedio de los porcentajes mentiría.
      total: pctCobrado(suma(cobrado), suma(emitido)),
      formato: porcentaje,
    },
    {
      label: 'Honorarios',
      valores: honorarios,
      total: suma(honorarios),
      formato: plata,
      separa: true,
    },
    { label: 'Gastos adm.', valores: gastos, total: suma(gastos), formato: plata },
    { label: 'Punitorios', valores: punitorios, total: suma(punitorios), formato: plata },
    {
      label: 'Comisiones e informes',
      valores: comisiones,
      total: suma(comisiones),
      formato: plata,
    },
    { label: 'Ingresos', valores: ingresos, total: suma(ingresos), formato: plata, destaca: true },
    {
      label: `Ingresos ${t.anio - 1}`,
      valores: ingresosAntes,
      total: suma(ingresosAntes),
      formato: plata,
    },
  ];
  const elegirBarra = (i: number) =>
    elegir(eje.trimestral ? { por: 'trimestre', q: i } : { por: 'mes', mes: i });
  // El pie es del período elegido: un mes, un trimestre o el año.
  const p = delPeriodo(t, periodo);
  const enPesos = p.cobranza.find((c) => c.moneda === 'ARS');
  const ganado = p.ingresos.find((i) => i.moneda === 'ARS')?.total ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PeriodosChart
        titulo={`Alquileres e ingresos por ${eje.porMesOTrimestre} de ${t.anio}`}
        etiquetas={eje.etiquetas}
        barras={emitido}
        linea={ingresos}
        formatoBarras={plata}
        formatoLinea={plata}
        nombreBarras="Alquileres emitidos $"
        nombreLinea="Ingresos de la inmobiliaria $"
        nombreLineaCorto="Ingresos"
        transcurridos={eje.transcurridos}
        seleccionado={eje.seleccionado}
        onSelect={elegirBarra}
        pista={eje.pista}
      />
      <PeriodosTabla
        titulo={`Alquileres e ingresos por ${eje.porMesOTrimestre} de ${t.anio}`}
        etiquetas={eje.etiquetas}
        filas={filas}
        seleccionado={eje.seleccionado}
        onSelect={elegirBarra}
        anchoMinimo={eje.anchoMinimo}
      />
      <p className="text-sm text-muted">
        <span className="font-bold text-ink">{p.nombre}</span>: cobrado al cierre de cada mes{' '}
        {pct(enPesos?.alCierre ?? 0, enPesos?.importeEmitido ?? 0)} de lo emitido · ingresos{' '}
        {fmtMoneda(ganado, 'ARS')}
      </p>
    </div>
  );
}

/**
 * El tablero del módulo (reglas 26 a 32 y 74 a 82), armado con las piezas del
 * Tablero Comercial: tarjetas con ícono que se abren, rótulos de sección con
 * ícono y el gráfico de dos paneles con su planilla. Cada número abre la lista
 * de lo que cuenta, y esa lista suma el número: lo de hoy llega junto con el
 * tablero; lo de un período se pide al abrirlo, a la misma cuenta.
 */
export function TableroAlquileres({
  tableros,
  tipoInicial = 'todos',
  periodoInicial,
}: {
  tableros: TablerosAlquileresDto;
  tipoInicial?: FiltroTipoContrato;
  periodoInicial?: PeriodoTablero;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [actualizando, startTransition] = useTransition();
  // Los tres cortes ya están acá: cambiar de tipo es instantáneo (Javier,
  // 6/10/2026: «parece que no está funcionando»). Solo el año vuelve a pedir.
  const [tipo, setTipo] = useState<FiltroTipoContrato>(tipoInicial);
  const t = tableros[tipo];
  const [anioElegido, setAnioElegido] = useState(t.anio);
  // Regla 74: los doce meses también están acá; cambiar de período tampoco pide nada.
  const [periodo, setPeriodo] = useState<PeriodoTablero>(
    periodoInicial ?? periodoPorDefecto(t.hoy, t.anio),
  );
  const elegirTipo = (nuevo: FiltroTipoContrato) => {
    setTipo(nuevo);
    // La dirección acompaña, sin pedirle nada al servidor.
    window.history.replaceState(null, '', direccion(pathname, t.hoy, t.anio, nuevo, periodo));
  };
  const elegirPeriodo = (nuevo: PeriodoTablero) => {
    setPeriodo(nuevo);
    window.history.replaceState(null, '', direccion(pathname, t.hoy, t.anio, tipo, nuevo));
  };
  const elegirAnio = (anio: number) => {
    setAnioElegido(anio);
    startTransition(() =>
      router.push(direccion(pathname, t.hoy, anio, tipo, periodo), { scroll: false }),
    );
  };
  const abrir =
    (
      titulo: string,
      indicador: Indicador,
      columnas: [Columna, string][],
      extra: Partial<Detalle> = {},
    ) =>
    () =>
      setDetalle({ titulo, indicador, columnas, ...extra });

  const p = delPeriodo(t, periodo);
  /** Abre la lista de un número del período: se pide al abrirla (regla 79). */
  const pedir =
    (
      titulo: string,
      indicador: IndicadorDetalleTablero,
      moneda: Moneda,
      columnas: [Columna, string][],
      extra: Partial<Detalle> & { tramo?: TramoMora } = {},
    ) =>
    () => {
      const { tramo, ...resto } = extra;
      setDetalle({
        titulo,
        pedido: { indicador, ...p.rango, moneda, ...(tramo ? { tramo } : {}) },
        columnas,
        ...resto,
      });
    };

  // --- Las fotos (regla 77): a hoy, con su lista; al cierre, el número y la lista se pide ---
  const vigentes = p.aHoy
    ? {
        valor: t.cartera.vigentes.valor,
        vivienda: t.cartera.vivienda,
        comercial: t.cartera.comercial,
      }
    : { valor: p.cierre!.vigentes, vivienda: p.cierre!.vivienda, comercial: p.cierre!.comercial };
  const abrirVigentes = p.aHoy
    ? abrir('Contratos vigentes, a hoy', t.cartera.vigentes, VISTAS.contratos)
    : pedir(`Contratos vigentes ${p.alCierre}`, 'vigentes', 'ARS', VISTAS.contratos);
  const alquilerMensual = p.aHoy
    ? t.cartera.alquilerMensual.map((a) => ({
        moneda: a.moneda,
        valor: a.indicador.valor,
        contratos: a.indicador.filas.length,
        indicador: a.indicador as Indicador | undefined,
      }))
    : p.cierre!.alquilerMensual.map((a) => ({ ...a, indicador: undefined }));
  const mora = p.aHoy
    ? t.morosidad.map((m) => ({
        moneda: m.moneda,
        valor: m.total.valor,
        conceptos: m.total.filas.length,
        inquilinos: new Set(m.total.filas.map((f) => f.inquilino)).size,
        indicador: m.total as Indicador | undefined,
        tramos: m.tramos.map((x) => ({
          tramo: x.tramo,
          valor: x.indicador.valor,
          conceptos: x.indicador.filas.length,
          indicador: x.indicador as Indicador | undefined,
        })),
      }))
    : p.cierre!.mora.map((m) => ({
        ...m,
        indicador: undefined,
        tramos: TRAMOS_MORA.map((tramo) => ({
          tramo,
          valor: m.tramos.find((x) => x.tramo === tramo)?.valor ?? 0,
          conceptos: m.tramos.find((x) => x.tramo === tramo)?.conceptos ?? 0,
          indicador: undefined,
        })),
      }));

  // Las tres ventanas de vencimiento juntas, para la tarjeta de la cartera.
  const vencen90: Indicador = {
    valor: suma(t.tareas.vencen.map((v) => v.indicador.valor)),
    filas: t.tareas.vencen.flatMap((v) => v.indicador.filas),
  };

  type Tarea = {
    icono: string;
    titulo: string;
    ind: Indicador;
    columnas: [Columna, string][];
    total?: MonedaAlquiler;
    accion?: Detalle['accion'];
  };
  const aIndexar = { href: '/alquileres/indexaciones', texto: 'Ir a indexar' };
  const tareas: Tarea[] = [
    {
      icono: '⏰',
      titulo: 'Indexaciones vencidas',
      ind: t.tareas.indexacionesVencidas,
      columnas: VISTAS.indexaciones,
      accion: aIndexar,
    },
    {
      icono: '📈',
      // Incluye las que ya empezaron y esperan un índice que no salió: no son vencidas (regla 7).
      titulo: `Indexaciones de los próximos ${DIAS_TABLERO_PROXIMOS} días o que esperan el índice`,
      ind: t.tareas.indexacionesProximas,
      columnas: VISTAS.indexaciones,
      accion: aIndexar,
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
  ];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Dashboard">
        {actualizando && (
          <span
            role="status"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted"
          >
            <span
              aria-hidden
              className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-brand-red"
            />
            Actualizando…
          </span>
        )}
        <FiltroTipo tipo={tipo} cambiar={elegirTipo} />
        <FiltroPeriodo
          periodo={periodo}
          porDefecto={periodoPorDefecto(t.hoy, t.anio).mes}
          cambiar={elegirPeriodo}
        />
        <FiltroAnio hoy={t.hoy} anio={anioElegido} cambiar={elegirAnio} />
      </EncabezadoPagina>

      <div
        aria-busy={actualizando}
        className={`flex flex-col gap-5 transition-opacity ${actualizando ? 'pointer-events-none opacity-50' : ''}`}
      >
        <section className="flex flex-col gap-2">
          <TituloSeccion icono="🏘️" detalle={p.alCierre}>
            Cartera
          </TituloSeccion>
          {/*
            Los ingresos del período tienen su sección, con el desglose: acá
            eran la misma cifra dos veces (Javier, 7/10/2026). Con alquileres
            en dólares hay una tarjeta más.
          */}
          <div
            className={`grid grid-cols-2 gap-3 ${alquilerMensual.length > 1 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
          >
            <Ancha>
              <KpiCard
                label="Contratos vigentes"
                value={fmtNum(vigentes.valor)}
                sub={`${plural(vigentes.vivienda, 'particular', 'particulares')} · ${plural(vigentes.comercial, 'comercial', 'comerciales')}`}
                icon="📄"
                tone="brand"
                onClick={abrirVigentes}
              />
            </Ancha>
            {alquilerMensual.map((a) => {
              const titulo = `Alquiler mensual${a.moneda === 'USD' ? ' en dólares' : ''}, ${p.alCierre}`;
              return (
                <Ancha key={a.moneda}>
                  <KpiCard
                    label={a.moneda === 'USD' ? 'Alquiler mensual U$S' : 'Alquiler mensual'}
                    value={fmtMoneda(a.valor, a.moneda)}
                    sub={`de ${plural(a.contratos, 'contrato', 'contratos')}${a.moneda === 'USD' ? ' en dólares' : ''}`}
                    icon="💰"
                    onClick={
                      a.indicador
                        ? abrir(titulo, a.indicador, VISTAS.alquilerMensual, { total: a.moneda })
                        : pedir(titulo, 'alquilerMensual', a.moneda, VISTAS.alquilerMensual, {
                            total: a.moneda,
                          })
                    }
                  />
                </Ancha>
              );
            })}
            <Ancha>
              <KpiCard
                label="Vencen en 90 días"
                value={fmtNum(vencen90.valor)}
                sub="contratos para renovar, a hoy"
                icon="📅"
                tone={vencen90.valor ? 'warning' : 'default'}
                onClick={abrir(
                  'Contratos que vencen en los próximos 90 días',
                  vencen90,
                  VISTAS.vencen,
                )}
              />
            </Ancha>
          </div>
          {t.tipo === 'todos' && <RepartoTipo porTipo={t.cartera.porTipo} onElegir={elegirTipo} />}
        </section>

        <ContratosNuevos
          t={t}
          periodo={periodo}
          elegir={elegirPeriodo}
          onAbrir={(titulo, ind, total) =>
            setDetalle({ titulo, indicador: ind, columnas: VISTAS.nuevos, total })
          }
        />

        {p.cobranza.length === 0 ? (
          <section className="flex flex-col gap-2">
            <TituloSeccion icono="💵">Cobranza de {p.nombre}</TituloSeccion>
            <Card className="py-4 text-sm text-muted">
              No hay alquileres emitidos en {p.nombre}.
            </Card>
          </section>
        ) : (
          p.cobranza.map((c) => (
            <section key={c.moneda} className="flex flex-col gap-2">
              <TituloSeccion icono="💵" detalle={c.moneda === 'USD' ? 'en dólares' : undefined}>
                Cobranza de {p.nombre}
              </TituloSeccion>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                  label="Alquileres emitidos"
                  value={fmtNum(c.emitidos)}
                  sub={periodo.por === 'mes' ? 'del mes' : `de ${p.nombre}`}
                  icon="🧾"
                  onClick={pedir(
                    `Alquileres emitidos de ${p.nombre}`,
                    'emitidos',
                    c.moneda,
                    VISTAS.cobranza,
                  )}
                />
                <KpiCard
                  label="Alquileres cobrados"
                  value={fmtNum(c.cobrados)}
                  sub={`${pct(c.cobrados, c.emitidos)} de los emitidos`}
                  icon="✅"
                  tone="success"
                  onClick={pedir(
                    `Alquileres cobrados del todo, ${p.nombre}`,
                    'cobrados',
                    c.moneda,
                    VISTAS.cobranza,
                  )}
                />
                <Ancha>
                  <KpiCard
                    label="Importe emitido"
                    value={fmtMoneda(c.importeEmitido, c.moneda)}
                    sub="lo que hay que cobrar"
                    icon="📄"
                    onClick={pedir(
                      `Importe emitido de ${p.nombre}`,
                      'importeEmitido',
                      c.moneda,
                      VISTAS.cobranza,
                      { total: c.moneda },
                    )}
                  />
                </Ancha>
                <Ancha>
                  {/* Regla 76: lo cobrado hasta hoy, y cuánto de eso entró dentro de su mes. */}
                  <KpiCard
                    label="Importe cobrado"
                    value={fmtMoneda(c.importeCobrado, c.moneda)}
                    sub={`${pct(c.importeCobrado, c.importeEmitido)} de lo emitido · ${pct(c.alCierre, c.importeEmitido)} se cobró dentro del mes`}
                    icon="💵"
                    tone="success"
                    onClick={pedir(
                      `Importe cobrado de ${p.nombre}`,
                      'importeCobrado',
                      c.moneda,
                      VISTAS.cobrado,
                      { total: c.moneda },
                    )}
                  />
                </Ancha>
              </div>
            </section>
          ))
        )}

        {p.ingresos.map((i) => (
          <section key={i.moneda} className="flex flex-col gap-2">
            <TituloSeccion
              icono="🏦"
              detalle={`${p.nombre}${i.moneda === 'USD' ? ', en dólares' : ''}`}
            >
              Ingresos de la inmobiliaria
            </TituloSeccion>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Ancha>
                <KpiCard
                  label="Ingresos"
                  value={fmtMoneda(i.total, i.moneda)}
                  sub="cobrados y descontados"
                  icon="🏦"
                  tone="success"
                  onClick={
                    i.total
                      ? pedir(
                          `Ingresos de la inmobiliaria, ${p.nombre}`,
                          'ingresos',
                          i.moneda,
                          VISTAS.ingresos,
                          { total: i.moneda },
                        )
                      : undefined
                  }
                />
              </Ancha>
              {PARTES.map(([parte, nombre, icono]) => (
                <Ancha key={parte}>
                  <KpiCard
                    label={nombre}
                    value={fmtMoneda(i[parte], i.moneda)}
                    sub={`${pct(i[parte], i.total)} de los ingresos`}
                    icon={icono}
                    onClick={
                      i[parte]
                        ? pedir(`${nombre} · ${p.nombre}`, parte, i.moneda, VISTAS.ingresos, {
                            total: i.moneda,
                          })
                        : undefined
                    }
                  />
                </Ancha>
              ))}
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <TituloSeccion
            icono="⏳"
            detalle={`deuda vencida de inquilinos, por antigüedad, ${p.alCierre}`}
          >
            Morosidad
          </TituloSeccion>
          {mora.length === 0 ? (
            <Card className="py-4 text-sm text-success">
              {p.aHoy
                ? 'Ningún inquilino tiene deuda vencida.'
                : `Ningún inquilino tenía deuda vencida ${p.alCierre}.`}
            </Card>
          ) : (
            mora.map((m) => {
              const enDolares = m.moneda === 'USD' ? ' en dólares' : '';
              return (
                <div
                  key={m.moneda}
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
                >
                  <Ancha>
                    <KpiCard
                      label={`Deuda vencida${m.moneda === 'USD' ? ' U$S' : ''}`}
                      value={fmtMoneda(m.valor, m.moneda)}
                      sub={`${plural(m.conceptos, 'concepto', 'conceptos')} · ${plural(m.inquilinos, 'inquilino', 'inquilinos')}`}
                      icon="⏳"
                      tone="warning"
                      onClick={
                        m.indicador
                          ? abrir(
                              `Deuda vencida de inquilinos${enDolares}, a hoy`,
                              m.indicador,
                              VISTAS.mora,
                              { total: m.moneda },
                            )
                          : pedir(
                              `Deuda vencida de inquilinos${enDolares} ${p.alCierre}`,
                              'mora',
                              m.moneda,
                              VISTAS.mora,
                              { total: m.moneda },
                            )
                      }
                    />
                  </Ancha>
                  {m.tramos.map((x) => {
                    const titulo = `Deuda vencida · ${NOMBRE_TRAMO[x.tramo].toLowerCase()}, ${p.alCierre}`;
                    return (
                      <Ancha key={x.tramo}>
                        <KpiCard
                          label={NOMBRE_TRAMO[x.tramo]}
                          value={fmtMoneda(x.valor, m.moneda)}
                          sub={plural(x.conceptos, 'concepto', 'conceptos')}
                          onClick={
                            x.indicador
                              ? abrir(titulo, x.indicador, VISTAS.mora, { total: m.moneda })
                              : pedir(titulo, 'mora', m.moneda, VISTAS.mora, {
                                  total: m.moneda,
                                  tramo: x.tramo,
                                })
                          }
                        />
                      </Ancha>
                    );
                  })}
                </div>
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-2">
          <TituloSeccion icono="📊" detalle={`en pesos, ${t.anio}`}>
            Alquileres e ingresos
          </TituloSeccion>
          <Card className="p-0">
            <EvolucionAnual t={t} periodo={periodo} elegir={elegirPeriodo} />
          </Card>
        </section>

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
      </div>

      {detalle && (
        <DetalleModal
          // Una lista nueva arranca de cero: no muestra la anterior mientras carga.
          key={`${detalle.titulo}|${JSON.stringify(detalle.pedido ?? null)}`}
          {...detalle}
          tipo={tipo}
          hoy={t.hoy}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

/** «en 12 días», «hoy», «hace 5 días»: para lo que falta o lo que pasó. */
function enDias(n: number, columna: string) {
  if (columna === 'Atraso' || columna === 'Hace') return `${n} ${n === 1 ? 'día' : 'días'}`;
  if (n === 0) return 'hoy';
  return n > 0 ? `en ${n} ${n === 1 ? 'día' : 'días'}` : `hace ${-n} ${n === -1 ? 'día' : 'días'}`;
}

const DERECHA: Columna[] = ['alquiler', 'importe', 'dias'];
/** Lo que no se corta en dos renglones: códigos, fechas e importes. */
const SIN_CORTE: Columna[] = [
  'contrato',
  'fecha',
  'vence',
  'indexa',
  'alquiler',
  'importe',
  'dias',
];

/** Lo que va en una celda, formateado. */
function Celda({
  f,
  col,
  etiqueta,
  hoy,
}: {
  f: FilaTablero;
  col: Columna;
  etiqueta: string;
  hoy: string;
}) {
  const moneda = f.moneda ?? 'ARS';
  switch (col) {
    case 'alquiler':
    case 'importe': {
      const v = f[col];
      return v == null ? <span className="text-muted">—</span> : <>{fmtMoneda(v, moneda)}</>;
    }
    case 'indexa':
      if (!f.indexa) return <span className="text-muted">—</span>;
      return f.indexa < hoy ? (
        <span className="font-semibold text-danger">
          {fmtFecha(f.indexa)} <span className="text-[11px] font-bold uppercase">vencida</span>
        </span>
      ) : (
        <>{fmtFecha(f.indexa)}</>
      );
    case 'vence':
    case 'fecha':
      return f[col] ? <>{fmtFecha(f[col])}</> : <span className="text-muted">—</span>;
    case 'dias':
      return f.dias == null ? (
        <span className="text-muted">—</span>
      ) : (
        <>{enDias(f.dias, etiqueta)}</>
      );
    case 'contrato':
      return <span className="font-semibold text-ink">{f.contrato ?? '—'}</span>;
    default: {
      const v = f[col];
      return v ? <>{v}</> : <span className="text-muted">—</span>;
    }
  }
}

/**
 * El detalle de un número: una tabla con las columnas de ese número en la
 * computadora, y tarjetas en el teléfono. Cada fila lleva a su ficha. Si es un
 * importe, el total es el número de la tarjeta.
 */
function DetalleModal({
  titulo,
  indicador,
  pedido,
  columnas,
  total,
  accion,
  tipo,
  hoy,
  onClose,
}: Detalle & { tipo: FiltroTipoContrato; hoy: string; onClose: () => void }) {
  const router = useRouter();
  // Regla 79: la lista de un número del período se pide al abrirla.
  const [cargado, setCargado] = useState<Indicador | null>(indicador ?? null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!pedido) return;
    let cancelado = false;
    getAccessToken()
      .then((token) => getDetalleTableroAlquileres(token, { ...pedido, tipo }))
      .then((ind) => {
        if (!cancelado) setCargado(ind);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, [pedido, tipo]);
  const filas = cargado?.filas ?? [];
  // Una columna vacía en todas las filas no se muestra.
  const cols = columnas.filter(([c]) => filas.some((f) => f[c] != null && f[c] !== ''));
  const conTotal = total && cols.some(([c]) => c === 'importe');
  // El total es lo que suman las filas, por moneda. No `indicador.valor`: en
  // las tareas es la CANTIDAD de filas, y salía «Total $ 5,00».
  const textoTotal = total ? fmtTotales(totalesPorMoneda(filas, total), total) : '';
  const ir = (f: FilaTablero) => {
    if (f.href) router.push(f.href);
  };
  return (
    <Modal
      title={titulo}
      subtitle={
        cargado
          ? `${filas.length} ${filas.length === 1 ? 'fila' : 'filas'}${filas.some((f) => f.href) ? ' · tocá una para abrir su ficha' : ''}`
          : undefined
      }
      onClose={onClose}
      size="xl"
    >
      {error ? (
        <p className="text-sm text-danger">No se pudo cargar la lista. Cerrala y probá de nuevo.</p>
      ) : !cargado ? (
        <p role="status" className="text-sm text-muted">
          Cargando…
        </p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-muted">Nada por ahora.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2 sm:hidden">
            {filas.map((f) => {
              const [primera, ...resto] = cols;
              const cuerpo = (
                <>
                  <p className="font-semibold text-ink">
                    {primera && <Celda f={f} col={primera[0]} etiqueta={primera[1]} hoy={hoy} />}
                    {f.propiedad && primera?.[0] !== 'propiedad' && (
                      <span className="font-normal text-muted"> · {f.propiedad}</span>
                    )}
                  </p>
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {resto
                      .filter(([c]) => c !== 'propiedad')
                      .map(([c, etiqueta]) => (
                        <div key={c} className="min-w-0">
                          <dt className="text-muted">{etiqueta}</dt>
                          <dd className="truncate text-ink">
                            <Celda f={f} col={c} etiqueta={etiqueta} hoy={hoy} />
                          </dd>
                        </div>
                      ))}
                  </dl>
                </>
              );
              return (
                <li key={f.id} className="rounded-brand border border-line text-sm">
                  {f.href ? (
                    <Link href={f.href} className={`block p-3 hover:bg-surface/60 ${CLASE_FOCO}`}>
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="p-3">{cuerpo}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden max-h-[65vh] overflow-auto sm:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  {cols.map(([c, etiqueta]) => (
                    <th
                      key={c}
                      className={`${CLASE_TH} ${DERECHA.includes(c) ? 'text-right' : ''}`}
                    >
                      {etiqueta}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => ir(f)}
                    className={`border-b border-line last:border-0 ${f.href ? 'cursor-pointer hover:bg-surface/60' : ''}`}
                  >
                    {cols.map(([c, etiqueta], i) => (
                      <td
                        key={c}
                        className={`px-3 py-2 align-top ${SIN_CORTE.includes(c) ? 'whitespace-nowrap' : ''} ${DERECHA.includes(c) ? 'text-right tabular-nums' : ''} ${c === 'importe' || i === 0 ? 'font-semibold text-ink' : 'text-muted'}`}
                      >
                        {i === 0 && f.href ? (
                          <Link
                            href={f.href}
                            onClick={(e) => e.stopPropagation()}
                            className={`hover:text-brand-red ${CLASE_FOCO}`}
                          >
                            <Celda f={f} col={c} etiqueta={etiqueta} hoy={hoy} />
                          </Link>
                        ) : (
                          <Celda f={f} col={c} etiqueta={etiqueta} hoy={hoy} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {conTotal && (
                <tfoot className="sticky bottom-0 bg-white">
                  <tr className="border-t-2 border-line font-bold text-ink">
                    {cols.map(([c], i) => (
                      <td
                        key={c}
                        className={`px-3 py-2 ${c === 'importe' ? 'whitespace-nowrap text-right tabular-nums' : ''}`}
                      >
                        {i === 0 ? 'Total' : c === 'importe' ? textoTotal : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {(conTotal || accion) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              {conTotal ? (
                <p className="text-sm font-bold text-ink sm:hidden">Total {textoTotal}</p>
              ) : (
                <span />
              )}
              {accion && (
                <Link
                  href={accion.href}
                  className={`ml-auto rounded-brand bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark ${CLASE_FOCO}`}
                >
                  {accion.texto} →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
