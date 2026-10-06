'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DIAS_TABLERO_PROXIMOS, NOMBRE_TIPO_CONTRATO, type FiltroTipoContrato, type Indicador, type MonedaAlquiler, type TableroAlquileresDto } from '@vacker/types';
import { mesLargo } from '@vacker/domain';
import { Card, KpiCard, Modal } from '@vacker/ui';
import { fmtFecha, fmtK, fmtMoneda, fmtNum } from '../../lib/format';
import { ABREV_MES, NOMBRES_MES, periodosTranscurridos } from '../../lib/meses';
import { PeriodosChart } from '../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../tablero/periodos-tabla';
import { EncabezadoPagina, TituloSeccion } from './piezas';

interface Detalle {
  titulo: string;
  indicador: Indicador;
  moneda: MonedaAlquiler | null;
}

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

/** Cambia un parámetro del tablero en la dirección, sin perder los otros. */
function useParametro() {
  const router = useRouter();
  const pathname = usePathname();
  return (t: TableroAlquileresDto, cambio: { anio?: number; tipo?: FiltroTipoContrato }) => {
    const q = new URLSearchParams();
    const anio = cambio.anio ?? t.anio;
    const tipo = cambio.tipo ?? t.tipo;
    if (anio !== Number(t.hoy.slice(0, 4))) q.set('anio', String(anio));
    if (tipo !== 'todos') q.set('tipo', tipo);
    router.push(`${pathname}${q.toString() ? `?${q}` : ''}`);
  };
}

/**
 * El año de los gráficos. Como el filtro del Tablero Comercial, pero sin
 * «Todos los años»: el gráfico es de doce meses de un año.
 */
