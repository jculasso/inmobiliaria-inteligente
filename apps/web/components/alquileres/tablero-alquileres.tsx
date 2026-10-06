'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DIAS_TABLERO_PROXIMOS, type FilaTablero, type FiltroTipoContrato, type Indicador, type MonedaAlquiler, type TableroAlquileresDto, type TablerosAlquileresDto } from '@vacker/types';
import { mesLargo } from '@vacker/domain';
import { Card, KpiCard, Modal } from '@vacker/ui';
import { fmtFecha, fmtK, fmtMoneda, fmtNum } from '../../lib/format';
import { ABREV_MES, NOMBRES_MES, periodosTranscurridos } from '../../lib/meses';
import { PeriodosChart } from '../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../tablero/periodos-tabla';
import { CLASE_FOCO, CLASE_TH, EncabezadoPagina, Segmentado, TituloSeccion } from './piezas';

/** Las columnas que puede mostrar el detalle de un número. */
type Columna = 'contrato' | 'propiedad' | 'inquilino' | 'propietario' | 'alquiler' | 'indexa' | 'vence' | 'detalle' | 'fecha' | 'dias' | 'importe' | 'estado';

/**
 * El detalle de un número: la lista, con las columnas que sirven para ESE
 * número (Javier, 6/10/2026: «en cada uno pone información relevante»), y a
 * dónde ir a resolverlo si es una tarea.
 */
interface Detalle {
  titulo: string;
  indicador: Indicador;
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
  contratos: [...DE_CONTRATO, ['alquiler', 'Alquiler hoy'], ['indexa', 'Próx. indexación'], ['vence', 'Vence']],
  alquilerMensual: [...DE_CONTRATO, ['importe', 'Alquiler del mes'], ['indexa', 'Próx. indexación'], ['vence', 'Vence']],
  vencen: [...DE_CONTRATO, ['alquiler', 'Alquiler hoy'], ['vence', 'Vence'], ['dias', 'Faltan']],
  nuevos: [...DE_CONTRATO, ['fecha', 'Empieza'], ['importe', 'Alquiler inicial'], ['vence', 'Vence'], ['estado', 'Estado']],
  cobranza: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['fecha', 'Vence'], ['importe', 'Alquiler'], ['estado', 'Estado']],
  cobrado: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['fecha', 'Vence'], ['importe', 'Cobrado'], ['estado', 'Estado']],
  mora: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['detalle', 'Concepto'], ['fecha', 'Venció'], ['dias', 'Atraso'], ['importe', 'Saldo']],
  indexaciones: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['detalle', 'Tramo'], ['fecha', 'Desde'], ['alquiler', 'Alquiler hoy'], ['importe', 'Nuevo'], ['estado', 'Estado']],
  escalones: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['detalle', 'Escalón'], ['fecha', 'Desde'], ['dias', 'Faltan'], ['alquiler', 'Alquiler hoy'], ['importe', 'Nuevo']],
  depositos: [...DE_CONTRATO, ['vence', 'Termina'], ['estado', 'Estado'], ['importe', 'Depósito']],
  liquidaciones: [['propietario', 'Propietario'], ['contrato', 'Contratos'], ['propiedad', 'Propiedades'], ['inquilino', 'Inquilinos'], ['estado', 'En espera'], ['importe', 'Neto a liquidar']],
  deudores: [['inquilino', 'Inquilino'], ['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['propietario', 'Propietario'], ['detalle', 'Qué debe'], ['fecha', 'Debe desde'], ['dias', 'Atraso'], ['importe', 'Deuda']],
  sinFirmar: [...DE_CONTRATO, ['fecha', 'Empezó'], ['vence', 'Vence'], ['estado', 'Qué falta']],
  reclamos: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['detalle', 'Asunto'], ['fecha', 'Abierto'], ['dias', 'Hace'], ['estado', 'Prioridad']],
  polizas: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['inquilino', 'Inquilino'], ['detalle', 'Póliza'], ['fecha', 'Vence'], ['estado', 'Estado']],
  boletas: [['contrato', 'Contrato'], ['propiedad', 'Propiedad'], ['detalle', 'Qué'], ['fecha', 'Vence'], ['estado', 'Estado'], ['importe', 'Importe']],
} satisfies Record<string, [Columna, string][]>;

