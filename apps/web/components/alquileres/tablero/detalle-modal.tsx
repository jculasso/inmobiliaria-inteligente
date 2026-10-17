'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FilaTablero, FiltroTipoContrato, Indicador } from '@vacker/types';
import { Modal } from '@vacker/ui';
import { getDetalleTableroAlquileres } from '../../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../../lib/format';
import { getAccessToken } from '../../../lib/supabase/client';
import { CLASE_FOCO, CLASE_TH } from '../piezas';
import { fmtTotales, totalesPorMoneda } from './formatos';
import type { Columna, Detalle } from './vistas';

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
  esperan,
}: {
  f: FilaTablero;
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
 * El detalle de un número: una tabla con las columnas de ese número en la
 * computadora, y tarjetas en el teléfono. Cada fila lleva a su ficha. Si es un
 * importe, el total es el número de la tarjeta.
 */
export function DetalleModal({
  titulo,
  indicador,
  pedido,
  columnas,
  total,
  accion,
  tipo,
  hoy,
  onClose,
  esperan,
}: Detalle & {
  tipo: FiltroTipoContrato;
  hoy: string;
  esperan: ReadonlySet<string>;
  onClose: () => void;
}) {
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
                          <dd className="truncate text-ink">
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
                        className={`px-3 py-2 align-top ${SIN_CORTE.includes(c) ? 'whitespace-nowrap' : ''} ${DERECHA.includes(c) ? 'text-right tabular-nums' : ''} ${c === 'importe' || i === 0 ? 'font-semibold text-ink' : 'text-muted'}`}
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