function FiltroAnioAlquileres({ t }: { t: TableroAlquileresDto }) {
  const cambiar = useParametro();
  const hoy = Number(t.hoy.slice(0, 4));
  return (
    <select
      aria-label="Año"
      value={t.anio}
      onChange={(e) => cambiar(t, { anio: Number(e.target.value) })}
      className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink"
    >
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
 * Filtra el tablero entero, como las pestañas del Tablero Comercial.
 */
function FiltroTipo({ t }: { t: TableroAlquileresDto }) {
  const cambiar = useParametro();
  return (
    <div role="group" aria-label="Tipo de contrato" className="flex gap-1 rounded-brand border border-line bg-white p-1">
      {TIPOS.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          aria-pressed={t.tipo === v}
          onClick={() => cambiar(t, { tipo: v })}
          className={`rounded-brand px-3 py-1 text-sm font-semibold ${t.tipo === v ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** El reparto de la cartera, como en Gexion: cantidad, alquiler mensual y porcentaje de cada tipo. */
function RepartoTipo({ porTipo }: { porTipo: TableroAlquileresDto['cartera']['porTipo'] }) {
  if (porTipo.every((x) => x.cantidad === 0)) return null;
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        <span aria-hidden>⚖️</span> Particulares y comerciales · alquiler mensual en pesos
      </p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface" aria-hidden>
        {porTipo.map((x) => (
          <div key={x.tipo} style={{ width: `${x.pct}%` }} className={x.tipo === 'vivienda' ? 'bg-brand-red' : 'bg-ink/60'} />
        ))}
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {porTipo.map((x) => (
          <div key={x.tipo} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 font-semibold text-ink">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${x.tipo === 'vivienda' ? 'bg-brand-red' : 'bg-ink/60'}`} />
              {x.tipo === 'vivienda' ? 'Particulares' : 'Comerciales'} · {x.cantidad}
            </dt>
            <dd className="whitespace-nowrap tabular-nums text-muted">
              {fmtMoneda(x.importe, 'ARS')} · <span className="font-bold text-ink">{fmtNum(x.pct)}%</span>
            </dd>
          </div>
        ))}
      </dl>
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
export function TableroAlquileres({ tablero: t }: { tablero: TableroAlquileresDto }) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const abrir = (titulo: string, indicador: Indicador, moneda: MonedaAlquiler | null = null) => () => setDetalle({ titulo, indicador, moneda });
  const mes = mesLargo(`${t.mes}-01`);

  const tareas: [string, string, Indicador][] = [
    ['⏰', 'Indexaciones vencidas', t.tareas.indexacionesVencidas],
    ['📈', `Indexaciones de los próximos ${DIAS_TABLERO_PROXIMOS} días`, t.tareas.indexacionesProximas],
    ['🪜', `Escalones que empiezan en los próximos ${DIAS_TABLERO_PROXIMOS} días`, t.tareas.escalones],
    ...t.tareas.vencen.map(
      (v) =>
        ['📅', `Contratos que vencen ${v.dias === 30 ? 'en 30 días' : v.dias === 60 ? 'entre 31 y 60 días' : 'entre 61 y 90 días'}`, v.indicador] as [
          string,
          string,
          Indicador,
        ],
    ),
    ['🔐', 'Depósitos a devolver', t.tareas.depositos],
    ['🧾', 'Propietarios para liquidar', t.tareas.liquidaciones],
    ['⚠️', 'Inquilinos con deuda de más de 30 días', t.tareas.deudores],
    ['✍️', 'Contratos vigentes sin el firmado cargado', t.tareas.sinFirmar],
    ['🛠️', 'Reclamos abiertos', t.tareas.reclamos],
  ];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Dashboard">
        <FiltroTipo t={t} />
        <FiltroAnioAlquileres t={t} />
      </EncabezadoPagina>

      <section className="flex flex-col gap-2">
        <TituloSeccion icono="🏘️">Cartera</TituloSeccion>
        {/* Con alquileres en dólares hay una tarjeta más: cinco columnas, para que no quede una sola abajo. */}
        <div className={`grid grid-cols-2 gap-3 ${t.cartera.alquilerMensual.length > 1 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <Ancha>
            <KpiCard
              label="Contratos vigentes"
              value={fmtNum(t.cartera.vigentes.valor)}
              sub={`${t.cartera.vivienda} ${NOMBRE_TIPO_CONTRATO.vivienda.toLowerCase()} · ${t.cartera.comercial} ${NOMBRE_TIPO_CONTRATO.comercial.toLowerCase()}`}
              icon="📄"
              tone="brand"
              onClick={abrir('Contratos vigentes', t.cartera.vigentes)}
            />
          </Ancha>
          {t.cartera.alquilerMensual.map((a) => (
            <Ancha key={a.moneda}>
              <KpiCard
                label={`Alquiler mensual${a.moneda === 'USD' ? ' en dólares' : ''}`}
                value={fmtMoneda(a.indicador.valor, a.moneda)}
                sub="lo que se cobra este mes en la cartera"
                icon="💰"
                onClick={abrir('Alquiler mensual administrado', a.indicador, a.moneda)}
              />
            </Ancha>
          ))}
          <KpiCard label="Propietarios" value={fmtNum(t.cartera.propietarios.valor)} icon="🧑‍💼" onClick={abrir('Propietarios', t.cartera.propietarios)} />
          <KpiCard label="Inquilinos" value={fmtNum(t.cartera.inquilinos.valor)} icon="🔑" onClick={abrir('Inquilinos', t.cartera.inquilinos)} />
        </div>
        {t.tipo === 'todos' && <RepartoTipo porTipo={t.cartera.porTipo} />}
      </section>

      <ContratosNuevos key={`${t.anio}-${t.tipo}`} t={t} onAbrir={(titulo, ind) => setDetalle({ titulo, indicador: ind, moneda: 'ARS' })} />

      {t.cobranza.map((c) => (
        <section key={c.moneda} className="flex flex-col gap-2">
          <TituloSeccion icono="💵" detalle={c.moneda === 'USD' ? 'en dólares' : undefined}>
            Cobranza de {mes}
          </TituloSeccion>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Alquileres emitidos" value={fmtNum(c.emitidos.valor)} icon="🧾" onClick={abrir(`Alquileres emitidos de ${mes}`, c.emitidos, c.moneda)} />
            <KpiCard
              label="Alquileres cobrados"
              value={fmtNum(c.cobrados.valor)}
              sub={`${pct(c.cobrados.valor, c.emitidos.valor)} de los emitidos`}
              icon="✅"
              tone="success"
              onClick={abrir(`Alquileres cobrados del todo, ${mes}`, c.cobrados, c.moneda)}
            />
            <Ancha>
              <KpiCard label="Importe emitido" value={fmtMoneda(c.importeEmitido.valor, c.moneda)} icon="📄" onClick={abrir(`Importe emitido de ${mes}`, c.importeEmitido, c.moneda)} />
            </Ancha>
            <Ancha>
              <KpiCard
                label="Importe cobrado"
                value={fmtMoneda(c.importeCobrado.valor, c.moneda)}
                sub={`${pct(c.importeCobrado.valor, c.importeEmitido.valor)} de lo emitido`}
                icon="💵"
                tone="success"
                onClick={abrir(`Importe cobrado de ${mes}`, c.importeCobrado, c.moneda)}
              />
            </Ancha>
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <TituloSeccion icono="⏳" detalle="deuda vencida de inquilinos">
          Morosidad
        </TituloSeccion>
        {t.morosidad.length === 0 ? (
          <Card className="py-4 text-sm text-success">Ningún inquilino tiene deuda vencida.</Card>
        ) : (
          t.morosidad.map((m) => (
            <div key={m.moneda} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Ancha>
                <KpiCard
                  label={`Deuda vencida${m.moneda === 'USD' ? ' en dólares' : ''}`}
                  value={fmtMoneda(m.total.valor, m.moneda)}
                  sub={`${m.total.filas.length} conceptos`}
                  icon="⏳"
                  tone="warning"
                  onClick={abrir('Deuda vencida de inquilinos', m.total, m.moneda)}
                />
              </Ancha>
              {m.tramos.map((x) => (
                <Ancha key={x.tramo}>
                  <KpiCard
                    label={NOMBRE_TRAMO[x.tramo]}
                    value={fmtMoneda(x.indicador.valor, m.moneda)}
                    onClick={abrir(`Deuda vencida · ${NOMBRE_TRAMO[x.tramo].toLowerCase()}`, x.indicador, m.moneda)}
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
        <TituloSeccion icono="✅">Lo que hay que hacer</TituloSeccion>
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {tareas.map(([icono, titulo, ind]) => (
              <li key={titulo}>
                <button
                  type="button"
                  onClick={abrir(titulo, ind)}
                  disabled={ind.valor === 0}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm enabled:hover:bg-surface/60 disabled:cursor-default"
                >
                  <span className={ind.valor === 0 ? 'text-muted' : 'text-ink'}>
                    <span aria-hidden className="mr-1.5">
                      {icono}
                    </span>
                    {titulo}
                  </span>
                  <span
                    className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${ind.valor === 0 ? 'bg-surface text-muted' : 'bg-warning/15 text-warning'}`}
                  >
                    {ind.valor}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {detalle && <DetalleModal {...detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

/** El detalle de un número: la lista y, si es un importe, su total, que es el número de la tarjeta. */
function DetalleModal({ titulo, indicador, moneda, onClose }: Detalle & { onClose: () => void }) {
  const conImporte = indicador.filas.some((f) => f.importe != null);
  return (
    <Modal title={titulo} subtitle={`${indicador.filas.length} ${indicador.filas.length === 1 ? 'fila' : 'filas'}`} onClose={onClose} size="lg">
      {indicador.filas.length === 0 ? (
        <p className="text-sm text-muted">Nada por ahora.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {indicador.filas.map((f) => {
            const contenido = (
              <>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    {f.contrato ? `${f.contrato} · ` : ''}
                    {f.persona ?? f.detalle}
                  </span>
                  <span className="block text-xs text-muted">
                    {f.persona ? f.detalle : ''}
                    {f.fecha ? `${f.persona ? ' · ' : ''}${fmtFecha(f.fecha)}` : ''}
                  </span>
                </span>
                {f.importe != null && <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{fmtMoneda(f.importe, moneda ?? 'ARS')}</span>}
              </>
            );
            return (
              <li key={f.id}>
                {f.href ? (
                  <Link href={f.href} className="flex items-start justify-between gap-3 py-2.5 hover:bg-surface/60">
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex items-start justify-between gap-3 py-2.5">{contenido}</div>
                )}
              </li>
            );
          })}
          {conImporte && moneda && (
            <li className="flex justify-between py-2.5 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoneda(indicador.valor, moneda)}</span>
            </li>
          )}
        </ul>
      )}
    </Modal>
  );
}
