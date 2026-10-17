'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal } from '@vacker/ui';
import { fmtFecha, fmtMoneda } from '../../../lib/format';
import { CLASE_FOCO, CLASE_TH } from '../piezas';
import { fmtTotales, totalesPorMoneda } from './formatos';
import type { Listas } from './listas';
import {
  COLUMNAS_DE_PLATA,
  type Columna,
  type Detalle,
  type FilaDetalle,
  type IndicadorDetalle,
} from './vistas';

/**
 * «en 12 días», «hoy», «hace 5 días»: para lo que falta o lo que pasó. Bajo
 * «Atraso» o «Hace», solo los días: en el plazo cumplido llegan negativos
 * (faltan −5), y bajo «Hace» se leen 5.
 */
function enDias(n: number, columna: string) {
  if (columna === 'Atraso' || columna === 'Hace') {
    const d = Math.abs(n);
    return `${d} ${d === 1 ? 'día' : 'días'}`;
  }
  if (n === 0) return 'hoy';
  return n > 0 ? `en ${n} ${n === 1 ? 'día' : 'días'}` : `hace ${-n} ${n === -1 ? 'día' : 'días'}`;
}

const DERECHA: Columna[] = [...COLUMNAS_DE_PLATA, 'dias'];
/** Lo que no se corta en dos renglones: códigos, fechas e importes. */
const SIN_CORTE: Columna[] = ['contrato', 'fecha', 'vence', 'indexa', ...DERECHA];
/** Las columnas que se leen primero: el importe del número y, en la cobranza, lo cobrado y lo que falta. */
const DESTACADAS: Columna[] = ['importe', 'cobrado', 'falta'];
type ColumnaQueSuma = 'importe' | 'alquiler' | 'cobrado' | 'falta';
const esDePlata = (c: Columna): c is ColumnaQueSuma => COLUMNAS_DE_PLATA.includes(c);

/** Lo que va en una celda, formateado. */
function Celda({
  f,
  col,
  etiqueta,
  hoy,
  esperan,
}: {
  f: FilaDetalle;
  col: Columna;
  etiqueta: string;
  hoy: string;
  /** Los contratos cuyo tramo ya empezó y espera el índice (regla 7): no están vencidos. */
  esperan: ReadonlySet<string>;
}) {
  const moneda = f.moneda ?? 'ARS';
  switch (col) {
    case 'alquiler':
    case 'importe': {
      const v = f[col];
      return v == null ? <span className="text-muted">—</span> : <>{fmtMoneda(v, moneda)}</>;
    }
    case 'cobrado':
    case 'falta': {
      // Regla 187: el cero se ve (no pagó nada, o no falta nada), pero en gris.
      const v = f[col];
      if (v == null) return <span className="text-muted">—</span>;
      return v === 0 ? (
        <span className="font-normal text-muted">{fmtMoneda(0, moneda)}</span>
      ) : (
        <>{fmtMoneda(v, moneda)}</>
      );
    }
    case 'indexa':
      if (!f.indexa) return <span className="text-muted">—</span>;
      if (f.indexa < hoy && f.contrato && esperan.has(f.contrato))
        return (
          <>
            {fmtFecha(f.indexa)} <span className="text-xs text-muted">espera el índice</span>
          </>
        );
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
 * Regla 191: mientras la lista llega, una carga que se ve —la rueda y
 * renglones grises donde va a estar la tabla—, no un «Cargando…» chico.
 */
function Cargando() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand-red"
        />
        Cargando la lista…
      </p>
      <div aria-hidden data-cargando className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-surface" />
        ))}
      </div>
    </div>
  );
}

/**
 * El detalle de un número: una tabla con las columnas de ese número en la
 * computadora, y tarjetas en el teléfono. Cada fila lleva a su ficha. Si es un
 * importe, el total es el número de la tarjeta.
 *
 * Si la lista se pide (regla 79), sale de la memoria de listas: si ya llegó
 * —porque se pidió en segundo plano o porque ya se abrió—, se ve en el primer
 * cuadro; si está en camino, espera ese mismo pedido (reglas 189 y 190).
 */