/**
 * Un importe en una tarjeta de media pantalla no entra en un teléfono: «$» de
 * un lado y el número del otro. En el teléfono va a lo ancho; desde `sm`,
 * vuelve a su columna.
 */
function Ancha({ children }: { children: React.ReactNode }) {
  return <div className="col-span-2 sm:col-span-1">{children}</div>;
}

const pct = (parte: number, total: number) => (total > 0 ? `${Math.round((parte / total) * 100)}%` : '—');
const NOMBRE_TRAMO = { '1-30': 'Hasta 30 días', '31-60': '31 a 60 días', '61-90': '61 a 90 días', '90+': 'Más de 90 días' } as const;
const plata = (n: number) => `$${fmtK(n)}`;
const porcentaje = (n: number) => `${Math.round(n)}%`;
const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** La dirección del tablero con su año y su tipo: se puede compartir o recargar y queda igual. */
function direccion(pathname: string, hoy: string, anio: number, tipo: FiltroTipoContrato) {
  const q = new URLSearchParams();
  if (anio !== Number(hoy.slice(0, 4))) q.set('anio', String(anio));
  if (tipo !== 'todos') q.set('tipo', tipo);
  return `${pathname}${q.toString() ? `?${q}` : ''}`;
}

/**
 * El año de los gráficos. Como el filtro del Tablero Comercial, pero sin
 * «Todos los años»: el gráfico es de doce meses de un año.
 */
