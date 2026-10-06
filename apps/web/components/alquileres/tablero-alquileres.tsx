'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Indicador, MonedaAlquiler, TableroAlquileresDto } from '@vacker/types';
import { mesLargo, sumarMesesIso } from '@vacker/domain';
import { KpiCard, Modal } from '@vacker/ui';
import { fmtFecha, fmtK, fmtMoneda, fmtNum } from '../../lib/format';
import { BarrasMes } from './barras-mes';

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

/**
 * El tablero del módulo (reglas 26 a 32). Cada número con lupa abre la lista
 * de lo que cuenta, y esa lista suma el número: los dos llegan juntos de la
 * API, del mismo cálculo.
 */
export function TableroAlquileres({ tablero: t }: { tablero: TableroAlquileresDto }) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const abrir = (titulo: string, indicador: Indicador, moneda: MonedaAlquiler | null = null) => () => setDetalle({ titulo, indicador, moneda });
  const mes = mesLargo(`${t.mes}-01`);

  // Los gráficos van en pesos, la moneda de toda la cartera de Vacker.
  const meses = Array.from({ length: 12 }, (_, i) => sumarMesesIso(`${t.mes}-01`, i - 11).slice(0, 7));
  const evolucion = meses.map((m) => {
    const e = t.evolucion.find((x) => x.mes === m && x.moneda === 'ARS');
    return e && e.emitido > 0 ? Math.round((e.cobrado / e.emitido) * 1000) / 10 : 0;
  });
  const ingresoDe = (m: string) => {
    const i = t.ingresos.find((x) => x.mes === m && x.moneda === 'ARS');
    return i ? i.honorarios + i.gastos + i.punitorios : 0;
  };
  const tareas: [string, Indicador][] = [
    ['Indexaciones vencidas', t.tareas.indexacionesVencidas],
    ['Indexaciones de los próximos 30 días', t.tareas.indexacionesProximas],
    ...t.tareas.vencen.map((v) => [`Contratos que vencen ${v.dias === 30 ? 'en 30 días' : v.dias === 60 ? 'entre 31 y 60 días' : 'entre 61 y 90 días'}`, v.indicador] as [string, Indicador]),
    ['Depósitos a devolver', t.tareas.depositos],
    ['Propietarios para liquidar', t.tareas.liquidaciones],
    ['Inquilinos con deuda de más de 30 días', t.tareas.deudores],
    ['Contratos vigentes sin el firmado cargado', t.tareas.sinFirmar],
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Cartera</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Ancha>
            <KpiCard
              label="Contratos vigentes"
              value={fmtNum(t.cartera.vigentes.valor)}
              sub={`${t.cartera.vivienda} vivienda · ${t.cartera.comercial} comercial`}
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
                onClick={abrir('Alquiler mensual administrado', a.indicador, a.moneda)}
              />
            </Ancha>
          ))}
          <KpiCard label="Propietarios" value={fmtNum(t.cartera.propietarios.valor)} onClick={abrir('Propietarios', t.cartera.propietarios)} />
          <KpiCard label="Inquilinos" value={fmtNum(t.cartera.inquilinos.valor)} onClick={abrir('Inquilinos', t.cartera.inquilinos)} />
        </div>
      </section>

      {t.cobranza.map((c) => (
        <section key={c.moneda} className="flex flex-col gap-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
            Cobranza de {mes}
            {c.moneda === 'USD' ? ' · dólares' : ''}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Alquileres emitidos" value={fmtNum(c.emitidos.valor)} onClick={abrir(`Alquileres emitidos de ${mes}`, c.emitidos, c.moneda)} />
            <KpiCard
              label="Alquileres cobrados"
              value={fmtNum(c.cobrados.valor)}
              sub={`${pct(c.cobrados.valor, c.emitidos.valor)} de los emitidos`}
              tone="success"
              onClick={abrir(`Alquileres cobrados del todo, ${mes}`, c.cobrados, c.moneda)}
            />
            <Ancha>
              <KpiCard label="Importe emitido" value={fmtMoneda(c.importeEmitido.valor, c.moneda)} onClick={abrir(`Importe emitido de ${mes}`, c.importeEmitido, c.moneda)} />
            </Ancha>
            <Ancha>
              <KpiCard
                label="Importe cobrado"
                value={fmtMoneda(c.importeCobrado.valor, c.moneda)}
                sub={`${pct(c.importeCobrado.valor, c.importeEmitido.valor)} de lo emitido`}
                tone="success"
                onClick={abrir(`Importe cobrado de ${mes}`, c.importeCobrado, c.moneda)}
              />
            </Ancha>
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Morosidad · deuda vencida de inquilinos</h2>
        {t.morosidad.length === 0 ? (
          <p className="rounded-brand border border-line bg-white px-4 py-4 text-sm text-success">Ningún inquilino tiene deuda vencida.</p>
        ) : (
          t.morosidad.map((m) => (
            <div key={m.moneda} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Ancha>
                <KpiCard
                  label={`Deuda vencida${m.moneda === 'USD' ? ' en dólares' : ''}`}
                  value={fmtMoneda(m.total.valor, m.moneda)}
                  sub={`${m.total.filas.length} conceptos`}
                  tone="warning"
                  onClick={abrir('Deuda vencida de inquilinos', m.total, m.moneda)}
                />
              </Ancha>
              {m.tramos.map((x) => (
                <Ancha key={x.tramo}>
                  <KpiCard label={NOMBRE_TRAMO[x.tramo]} value={fmtMoneda(x.indicador.valor, m.moneda)} onClick={abrir(`Deuda vencida · ${NOMBRE_TRAMO[x.tramo].toLowerCase()}`, x.indicador, m.moneda)} />
                </Ancha>
              ))}
            </div>
          ))
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarrasMes
          titulo="Cobrado al cierre de cada mes · % de lo emitido"
          meses={meses}
          series={[{ nombre: 'Cobrado', valores: evolucion }]}
          formato={(n) => `${Math.round(n)}%`}
          techoFijo={100}
        />
        <BarrasMes
          titulo="Ingresos de la inmobiliaria · honorarios, gastos y punitorios"
          meses={meses}
          series={[
            { nombre: 'Este año', valores: meses.map(ingresoDe) },
            { nombre: 'Año anterior', valores: meses.map((m) => ingresoDe(sumarMesesIso(`${m}-01`, -12).slice(0, 7))), tenue: true },
          ]}
          formato={(n) => `$${fmtK(n)}`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Lo que hay que hacer</h2>
        <ul className="divide-y divide-line rounded-brand border border-line bg-white">
          {tareas.map(([titulo, ind]) => (
            <li key={titulo}>
              <button
                type="button"
                onClick={abrir(titulo, ind)}
                disabled={ind.valor === 0}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm enabled:hover:bg-surface/60 disabled:cursor-default"
              >
                <span className={ind.valor === 0 ? 'text-muted' : 'text-ink'}>{titulo}</span>
                <span className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${ind.valor === 0 ? 'bg-surface text-muted' : 'bg-warning/15 text-warning'}`}>
                  {ind.valor}
                </span>
              </button>
            </li>
          ))}
        </ul>
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
