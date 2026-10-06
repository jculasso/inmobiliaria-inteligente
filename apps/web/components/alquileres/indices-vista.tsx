'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { IndicesDto } from '@vacker/types';
import { Card } from '@vacker/ui';
import { fmtFecha } from '../../lib/format';
import { ABREV_MES, NOMBRES_MES, periodosTranscurridos } from '../../lib/meses';
import { inputClass } from '../form-ui';
import { PeriodosChart } from '../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../tablero/periodos-tabla';
import { CLASE_TH, EncabezadoPagina, TituloSeccion } from './piezas';

const valor = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 4 });
const porciento = (v: number | null) => (v == null || Number.isNaN(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const cuando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

/** De dónde sale el índice y hasta cuándo está cargado. */
function Origen({ d }: { d: IndicesDto }) {
  return (
    <p className="text-sm text-muted">
      {d.fuente}. Último valor: <span className="font-semibold text-ink">{d.ultimaFecha ? (d.indice === 'IPC' ? NOMBRES_MES[Number(d.ultimaFecha.slice(5, 7)) - 1] + ' ' + d.ultimaFecha.slice(0, 4) : fmtFecha(d.ultimaFecha)) : 'sin valores'}</span> · actualizado el {cuando(d.actualizado)}.
    </p>
  );
}

/** El ICL, día por día, en un rango que se elige (por defecto, los últimos 60 días cargados). */
function Icl({ d }: { d: IndicesDto }) {
  const router = useRouter();
  const pathname = usePathname();
  const [desde, setDesde] = useState(d.valores.at(-1)?.fecha ?? '');
  const [hasta, setHasta] = useState(d.valores[0]?.fecha ?? '');
  return (
    <div className="flex flex-col gap-3">
      <Origen d={d} />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`${pathname}?ver=icl&desde=${desde}&hasta=${hasta}`);
        }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Desde
          <input type="date" className={`${inputClass} w-44`} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Hasta
          <input type="date" className={`${inputClass} w-44`} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button type="submit" className="h-10 rounded-brand bg-brand-red px-4 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>
      <div className="max-h-[clamp(20rem,60vh,40rem)] overflow-y-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={CLASE_TH}>Fecha</th>
              <th className={`${CLASE_TH} text-right`}>ICL</th>
            </tr>
          </thead>
          <tbody>
            {d.valores.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-muted">
                  No hay valores en ese rango.
                </td>
              </tr>
            ) : (
              d.valores.map((v) => (
                <tr key={v.fecha} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 tabular-nums text-muted">{fmtFecha(v.fecha)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{valor(v.valor)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * El IPC: el año elegido en el gráfico de dos paneles del Tablero Comercial
 * —variación mensual arriba, interanual abajo— y la planilla; debajo, todos
 * los meses cargados.
 */
function Ipc({ d }: { d: IndicesDto }) {
  const anios = [...new Set(d.valores.map((v) => Number(v.fecha.slice(0, 4))))].sort((a, b) => b - a);
  const [anio, setAnio] = useState(anios[0] ?? new Date().getFullYear());
  const delAnio = (m: number) => d.valores.find((v) => v.fecha === `${anio}-${String(m).padStart(2, '0')}-01`);
  const meses = Array.from({ length: 12 }, (_, i) => delAnio(i + 1));
  const mensual = meses.map((v) => v?.variacionMensual ?? 0);
  const interanual = meses.map((v) => v?.variacionInteranual ?? 0);
  const cargados = meses.filter(Boolean).length;
  const [mes, setMes] = useState(Math.max(cargados, 1));
  // En la planilla, un mes sin dato dice «—», no «+0,0%».
  const enTabla = (f: (v: NonNullable<(typeof meses)[number]>) => number | null) => meses.map((v) => (v ? (f(v) ?? Number.NaN) : Number.NaN));
  const acumulada = (() => {
    const ultimo = [...meses].reverse().find(Boolean);
    const base = d.valores.find((v) => v.fecha === `${anio - 1}-12-01`);
    return ultimo && base ? ((ultimo.valor / base.valor - 1) * 100) : null;
  })();
  const filas: FilaPeriodos[] = [
    { label: 'Variación mensual', valores: enTabla((v) => v.variacionMensual), total: acumulada ?? Number.NaN, formato: (x) => porciento(x), destaca: true },
    { label: 'Interanual', valores: enTabla((v) => v.variacionInteranual), total: cargados ? (interanual[cargados - 1] ?? Number.NaN) : Number.NaN, formato: (x) => porciento(x) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Origen d={d} />
        <select
          aria-label="Año del IPC"
          value={anio}
          onChange={(e) => {
            setAnio(Number(e.target.value));
            setMes(1);
          }} className="h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink">
          {anios.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      <PeriodosChart
        titulo={`IPC por mes de ${anio}`}
        etiquetas={ABREV_MES}
        barras={mensual}
        linea={interanual}
        formatoBarras={(x) => porciento(x)}
        formatoLinea={(x) => porciento(x)}
        nombreBarras="Variación mensual %"
        nombreLinea="Interanual %"
        transcurridos={Math.min(cargados, periodosTranscurridos(anio, 'mes'))}
        seleccionado={mes}
        onSelect={setMes}
        pista="tocá una barra o un mes"
      />
      <PeriodosTabla titulo={`IPC por mes de ${anio}`} etiquetas={ABREV_MES} filas={filas} seleccionado={mes} onSelect={setMes} anchoMinimo="min-w-[52rem]" />
      <p className="text-xs text-muted">El total de la variación mensual es la acumulada del año: contra diciembre de {anio - 1}.</p>
      <div className="max-h-[clamp(20rem,50vh,32rem)] overflow-y-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={CLASE_TH}>Mes</th>
              <th className={`${CLASE_TH} text-right`}>Índice</th>
              <th className={`${CLASE_TH} text-right`}>Mensual</th>
              <th className={`${CLASE_TH} text-right`}>Interanual</th>
            </tr>
          </thead>
          <tbody>
            {d.valores.map((v) => (
              <tr key={v.fecha} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                  {ABREV_MES[Number(v.fecha.slice(5, 7)) - 1]} {v.fecha.slice(0, 4)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{valor(v.valor)}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{porciento(v.variacionMensual)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">{porciento(v.variacionInteranual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * La pestaña «Índices» (punto 3 de Javier: «¿dónde veo el ICL y el IPC?»).
 * Las pestañas internas, como las del Tablero Comercial.
 */
export function IndicesVista({ icl, ipc, ver: inicial }: { icl: IndicesDto; ipc: IndicesDto; ver: 'icl' | 'ipc' }) {
  const [ver, setVer] = useState(inicial);
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Índices" />
      <TituloSeccion icono="📈" detalle="los que usa la indexación de los contratos">
        Índices de ajuste
      </TituloSeccion>
      <Card className="flex flex-col gap-4">
        <div role="tablist" className="flex gap-2">
          {(
            [
              ['icl', '🏦 ICL · BCRA'],
              ['ipc', '🛒 IPC · INDEC'],
            ] as const
          ).map(([v, texto]) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={ver === v}
              onClick={() => setVer(v)}
              className={`rounded-brand px-3 py-2 text-sm font-semibold ${ver === v ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`}
            >
              {texto}
            </button>
          ))}
        </div>
        {ver === 'icl' ? <Icl d={icl} /> : <Ipc d={ipc} />}
      </Card>
    </div>
  );
}
