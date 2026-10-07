'use client';

import { ABREV_MES, NOMBRES_MES } from '../../lib/meses';
import { mesesDelPeriodo, type PeriodoTablero } from '../../lib/periodo-tablero';
import { CLASE_FOCO, Segmentado } from './piezas';

// El selector de período del Dashboard de Alquileres (regla 74), en un lugar
// para que el informe al propietario (regla 84) use el mismo y no una copia:
// Mes (con el mes), Trimestre (Q1 a Q4) o Año, y el año.

const POR_PERIODO: [PeriodoTablero['por'], string][] = [
  ['mes', 'Mes'],
  ['trimestre', 'Trimestre'],
  ['anio', 'Año'],
];
const TRIMESTRES = [1, 2, 3, 4].map(
  (q) =>
    [
      String(q),
      <span key={q} title={`${ABREV_MES[q * 3 - 3]}–${ABREV_MES[q * 3 - 1]}`}>
        Q{q}
      </span>,
    ] as const,
);

/**
 * Regla 74: el período de toda la pantalla, con el aspecto del Tablero
 * Comercial —Mes (con el mes), Trimestre (Q1 a Q4) o Año—.
 */
export function FiltroPeriodo({
  periodo,
  porDefecto,
  cambiar,
}: {
  periodo: PeriodoTablero;
  /** El mes al que se vuelve al pasar a «Mes» desde el año entero. */
  porDefecto: number;
  cambiar: (p: PeriodoTablero) => void;
}) {
  const elegirPor = (por: PeriodoTablero['por']) => {
    if (por === periodo.por) return;
    if (por === 'anio') return cambiar({ por: 'anio' });
    if (por === 'trimestre')
      return cambiar({
        por: 'trimestre',
        q: Math.ceil((periodo.por === 'mes' ? periodo.mes : porDefecto) / 3),
      });
    // Del trimestre al mes: el mes por defecto si está en ese trimestre; si no, su último mes.
    const meses = mesesDelPeriodo(periodo);
    cambiar({ por: 'mes', mes: meses.includes(porDefecto) ? porDefecto : meses.at(-1)! });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmentado
        etiqueta="Período"
        opciones={POR_PERIODO}
        valor={periodo.por}
        onCambio={elegirPor}
      />
      {periodo.por === 'mes' && (
        <select
          aria-label="Mes"
          value={periodo.mes}
          onChange={(e) => cambiar({ por: 'mes', mes: Number(e.target.value) })}
          className={`h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink ${CLASE_FOCO}`}
        >
          {NOMBRES_MES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      )}
      {periodo.por === 'trimestre' && (
        <Segmentado
          etiqueta="Trimestre"
          opciones={TRIMESTRES}
          valor={String(periodo.q)}
          onCambio={(q) => cambiar({ por: 'trimestre', q: Number(q) })}
        />
      )}
    </div>
  );
}

/**
 * El año de los meses. Como el filtro del Tablero Comercial, pero sin «Todos
 * los años»: el período es de un año. Este año y los dos anteriores.
 */
export function FiltroAnio({
  hoy,
  anio,
  cambiar,
}: {
  hoy: string;
  anio: number;
  cambiar: (anio: number) => void;
}) {
  const actual = Number(hoy.slice(0, 4));
  return (
    <select
      aria-label="Año"
      value={anio}
      onChange={(e) => cambiar(Number(e.target.value))}
      className={`h-9 rounded-brand border border-line bg-white px-2 text-sm text-ink ${CLASE_FOCO}`}
    >
      {[actual, actual - 1, actual - 2].map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}