function FiltroAnioAlquileres({ t, anio, cambiar }: { t: TableroAlquileresDto; anio: number; cambiar: (anio: number) => void }) {
  const hoy = Number(t.hoy.slice(0, 4));
  return (
    <select aria-label="Año" value={anio} onChange={(e) => cambiar(Number(e.target.value))} className={`h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink ${CLASE_FOCO}`}>
      {[hoy, hoy - 1, hoy - 2].map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
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
function FiltroTipo({ tipo, cambiar }: { tipo: FiltroTipoContrato; cambiar: (tipo: FiltroTipoContrato) => void }) {
  return <Segmentado etiqueta="Tipo de contrato" opciones={TIPOS} valor={tipo} onCambio={cambiar} />;
}

/**
 * Cómo se reparte la cartera vigente entre particulares y comerciales. Una
 * fila por tipo, con su propia barra: cuántos contratos, cuánto alquiler por
 * mes y qué parte del total es. La barra única con la leyenda lejos «no se
 * entendía» (Javier, 6/10/2026). Tocar una fila filtra el tablero.
 */
function RepartoTipo({ porTipo, onElegir }: { porTipo: TableroAlquileresDto['cartera']['porTipo']; onElegir: (tipo: FiltroTipoContrato) => void }) {
  if (porTipo.every((x) => x.cantidad === 0)) return null;
  const contratos = suma(porTipo.map((x) => x.cantidad));
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        <span aria-hidden>⚖️</span> Particulares y comerciales
        <span className="font-normal normal-case tracking-normal"> · qué parte del alquiler mensual en pesos es de cada tipo</span>
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {porTipo.map((x) => (
          <li key={x.tipo}>
            <button type="button" onClick={() => onElegir(x.tipo)} className={`group w-full rounded-brand text-left ${CLASE_FOCO}`} title={`Ver solo ${x.tipo === 'vivienda' ? 'particulares' : 'comerciales'}`}>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-semibold text-ink group-hover:text-brand-red">
                  {x.tipo === 'vivienda' ? 'Particulares' : 'Comerciales'}{' '}
                  <span className="font-normal text-muted">
                    · {x.cantidad} de {contratos} {contratos === 1 ? 'contrato' : 'contratos'}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums text-muted">
                  {fmtMoneda(x.importe, 'ARS')} por mes · <span className="font-bold text-ink">{fmtNum(x.pct)}%</span>
                </span>
              </span>
              <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <span style={{ width: `${x.pct}%` }} className={`block h-full rounded-full ${x.tipo === 'vivienda' ? 'bg-brand-red' : 'bg-ink/60'}`} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Contratos nuevos (punto 8, «es fundamental»): del año, por trimestre y mes a
 * mes, como las ventas del Tablero Comercial. Un contrato es «nuevo» en el mes
 * en que empieza.
 */
function ContratosNuevos({ t, onAbrir }: { t: TableroAlquileresDto; onAbrir: (titulo: string, ind: Indicador) => void }) {
  const enCurso = t.anio === Number(t.hoy.slice(0, 4));
  const [mes, setMes] = useState(enCurso ? Number(t.hoy.slice(5, 7)) : 12);
  const n = t.nuevos;
  if (n.porMes.length !== 12) return null;
  const cantidades = n.porMes.map((i) => i.valor);
  const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const trimestre = (q: number) => cantidades.slice(q * 3, q * 3 + 3);
  const delTrimestre = (q: number): Indicador => {
    const filas = n.porMes.slice(q * 3, q * 3 + 3).flatMap((i) => i.filas);
    return { valor: filas.length, filas };
  };
  const delAnio: Indicador = { valor: suma(cantidades), filas: n.porMes.flatMap((i) => i.filas) };
  const filas: FilaPeriodos[] = [
    { label: 'Contratos nuevos', valores: cantidades, total: suma(cantidades), formato: (x) => fmtNum(x), destaca: true },
    { label: `Nuevos ${t.anio - 1}`, valores: n.anterior, total: suma(n.anterior), formato: (x) => fmtNum(x) },
    { label: 'Alquiler inicial $', valores: n.importePorMes, total: suma(n.importePorMes), formato: plata, separa: true },
  ];
  return (
    <section className="flex flex-col gap-2">
      <TituloSeccion icono="🆕" detalle={`los que empiezan en ${t.anio}`}>
        Contratos nuevos
      </TituloSeccion>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Ancha>
          <KpiCard
            label={`Nuevos en ${t.anio}`}
            value={fmtNum(delAnio.valor)}
            sub={`${fmtNum(suma(n.anterior))} en ${t.anio - 1}`}
            icon="🆕"
            tone="brand"
            onClick={() => onAbrir(`Contratos nuevos de ${t.anio}`, delAnio)}
          />
        </Ancha>
        {[0, 1, 2, 3].map((q) => (
          <KpiCard
            key={q}
            label={`Q${q + 1}`}
            value={fmtNum(suma(trimestre(q)))}
            sub={`${fmtNum(suma(n.anterior.slice(q * 3, q * 3 + 3)))} en ${t.anio - 1}`}
            onClick={() => onAbrir(`Contratos nuevos · Q${q + 1} ${t.anio}`, delTrimestre(q))}
          />
        ))}
      </div>
      <Card className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <PeriodosChart
            titulo={`Contratos nuevos por mes de ${t.anio}`}
            etiquetas={ABREV_MES}
            barras={cantidades}
            linea={n.importePorMes}
            formatoBarras={(x) => fmtNum(x)}
            formatoLinea={plata}
            nombreBarras="Contratos nuevos"
            nombreLinea="Alquiler inicial de los nuevos $"
            nombreLineaCorto="Alquiler inicial"
            barrasEnteras
            transcurridos={periodosTranscurridos(t.anio, 'mes')}
            seleccionado={mes}
            onSelect={setMes}
            pista="tocá una barra o un mes"
          />
          <PeriodosTabla titulo={`Contratos nuevos por mes de ${t.anio}`} etiquetas={ABREV_MES} filas={filas} seleccionado={mes} onSelect={setMes} anchoMinimo="min-w-[52rem]" />
          <p className="text-sm text-muted">
            <span className="font-bold text-ink">{NOMBRES_MES[mes - 1]}</span>: {fmtNum(cantidades[mes - 1]!)}{' '}
            {cantidades[mes - 1] === 1 ? 'contrato nuevo' : 'contratos nuevos'}
            {cantidades[mes - 1]! > 0 && (
              <>
                {' · '}
                <button type="button" onClick={() => onAbrir(`Contratos nuevos de ${NOMBRES_MES[mes - 1]!.toLowerCase()} ${t.anio}`, n.porMes[mes - 1]!)} className="font-semibold text-brand-red hover:underline">
                  ver cuáles
                </button>
              </>
            )}
          </p>
        </div>
      </Card>
    </section>
  );
}

/**
 * El año mes a mes, como la sección Alquileres del Tablero Comercial: el
 * gráfico de dos paneles —lo emitido y lo que gana la inmobiliaria— y, abajo,
 * la planilla con cada número. Tocar un mes lo marca en los dos.
 */
function EvolucionAnual({ t }: { t: TableroAlquileresDto }) {
  const enCurso = t.anio === Number(t.hoy.slice(0, 4));
  const [mes, setMes] = useState(enCurso ? Number(t.hoy.slice(5, 7)) : 12);
  const meses = Array.from({ length: 12 }, (_, i) => `${t.anio}-${String(i + 1).padStart(2, '0')}`);
  // Los gráficos van en pesos, la moneda de toda la cartera de Vacker.
  const evolucion = (m: string) => t.evolucion.find((x) => x.mes === m && x.moneda === 'ARS');
  const ingreso = (m: string) => t.ingresos.find((x) => x.mes === m && x.moneda === 'ARS');
  const deIngreso = (campo: 'honorarios' | 'gastos' | 'punitorios' | 'comisiones') => meses.map((m) => ingreso(m)?.[campo] ?? 0);
  const totalIngreso = (m: string) => {
    const i = ingreso(m);
    return i ? i.honorarios + i.gastos + i.punitorios + (i.comisiones ?? 0) : 0;
  };

  const emitido = meses.map((m) => evolucion(m)?.emitido ?? 0);
  const cobrado = meses.map((m) => evolucion(m)?.cobrado ?? 0);
  const ingresos = meses.map(totalIngreso);
  const ingresosAntes = meses.map((m) => totalIngreso(`${t.anio - 1}${m.slice(4)}`));
  const pctCobrado = (c: number, e: number) => (e > 0 ? (c / e) * 100 : 0);

  if (suma(emitido) === 0 && suma(ingresos) === 0) {
    return <p className="p-5 text-sm text-muted">Todavía no hay alquileres generados en {t.anio}.</p>;
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
      valores: meses.map((_, i) => pctCobrado(cobrado[i]!, emitido[i]!)),
      // Se recalcula sobre los totales: el promedio de los porcentajes mentiría.
      total: pctCobrado(suma(cobrado), suma(emitido)),
      formato: porcentaje,
    },
    { label: 'Honorarios', valores: honorarios, total: suma(honorarios), formato: plata, separa: true },
    { label: 'Gastos adm.', valores: gastos, total: suma(gastos), formato: plata },
    { label: 'Punitorios', valores: punitorios, total: suma(punitorios), formato: plata },
    { label: 'Comisiones e informes', valores: comisiones, total: suma(comisiones), formato: plata },
    { label: 'Ingresos', valores: ingresos, total: suma(ingresos), formato: plata, destaca: true },
    { label: `Ingresos ${t.anio - 1}`, valores: ingresosAntes, total: suma(ingresosAntes), formato: plata },
  ];
  const i = mes - 1;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PeriodosChart
        titulo={`Alquileres e ingresos por mes de ${t.anio}`}
        etiquetas={ABREV_MES}
        barras={emitido}
        linea={ingresos}
        formatoBarras={plata}
        formatoLinea={plata}
        nombreBarras="Alquileres emitidos $"
        nombreLinea="Ingresos de la inmobiliaria $"
        nombreLineaCorto="Ingresos"
        transcurridos={periodosTranscurridos(t.anio, 'mes')}
        seleccionado={mes}
        onSelect={setMes}
        pista="tocá una barra o un mes"
      />
      <PeriodosTabla
        titulo={`Alquileres e ingresos por mes de ${t.anio}`}
        etiquetas={ABREV_MES}
        filas={filas}
        seleccionado={mes}
        onSelect={setMes}
        anchoMinimo="min-w-[60rem]"
      />
      <p className="text-sm text-muted">
        <span className="font-bold text-ink">{NOMBRES_MES[i]}</span>: cobrado al cierre {pct(cobrado[i]!, emitido[i]!)} de lo emitido · ingresos{' '}
        {fmtMoneda(ingresos[i]!, 'ARS')}
        {ingresosAntes[i]! > 0 ? ` (${fmtMoneda(ingresosAntes[i]!, 'ARS')} en ${t.anio - 1})` : ''}
      </p>
    </div>
  );
}

/**
 * El tablero del módulo (reglas 26 a 32), armado con las piezas del Tablero
 * Comercial: tarjetas con ícono que se abren, rótulos de sección con ícono y el
 * gráfico de dos paneles con su planilla. Cada número con lupa abre la lista de
 * lo que cuenta, y esa lista suma el número: los dos llegan juntos de la API,
 * del mismo cálculo.
 */
export function TableroAlquileres({ tableros, tipoInicial = 'todos' }: { tableros: TablerosAlquileresDto; tipoInicial?: FiltroTipoContrato }) {
  const router = useRouter();
  const pathname = usePathname();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [actualizando, startTransition] = useTransition();
  // Los tres cortes ya están acá: cambiar de tipo es instantáneo (Javier,
  // 6/10/2026: «parece que no está funcionando»). Solo el año vuelve a pedir.
  const [tipo, setTipo] = useState<FiltroTipoContrato>(tipoInicial);
  const t = tableros[tipo];
  const [anioElegido, setAnioElegido] = useState(t.anio);
  const elegirTipo = (nuevo: FiltroTipoContrato) => {
    setTipo(nuevo);
    // La dirección acompaña, sin pedirle nada al servidor.
    window.history.replaceState(null, '', direccion(pathname, t.hoy, t.anio, nuevo));
  };
  const elegirAnio = (anio: number) => {
    setAnioElegido(anio);
    startTransition(() => router.push(direccion(pathname, t.hoy, anio, tipo), { scroll: false }));
  };
  const abrir = (titulo: string, indicador: Indicador, columnas: [Columna, string][], extra: Partial<Detalle> = {}) => () => setDetalle({ titulo, indicador, columnas, ...extra });
  const mes = mesLargo(`${t.mes}-01`);
  const mesCorto = mes.split(' ')[0]!;

  // Las tres ventanas de vencimiento juntas, para la tarjeta de la cartera.
  const vencen90: Indicador = { valor: suma(t.tareas.vencen.map((v) => v.indicador.valor)), filas: t.tareas.vencen.flatMap((v) => v.indicador.filas) };
  // Lo que ganó la inmobiliaria en el mes en curso, en pesos.
  const ingresoMes = t.ingresos.find((i) => i.mes === t.mes && i.moneda === 'ARS');
  const ganado = ingresoMes ? ingresoMes.honorarios + ingresoMes.gastos + ingresoMes.punitorios + (ingresoMes.comisiones ?? 0) : 0;

  type Tarea = { icono: string; titulo: string; ind: Indicador; columnas: [Columna, string][]; total?: MonedaAlquiler; accion?: Detalle['accion'] };
  const aIndexar = { href: '/alquileres/indexaciones', texto: 'Ir a indexar' };
  const tareas: Tarea[] = [
    { icono: '⏰', titulo: 'Indexaciones vencidas', ind: t.tareas.indexacionesVencidas, columnas: VISTAS.indexaciones, accion: aIndexar },
    { icono: '📈', titulo: `Indexaciones de los próximos ${DIAS_TABLERO_PROXIMOS} días`, ind: t.tareas.indexacionesProximas, columnas: VISTAS.indexaciones, accion: aIndexar },
    { icono: '🪜', titulo: `Escalones que empiezan en los próximos ${DIAS_TABLERO_PROXIMOS} días`, ind: t.tareas.escalones, columnas: VISTAS.escalones },
    ...t.tareas.vencen.map((v) => ({
      icono: '📅',
      titulo: v.dias === 30 ? 'Contratos vencidos o que vencen en 30 días' : `Contratos que vencen ${v.dias === 60 ? 'entre 31 y 60 días' : 'entre 61 y 90 días'}`,
      ind: v.indicador,
      columnas: VISTAS.vencen,
    })),
    { icono: '🔐', titulo: 'Depósitos a devolver', ind: t.tareas.depositos, columnas: VISTAS.depositos },
    { icono: '🧾', titulo: 'Propietarios para liquidar', ind: t.tareas.liquidaciones, columnas: VISTAS.liquidaciones, total: 'ARS', accion: { href: '/alquileres/liquidaciones/nueva', texto: 'Ir a liquidar' } },
    { icono: '⚠️', titulo: 'Inquilinos con deuda de más de 30 días', ind: t.tareas.deudores, columnas: VISTAS.deudores, total: 'ARS', accion: { href: '/alquileres/cobros/nuevo', texto: 'Ir a cobrar' } },
    { icono: '✍️', titulo: 'Contratos vigentes sin el firmado cargado', ind: t.tareas.sinFirmar, columnas: VISTAS.sinFirmar },
    { icono: '🛠️', titulo: 'Reclamos abiertos', ind: t.tareas.reclamos, columnas: VISTAS.reclamos, accion: { href: '/alquileres/reclamos', texto: 'Ir a reclamos' } },
    { icono: '🛡️', titulo: `Pólizas vencidas o que vencen en ${DIAS_TABLERO_PROXIMOS} días`, ind: t.tareas.polizas, columnas: VISTAS.polizas },
    {
      icono: '💸',
      titulo: 'Boletas que paga la inmobiliaria, vencidas o a 7 días',
      ind: t.tareas.boletas,
      columnas: VISTAS.boletas,
      total: 'ARS',
      accion: { href: '/alquileres/impuestos?ver=control', texto: 'Ir a impuestos y servicios' },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Dashboard">
        {actualizando && (
          <span role="status" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-brand-red" />
            Actualizando…
          </span>
        )}
        <FiltroTipo tipo={tipo} cambiar={elegirTipo} />
        <FiltroAnioAlquileres t={t} anio={anioElegido} cambiar={elegirAnio} />
      </EncabezadoPagina>

      <div aria-busy={actualizando} className={`flex flex-col gap-5 transition-opacity ${actualizando ? 'pointer-events-none opacity-50' : ''}`}>
        <section className="flex flex-col gap-2">
          <TituloSeccion icono="🏘️">Cartera</TituloSeccion>
          {/* Con alquileres en dólares hay una tarjeta más: cinco columnas, para que no quede una sola abajo. */}
          <div className={`grid grid-cols-2 gap-3 ${t.cartera.alquilerMensual.length > 1 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <Ancha>
              <KpiCard
                label="Contratos vigentes"
                value={fmtNum(t.cartera.vigentes.valor)}
                sub={`${t.cartera.vivienda} ${t.cartera.vivienda === 1 ? 'particular' : 'particulares'} · ${t.cartera.comercial} ${t.cartera.comercial === 1 ? 'comercial' : 'comerciales'}`}
                icon="📄"
                tone="brand"
                onClick={abrir('Contratos vigentes', t.cartera.vigentes, VISTAS.contratos)}
              />
            </Ancha>
            {t.cartera.alquilerMensual.map((a) => (
              <Ancha key={a.moneda}>
                <KpiCard
                  label={a.moneda === 'USD' ? 'Alquiler mensual U$S' : 'Alquiler mensual'}
                  value={fmtMoneda(a.indicador.valor, a.moneda)}
                  sub={`de ${a.indicador.filas.length} ${a.indicador.filas.length === 1 ? 'contrato' : 'contratos'}${a.moneda === 'USD' ? ' en dólares' : ''}`}
                  icon="💰"
                  onClick={abrir(`Alquiler mensual${a.moneda === 'USD' ? ' en dólares' : ''}`, a.indicador, VISTAS.alquilerMensual, { total: a.moneda })}
                />
              </Ancha>
            ))}
            <Ancha>
              <KpiCard
                label={`Ingresos de ${mesCorto}`}
                value={fmtMoneda(ganado, 'ARS')}
                sub={ingresoMes ? `honorarios ${fmtMoneda(ingresoMes.honorarios, 'ARS')} · gastos ${fmtMoneda(ingresoMes.gastos, 'ARS')}` : 'de la inmobiliaria, cobrados'}
                icon="🏦"
                tone="success"
              />
            </Ancha>
            <Ancha>
              <KpiCard
                label="Vencen en 90 días"
                value={fmtNum(vencen90.valor)}
                sub="contratos para renovar"
                icon="📅"
                tone={vencen90.valor ? 'warning' : 'default'}
                onClick={abrir('Contratos que vencen en los próximos 90 días', vencen90, VISTAS.vencen)}
              />
            </Ancha>
          </div>
          {t.tipo === 'todos' && <RepartoTipo porTipo={t.cartera.porTipo} onElegir={elegirTipo} />}
        </section>

        <ContratosNuevos key={`${t.anio}-${t.tipo}`} t={t} onAbrir={(titulo, ind) => setDetalle({ titulo, indicador: ind, columnas: VISTAS.nuevos })} />

        {t.cobranza.map((c) => (
          <section key={c.moneda} className="flex flex-col gap-2">
            <TituloSeccion icono="💵" detalle={c.moneda === 'USD' ? 'en dólares' : undefined}>
              Cobranza de {mes}
            </TituloSeccion>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Alquileres emitidos" value={fmtNum(c.emitidos.valor)} sub="del mes" icon="🧾" onClick={abrir(`Alquileres emitidos de ${mes}`, c.emitidos, VISTAS.cobranza)} />
              <KpiCard
                label="Alquileres cobrados"
                value={fmtNum(c.cobrados.valor)}
                sub={`${pct(c.cobrados.valor, c.emitidos.valor)} de los emitidos`}
                icon="✅"
                tone="success"
                onClick={abrir(`Alquileres cobrados del todo, ${mes}`, c.cobrados, VISTAS.cobranza)}
              />
              <Ancha>
                <KpiCard
                  label="Importe emitido"
                  value={fmtMoneda(c.importeEmitido.valor, c.moneda)}
                  sub="lo que hay que cobrar"
                  icon="📄"
                  onClick={abrir(`Importe emitido de ${mes}`, c.importeEmitido, VISTAS.cobranza, { total: c.moneda })}
                />
              </Ancha>
              <Ancha>
                <KpiCard
                  label="Importe cobrado"
                  value={fmtMoneda(c.importeCobrado.valor, c.moneda)}
                  sub={`${pct(c.importeCobrado.valor, c.importeEmitido.valor)} de lo emitido`}
                  icon="💵"
                  tone="success"
                  onClick={abrir(`Importe cobrado de ${mes}`, c.importeCobrado, VISTAS.cobrado, { total: c.moneda })}
                />
              </Ancha>
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <TituloSeccion icono="⏳" detalle="deuda vencida de inquilinos, por antigüedad">
            Morosidad
          </TituloSeccion>
          {t.morosidad.length === 0 ? (
            <Card className="py-4 text-sm text-success">Ningún inquilino tiene deuda vencida.</Card>
          ) : (
            t.morosidad.map((m) => (
              <div key={m.moneda} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <Ancha>
                  <KpiCard
                    label={`Deuda vencida${m.moneda === 'USD' ? ' U$S' : ''}`}
                    value={fmtMoneda(m.total.valor, m.moneda)}
                    sub={`${m.total.filas.length} ${m.total.filas.length === 1 ? 'concepto' : 'conceptos'} · ${new Set(m.total.filas.map((f) => f.inquilino)).size} inquilinos`}
                    icon="⏳"
                    tone="warning"
                    onClick={abrir(`Deuda vencida de inquilinos${m.moneda === 'USD' ? ' en dólares' : ''}`, m.total, VISTAS.mora, { total: m.moneda })}
                  />
                </Ancha>
                {m.tramos.map((x) => (
                  <Ancha key={x.tramo}>
                    <KpiCard
                      label={NOMBRE_TRAMO[x.tramo]}
                      value={fmtMoneda(x.indicador.valor, m.moneda)}
                      sub={`${x.indicador.filas.length} ${x.indicador.filas.length === 1 ? 'concepto' : 'conceptos'}`}
                      onClick={abrir(`Deuda vencida · ${NOMBRE_TRAMO[x.tramo].toLowerCase()}`, x.indicador, VISTAS.mora, { total: m.moneda })}
                    />
                  </Ancha>
                ))}
              </div>
            ))
          )}
        </section>

        <section className="flex flex-col gap-2">
          <TituloSeccion icono="📊" detalle={`en pesos, ${t.anio}`}>
            Alquileres e ingresos
          </TituloSeccion>
          <Card className="p-0">
            <EvolucionAnual key={t.anio} t={t} />
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <TituloSeccion icono="✅" detalle="tocá una para ver cuáles">
            Lo que hay que hacer
          </TituloSeccion>
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {tareas.map((x) => {
                const importe = x.total ? suma(x.ind.filas.map((f) => f.importe ?? 0)) : 0;
                return (
                  <li key={x.titulo}>
                    <button
                      type="button"
                      onClick={abrir(x.titulo, x.ind, x.columnas, { total: x.total, accion: x.accion })}
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
                        {importe > 0 && <span className="hidden whitespace-nowrap text-xs tabular-nums text-muted sm:inline">{fmtMoneda(importe, 'ARS')}</span>}
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

      {detalle && <DetalleModal {...detalle} hoy={t.hoy} onClose={() => setDetalle(null)} />}
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
const SIN_CORTE: Columna[] = ['contrato', 'fecha', 'vence', 'indexa', 'alquiler', 'importe', 'dias'];

/** Lo que va en una celda, formateado. */
function Celda({ f, col, etiqueta, hoy }: { f: FilaTablero; col: Columna; etiqueta: string; hoy: string }) {
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
      return f.dias == null ? <span className="text-muted">—</span> : <>{enDias(f.dias, etiqueta)}</>;
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
function DetalleModal({ titulo, indicador, columnas, total, accion, hoy, onClose }: Detalle & { hoy: string; onClose: () => void }) {
  const router = useRouter();
  const filas = indicador.filas;
  // Una columna vacía en todas las filas no se muestra.
  const cols = columnas.filter(([c]) => filas.some((f) => f[c] != null && f[c] !== ''));
  const conTotal = total && cols.some(([c]) => c === 'importe');
  const ir = (f: FilaTablero) => {
    if (f.href) router.push(f.href);
  };
  return (
    <Modal title={titulo} subtitle={`${filas.length} ${filas.length === 1 ? 'fila' : 'filas'}${filas.some((f) => f.href) ? ' · tocá una para abrir su ficha' : ''}`} onClose={onClose} size="xl">
      {filas.length === 0 ? (
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
                    {f.propiedad && primera?.[0] !== 'propiedad' && <span className="font-normal text-muted"> · {f.propiedad}</span>}
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
                    <th key={c} className={`${CLASE_TH} ${DERECHA.includes(c) ? 'text-right' : ''}`}>
                      {etiqueta}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} onClick={() => ir(f)} className={`border-b border-line last:border-0 ${f.href ? 'cursor-pointer hover:bg-surface/60' : ''}`}>
                    {cols.map(([c, etiqueta], i) => (
                      <td
                        key={c}
                        className={`px-3 py-2 align-top ${SIN_CORTE.includes(c) ? 'whitespace-nowrap' : ''} ${DERECHA.includes(c) ? 'text-right tabular-nums' : ''} ${c === 'importe' || i === 0 ? 'font-semibold text-ink' : 'text-muted'}`}
                      >
                        {i === 0 && f.href ? (
                          <Link href={f.href} onClick={(e) => e.stopPropagation()} className={`hover:text-brand-red ${CLASE_FOCO}`}>
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
                      <td key={c} className={`px-3 py-2 ${c === 'importe' ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>
                        {i === 0 ? 'Total' : c === 'importe' ? fmtMoneda(indicador.valor || suma(filas.map((f) => f.importe ?? 0)), total) : ''}
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
                <p className="text-sm font-bold text-ink sm:hidden">
                  Total {fmtMoneda(indicador.valor || suma(filas.map((f) => f.importe ?? 0)), total)}
                </p>
              ) : (
                <span />
              )}
              {accion && (
                <Link href={accion.href} className={`ml-auto rounded-brand bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark ${CLASE_FOCO}`}>
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
