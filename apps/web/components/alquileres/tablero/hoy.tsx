'use client';

import {
  TRAMOS_MORA,
  type FilaTablero,
  type Indicador,
  type IndicadorDetalleTablero,
  type MonedaAlquiler,
  type TableroAlquileresDto,
  type TramoMora,
} from '@vacker/types';
import { KpiCard } from '@vacker/ui';
import { fmtNum } from '../../../lib/format';
import { CLASE_FOCO } from '../piezas';
import { CabezaBloque, diaCorto, fechaLarga, nombreDelMes } from './bloque';
import { fmtTarjeta, pct, plural, suma, totalesPorMoneda } from './formatos';
import { LineaDelMes } from './linea-del-mes';
import { VISTAS, type Abrir, type Columna, type Detalle } from './vistas';

/** Abre la lista de un flujo del mes en curso: se pide al abrirla (regla 79). */
export type PedirDelMes = (
  titulo: string,
  indicador: IndicadorDetalleTablero,
  moneda: MonedaAlquiler,
  columnas: [Columna, string][],
  extra?: Partial<Detalle>,
) => () => void;

/** Un número con su lista, juntando las dos monedas: la lista ya trae cada fila con la suya. */
const juntas = (inds: (Indicador | undefined)[]): Indicador => {
  const filas = inds.flatMap((i) => i?.filas ?? []);
  return { valor: inds.reduce((s, i) => s + (i?.valor ?? 0), 0), filas };
};

/**
 * Regla 185: la antigüedad de la deuda, de menos a más urgente, con los
 * colores de la urgencia (`warning` y `danger`, nunca el de la marca).
 */
const TRAMO: Record<TramoMora, { nombre: string; color: string }> = {
  '1-30': { nombre: 'Hasta 30 d', color: 'bg-warning/60' },
  '31-60': { nombre: '31 a 60 d', color: 'bg-warning' },
  '61-90': { nombre: '61 a 90 d', color: 'bg-danger' },
  '90+': { nombre: 'Más de 90 d', color: 'bg-danger-dark' },
};
const NOMBRE_LARGO_TRAMO: Record<TramoMora, string> = {
  '1-30': 'hasta 30 días',
  '31-60': '31 a 60 días',
  '61-90': '61 a 90 días',
  '90+': 'más de 90 días',
};

/** Una barra partida: cada parte con su ancho y su color. */
function Barra({ partes }: { partes: { valor: number; color: string }[] }) {
  const total = suma(partes.map((p) => p.valor));
  return (
    <span aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface">
      {total > 0 &&
        partes
          .filter((p) => p.valor > 0)
          .map((p, i) => (
            <span
              key={i}
              className={`block h-full ${p.color}`}
              style={{ width: `${(p.valor / total) * 100}%` }}
            />
          ))}
    </span>
  );
}

const Linea = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-xs tabular-nums text-muted">{children}</span>
);

/** Cuántas personas distintas: la fila lleva a la cuenta de cada una. */
const personas = (filas: FilaTablero[]) => new Set(filas.map((f) => f.href ?? f.persona)).size;

/**
 * Regla 177: «Hoy» es siempre el mes en curso, a hoy y de toda la cartera
 * —no lo cambian el tipo, el período ni el año—. La línea del mes (regla
 * 178) y cuatro tarjetas, cada una con su lista (regla 26).
 */
export function BloqueHoy({
  t,
  abrir,
  pedirDelMes,
}: {
  /** El corte de todos los contratos. */
  t: TableroAlquileresDto;
  abrir: Abrir;
  pedirDelMes: PedirDelMes;
}) {
  const mes = nombreDelMes(t.mes);
  return (
    <section aria-labelledby="bloque-hoy">
      <CabezaBloque id="bloque-hoy" titulo="Hoy" detalle={fechaLarga(t.hoy)} />
      <div className="flex flex-col gap-3">
        {t.ciclo && <LineaDelMes ciclo={t.ciclo} hoy={t.hoy} />}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cobranza t={t} mes={mes} abrir={abrir} />
          <Deuda t={t} abrir={abrir} />
          <ALiquidar t={t} abrir={abrir} />
          <IngresosDelMes t={t} mes={mes} pedirDelMes={pedirDelMes} />
        </div>
      </div>
    </section>
  );
}

/**
 * Cobranza de {mes}: cuánto se cobró de lo emitido, en pesos. Lo que falta
 * está atrasado si ya pasó el vencimiento del mes (regla 178); si no, todavía
 * vence. Su lista son los alquileres emitidos, con su estado.
 */