export function DetalleModal({
  titulo,
  resumen,
  indicador,
  pedido,
  columnas,
  total,
  sumar = ['importe'],
  accion,
  volver,
  listas,
  hoy,
  onClose,
  esperan,
}: Detalle & {
  listas: Listas;
  hoy: string;
  esperan: ReadonlySet<string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [cargado, setCargado] = useState<IndicadorDetalle | null>(
    () => indicador ?? (pedido ? listas.ya(pedido) : undefined) ?? null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    // Siempre por la memoria: si ya llegó, devuelve la misma lista sin pedir
    // nada; si llegó entre el primer cuadro y este efecto, también.
    if (!pedido) return;
    let cancelado = false;
    listas.pedir(pedido).then(
      (ind) => {
        if (!cancelado) setCargado(ind);
      },
      () => {
        if (!cancelado) setError(true);
      },
    );
    return () => {
      cancelado = true;
    };
  }, [pedido, listas]);
  const filas = cargado?.filas ?? [];
  // Una columna vacía en todas las filas no se muestra.
  const cols = columnas.filter(([c]) => filas.some((f) => f[c] != null && f[c] !== ''));
  // El total es lo que suman las filas, por moneda. No `indicador.valor`: en
  // las tareas es la CANTIDAD de filas, y salía «Total $ 5,00».
  const conTotal = total
    ? cols.flatMap(([c, etiqueta]) =>
        esDePlata(c) && sumar.includes(c)
          ? [{ c, etiqueta, texto: fmtTotales(totalesPorMoneda(filas, total, c), total) }]
          : [],
      )
    : [];
  const totalDe = (c: Columna) => conTotal.find((x) => x.c === c)?.texto;
  const ir = (f: FilaDetalle) => {
    if (f.href) router.push(f.href);
  };
  return (
    <Modal
      title={titulo}
      subtitle={
        !cargado
          ? undefined
          : (resumen ??
            `${filas.length} ${filas.length === 1 ? 'fila' : 'filas'}${filas.some((f) => f.href) ? ' · tocá una para abrir su ficha' : ''}`)
      }
      onClose={onClose}
      size="xl"
    >
      {volver && (
        <button
          type="button"
          onClick={volver.ir}
          className={`-mt-1 mb-3 inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-bold text-brand-red hover:underline ${CLASE_FOCO}`}
        >
          ← {volver.texto}
        </button>
      )}
      {error ? (
        <p className="text-sm text-danger">No se pudo cargar la lista. Cerrala y probá de nuevo.</p>
      ) : !cargado ? (
        <Cargando />
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
                    {primera && (
                      <Celda
                        f={f}
                        col={primera[0]}
                        etiqueta={primera[1]}
                        hoy={hoy}
                        esperan={esperan}
                      />
                    )}
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
                          <dd
                            className={`truncate ${DESTACADAS.includes(c) ? 'font-semibold tabular-nums' : ''} text-ink`}
                          >
                            <Celda f={f} col={c} etiqueta={etiqueta} hoy={hoy} esperan={esperan} />
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
                        className={`px-3 py-2 align-top ${SIN_CORTE.includes(c) ? 'whitespace-nowrap' : ''} ${DERECHA.includes(c) ? 'text-right tabular-nums' : ''} ${DESTACADAS.includes(c) || i === 0 ? 'font-semibold text-ink' : 'text-muted'}`}
                      >
                        {i === 0 && f.href ? (
                          <Link
                            href={f.href}
                            onClick={(e) => e.stopPropagation()}
                            className={`hover:text-brand-red ${CLASE_FOCO}`}
                          >
                            <Celda f={f} col={c} etiqueta={etiqueta} hoy={hoy} esperan={esperan} />
                          </Link>
                        ) : (
                          <Celda f={f} col={c} etiqueta={etiqueta} hoy={hoy} esperan={esperan} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {conTotal.length > 0 && (
                <tfoot className="sticky bottom-0 bg-white">
                  <tr className="border-t-2 border-line font-bold text-ink">
                    {cols.map(([c], i) => (
                      <td
                        key={c}
                        className={`px-3 py-2 ${totalDe(c) ? 'whitespace-nowrap text-right tabular-nums' : ''}`}
                      >
                        {i === 0 ? 'Total' : (totalDe(c) ?? '')}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {(conTotal.length > 0 || accion) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              {conTotal.length === 1 ? (
                <p className="text-sm font-bold text-ink sm:hidden">Total {conTotal[0]!.texto}</p>
              ) : conTotal.length > 1 ? (
                // Regla 187: en el teléfono, cada total en su renglón.
                <dl aria-label="Totales" className="flex w-full flex-col gap-1 text-sm sm:hidden">
                  {conTotal.map((x) => (
                    <div
                      key={x.c}
                      className="flex flex-wrap items-baseline justify-between gap-x-3"
                    >
                      <dt className="font-semibold text-muted">Total {x.etiqueta.toLowerCase()}</dt>
                      <dd className="ml-auto font-bold tabular-nums text-ink">{x.texto}</dd>
                    </div>
                  ))}
                </dl>
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
