'use client';

import type { FiltroTipoContrato, TableroAlquileresDto } from '@vacker/types';
import { KpiCard } from '@vacker/ui';
import { fmtNum } from '../../../lib/format';
import { periodoPorDefecto, type PeriodoTablero } from '../../../lib/periodo-tablero';
import { CLASE_FOCO } from '../piezas';
import { FiltroAnio, FiltroPeriodo } from '../selector-periodo';
import { CabezaBloque } from './bloque';
import { EvolucionAnual } from './evolucion-anual';
import { fmtTarjeta, pct, plural } from './formatos';
import { PartesDeIngresos } from './hoy';
import { delPeriodo } from './periodo';
import { FiltroTipo } from './tipo-de-contrato';
import { VISTAS, type Abrir, type Pedir } from './vistas';

/** Un renglón más de la tarjeta, en gris. */
const Linea = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-xs tabular-nums text-muted">{children}</span>
);

/** Lo de dólares que se abre por su cuenta: su lista se pide aparte (regla 79). */
function EnDolares({ texto, abrir }: { texto: string; abrir: () => void }) {
  return (
    <button
      type="button"
      onClick={abrir}
      className={`rounded-md text-xs tabular-nums text-muted underline-offset-2 hover:text-ink hover:underline ${CLASE_FOCO}`}
    >
      {texto}
    </button>
  );
}

/**
 * Regla 182: «Cómo vamos». Los filtros de tipo, período y año están acá y
 * son los únicos que cambian algo. Cuatro tarjetas del período, cada una con
 * su lista; un solo gráfico y la planilla plegada.
 */
export function ComoVamos({
  t,
  tipo,
  elegirTipo,
  periodo,
  elegirPeriodo,
  anio,
  elegirAnio,
  actualizando,
  abrir,
  pedir,
}: {
  /** El corte del tipo elegido. */
  t: TableroAlquileresDto;
  tipo: FiltroTipoContrato;
  elegirTipo: (tipo: FiltroTipoContrato) => void;
  periodo: PeriodoTablero;
  elegirPeriodo: (p: PeriodoTablero) => void;
  anio: number;
  elegirAnio: (anio: number) => void;
  actualizando: boolean;
  abrir: Abrir;
  pedir: Pedir;
}) {
  const p = delPeriodo(t, periodo);

  // --- Ingresos del período (reglas 30 y 75): el total y sus partes ---
  const ingresosArs = p.ingresos.find((i) => i.moneda === 'ARS')!;
  const ingresosUsd = p.ingresos.find((i) => i.moneda === 'USD');

  // --- Cobrado dentro del mes (regla 76): sobre los totales, nunca el promedio ---
  const cobranzaArs = p.cobranza.find((c) => c.moneda === 'ARS');
  const cobranzaUsd = p.cobranza.find((c) => c.moneda === 'USD');
  const principal = cobranzaArs ?? cobranzaUsd;
  const monedaCobranza = cobranzaArs ? 'ARS' : 'USD';

  // --- Cartera al cierre (regla 77): a hoy, con su lista; al cierre, se pide ---
  const vigentes = p.aHoy
    ? {
        valor: t.cartera.vigentes.valor,
        vivienda: t.cartera.vivienda,
        comercial: t.cartera.comercial,
      }
    : { valor: p.cierre!.vigentes, vivienda: p.cierre!.vivienda, comercial: p.cierre!.comercial };
  const porMes = p.aHoy
    ? t.cartera.alquilerMensual.map((a) => ({ moneda: a.moneda, valor: a.indicador.valor }))
    : p.cierre!.alquilerMensual;

  return (
    <section aria-labelledby="bloque-como-vamos">
      <CabezaBloque
        id="bloque-como-vamos"
        titulo="Cómo vamos"
        detalle={`${p.nombre}${p.aHoy ? ', hasta hoy' : ''}`}
      >
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
        <FiltroAnio hoy={t.hoy} anio={anio} cambiar={elegirAnio} />
      </CabezaBloque>

      <div
        aria-busy={actualizando}
        className={`flex flex-col gap-3 transition-opacity ${actualizando ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Ingresos"
            value={fmtTarjeta(ingresosArs.total)}
            onClick={
              ingresosArs.total
                ? pedir(
                    `Ingresos de la inmobiliaria, ${p.nombre}`,
                    'ingresos',
                    'ARS',
                    VISTAS.ingresos,
                    {
                      total: 'ARS',
                    },
                  )
                : undefined
            }
            pie={
              ingresosUsd ? (
                <EnDolares
                  texto={`${fmtTarjeta(ingresosUsd.total, 'USD')} en dólares`}
                  abrir={pedir(
                    `Ingresos de la inmobiliaria en dólares, ${p.nombre}`,
                    'ingresos',
                    'USD',
                    VISTAS.ingresos,
                    { total: 'USD' },
                  )}
                />
              ) : undefined
            }
          >
            <PartesDeIngresos partes={ingresosArs} moneda="ARS" />
          </KpiCard>

          {principal ? (
            <KpiCard
              label="Cobrado dentro del mes"
              value={pct(principal.alCierre, principal.importeEmitido)}
              sub={`de ${fmtTarjeta(principal.importeEmitido, monedaCobranza)} emitidos`}
              onClick={pedir(
                `Alquileres emitidos de ${p.nombre}`,
                'importeEmitido',
                monedaCobranza,
                VISTAS.cobranza,
                { total: monedaCobranza },
              )}
              pie={
                cobranzaArs && cobranzaUsd ? (
                  <EnDolares
                    texto={`En dólares: ${pct(cobranzaUsd.alCierre, cobranzaUsd.importeEmitido)} de ${fmtTarjeta(cobranzaUsd.importeEmitido, 'USD')}`}
                    abrir={pedir(
                      `Alquileres emitidos en dólares de ${p.nombre}`,
                      'importeEmitido',
                      'USD',
                      VISTAS.cobranza,
                      { total: 'USD' },
                    )}
                  />
                ) : undefined
              }
            />
          ) : (
            <KpiCard
              label="Cobrado dentro del mes"
              value="—"
              sub={`No hay alquileres emitidos en ${p.nombre}.`}
            />
          )}

          <KpiCard
            label="Contratos nuevos"
            value={fmtNum(p.nuevos.indicador.valor)}
            sub={`Alquiler inicial ${fmtTarjeta(p.nuevos.importe)}`}
            onClick={abrir(`Contratos nuevos de ${p.nombre}`, p.nuevos.indicador, VISTAS.nuevos, {
              total: 'ARS',
            })}
          />

          <KpiCard
            label="Cartera"
            value={fmtNum(vigentes.valor)}
            sub={`vigentes ${p.alCierre}`}
            onClick={
              p.aHoy
                ? abrir('Contratos vigentes, a hoy', t.cartera.vigentes, VISTAS.contratos)
                : pedir(`Contratos vigentes ${p.alCierre}`, 'vigentes', 'ARS', VISTAS.contratos)
            }
          >
            {porMes.map((a) => (
              <Linea key={a.moneda}>
                <strong className="font-bold text-ink">{fmtTarjeta(a.valor, a.moneda)}</strong> por
                mes
              </Linea>
            ))}
            <Linea>
              {plural(vigentes.vivienda, 'particular', 'particulares')} ·{' '}
              {plural(vigentes.comercial, 'comercial', 'comerciales')}
            </Linea>
          </KpiCard>
        </div>

        <EvolucionAnual t={t} periodo={periodo} elegir={elegirPeriodo} />
      </div>
    </section>
  );
}