function Cobranza({ t, mes, abrir }: { t: TableroAlquileresDto; mes: string; abrir: Abrir }) {
  const titulo = `Cobranza de ${mes}`;
  const ars = t.cobranza.find((c) => c.moneda === 'ARS');
  const usd = t.cobranza.find((c) => c.moneda === 'USD');
  const principal = ars ?? usd;
  if (!principal)
    return <KpiCard label={titulo} value="—" sub={`No hay alquileres emitidos de ${mes}.`} />;
  const moneda: MonedaAlquiler = ars ? 'ARS' : 'USD';
  const atrasados = t.ciclo != null && t.hoy > t.ciclo.vencimiento.fecha;
  const faltan = principal.emitidos.valor - principal.cobrados.valor;
  const cobrado = principal.importeCobrado.valor;
  const emitido = principal.importeEmitido.valor;
  return (
    <KpiCard
      label={titulo}
      value={pct(cobrado, emitido)}
      onClick={abrir(
        `Alquileres emitidos de ${mes}`,
        juntas([ars?.emitidos, usd?.emitidos]),
        VISTAS.cobranza,
        { total: moneda },
      )}
    >
      <Barra
        partes={[
          { valor: cobrado, color: 'bg-success' },
          {
            valor: Math.max(emitido - cobrado, 0),
            color: atrasados ? 'bg-danger' : 'bg-inactive-accent',
          },
        ]}
      />
      <Linea>
        <strong className="font-bold text-ink">{fmtTarjeta(cobrado, moneda)}</strong> de{' '}
        {fmtTarjeta(emitido, moneda)}
      </Linea>
      <Linea>
        {fmtNum(principal.cobrados.valor)} de {fmtNum(principal.emitidos.valor)} pagaron
        {faltan > 0 && (
          <>
            {' · '}
            <strong
              data-falta={atrasados ? 'atrasado' : 'por-vencer'}
              className={atrasados ? 'font-bold text-danger' : 'font-semibold text-muted'}
            >
              {plural(
                faltan,
                atrasados ? 'atrasado' : 'por vencer',
                atrasados ? 'atrasados' : 'por vencer',
              )}
            </strong>
          </>
        )}
      </Linea>
      {ars && usd && (
        <Linea>
          {fmtTarjeta(usd.importeCobrado.valor, 'USD')} de{' '}
          {fmtTarjeta(usd.importeEmitido.valor, 'USD')} · {fmtNum(usd.cobrados.valor)} de{' '}
          {fmtNum(usd.emitidos.valor)} pagaron
        </Linea>
      )}
    </KpiCard>
  );
}

/**
 * Deuda vencida de inquilinos, a hoy (regla 29), con la antigüedad en la barra.
 * Cada tramo de la leyenda abre su lista: en el teléfono se toca la leyenda,
 * no la barra de 8px. Reemplaza la tarea «Inquilinos con deuda de más de 30
 * días».
 */
function Deuda({ t, abrir }: { t: TableroAlquileresDto; abrir: Abrir }) {
  const ars = t.morosidad.find((m) => m.moneda === 'ARS');
  const usd = t.morosidad.find((m) => m.moneda === 'USD');
  const principal = ars ?? usd;
  if (!principal)
    return (
      <KpiCard
        label="Deuda vencida"
        value={fmtTarjeta(0)}
        sub="Ningún inquilino tiene deuda vencida."
        tone="success"
      />
    );
  const moneda: MonedaAlquiler = ars ? 'ARS' : 'USD';
  const filas = [...(ars?.total.filas ?? []), ...(usd?.total.filas ?? [])];
  const masDe30 = personas(filas.filter((f) => (f.dias ?? 0) > 30));
  const tramos = TRAMOS_MORA.map((tramo) => ({
    tramo,
    indicador: principal.tramos.find((x) => x.tramo === tramo)?.indicador ?? {
      valor: 0,
      filas: [],
    },
  }));
  return (
    <KpiCard
      label="Deuda vencida"
      value={fmtTarjeta(principal.total.valor, moneda)}
      tone="danger"
      onClick={abrir(
        'Deuda vencida de inquilinos, a hoy',
        juntas([ars?.total, usd?.total]),
        VISTAS.mora,
        { total: moneda },
      )}
      pie={
        <ul aria-label="Deuda vencida por antigüedad" className="flex flex-wrap gap-x-3 gap-y-0.5">
          {tramos
            .filter((x) => x.indicador.valor > 0)
            .map((x) => (
              <li key={x.tramo}>
                <button
                  type="button"
                  onClick={abrir(
                    `Deuda vencida · ${NOMBRE_LARGO_TRAMO[x.tramo]}, a hoy`,
                    x.indicador,
                    VISTAS.mora,
                    { total: moneda },
                  )}
                  className={`-ml-1.5 inline-flex min-h-7 items-center gap-1.5 rounded-md px-1.5 text-left text-[11px] tabular-nums text-muted hover:bg-black/[0.04] hover:text-ink pointer-coarse:min-h-10 ${CLASE_FOCO}`}
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-sm ${TRAMO[x.tramo].color}`}
                  />
                  <span>
                    {TRAMO[x.tramo].nombre}{' '}
                    <span className="whitespace-nowrap">
                      {fmtTarjeta(x.indicador.valor, moneda)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      }
    >
      <Barra
        partes={tramos.map((x) => ({ valor: x.indicador.valor, color: TRAMO[x.tramo].color }))}
      />
      <Linea>
        {plural(personas(filas), 'inquilino', 'inquilinos')} · {fmtNum(masDe30)} con más de 30 días
      </Linea>
      {ars && usd && <Linea>{fmtTarjeta(usd.total.valor, 'USD')} en dólares</Linea>}
    </KpiCard>
  );
}

/**
 * A liquidar a propietarios: el neto, con la misma cuenta de la tarea
 * «Propietarios para liquidar», que sale de su lista. Con la fecha de pago
 * del mes (regla 178).
 */
function ALiquidar({ t, abrir }: { t: TableroAlquileresDto; abrir: Abrir }) {
  const liq = t.tareas.liquidaciones;
  const totales = totalesPorMoneda(liq.filas, 'ARS');
  const pago = t.ciclo?.pagoPropietarios.fecha;
  const fechaDePago = pago && (
    <Linea>
      {pago < t.hoy ? 'Se pagó el' : pago === t.hoy ? 'Se paga hoy,' : 'Se paga el'}{' '}
      {diaCorto(pago)}
    </Linea>
  );
  if (liq.filas.length === 0)
    return (
      <KpiCard
        label="A liquidar a propietarios"
        value={fmtTarjeta(0)}
        sub="Ningún propietario con cobros sin liquidar."
      >
        {fechaDePago}
      </KpiCard>
    );
  // En pesos; si solo hay dólares, en dólares.
  const moneda: MonedaAlquiler = totales.ARS !== 0 || totales.USD === 0 ? 'ARS' : 'USD';
  return (
    <KpiCard
      label="A liquidar a propietarios"
      value={fmtTarjeta(totales[moneda], moneda)}
      onClick={abrir('Propietarios para liquidar', liq, VISTAS.liquidaciones, {
        total: 'ARS',
        accion: { href: '/alquileres/liquidaciones/nueva', texto: 'Ir a liquidar' },
      })}
    >
      <Linea>
        <strong className="font-bold text-ink">
          {plural(personas(liq.filas), 'propietario', 'propietarios')}
        </strong>{' '}
        con cobros sin liquidar
      </Linea>
      {totales.ARS !== 0 && totales.USD !== 0 && (
        <Linea>{fmtTarjeta(totales.USD, 'USD')} en dólares</Linea>
      )}
      {fechaDePago}
    </KpiCard>
  );
}

const PARTES = [
  ['honorarios', 'Honorarios'],
  ['gastos', 'Gastos adm.'],
  ['punitorios', 'Punitorios'],
  ['comisiones', 'Comisiones e informes'],
] as const;

/** Las partes de unos ingresos que no están en cero, en dos columnas (reglas 177 y 182). */
export function PartesDeIngresos({
  partes,
  moneda,
}: {
  partes: Record<(typeof PARTES)[number][0], number>;
  moneda: MonedaAlquiler;
}) {
  const conAlgo = PARTES.filter(([k]) => partes[k] !== 0);
  if (conAlgo.length === 0) return null;
  // Cada parte en su renglón: el nombre a la izquierda y el importe a la
  // derecha; en una tarjeta angosta (dos por fila en el teléfono), el importe
  // baja abajo del nombre en vez de cortarlo.
  return (
    <dl className="flex flex-col gap-0.5 text-xs tabular-nums">
      {conAlgo.map(([k, nombre]) => (
        <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-2">
          <dt className="text-muted">{nombre}</dt>
          <dd className="ml-auto whitespace-nowrap font-semibold text-ink">
            {fmtTarjeta(partes[k], moneda)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Lo que ganó la inmobiliaria en el mes y de qué: un flujo, que pide su lista al abrirla. */
function IngresosDelMes({
  t,
  mes,
  pedirDelMes,
}: {
  t: TableroAlquileresDto;
  mes: string;
  pedirDelMes: PedirDelMes;
}) {
  const de = (moneda: MonedaAlquiler) => {
    const i = t.ingresos.find((x) => x.mes === t.mes && x.moneda === moneda);
    const partes = {
      honorarios: i?.honorarios ?? 0,
      gastos: i?.gastos ?? 0,
      punitorios: i?.punitorios ?? 0,
      comisiones: i?.comisiones ?? 0,
    };
    return { partes, total: suma(Object.values(partes)) };
  };
  const ars = de('ARS');
  const usd = de('USD');
  const titulo = `Ingresos de ${mes}`;
  return (
    <KpiCard
      label={titulo}
      value={fmtTarjeta(ars.total)}
      onClick={
        ars.total
          ? pedirDelMes(`Ingresos de la inmobiliaria, ${mes}`, 'ingresos', 'ARS', VISTAS.ingresos, {
              total: 'ARS',
            })
          : undefined
      }
      pie={
        usd.total === 0 ? undefined : (
          <button
            type="button"
            onClick={pedirDelMes(
              `Ingresos de la inmobiliaria en dólares, ${mes}`,
              'ingresos',
              'USD',
              VISTAS.ingresos,
              { total: 'USD' },
            )}
            className={`rounded-md text-xs tabular-nums text-muted underline-offset-2 hover:text-ink hover:underline ${CLASE_FOCO}`}
          >
            {fmtTarjeta(usd.total, 'USD')} en dólares
          </button>
        )
      }
    >
      <PartesDeIngresos partes={ars.partes} moneda="ARS" />
    </KpiCard>
  );
}
