'use client';

import { useState } from 'react';
import { INVENTARIO_MAX_ITEMS, InventarioInputSchema, type InventarioDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { guardarInventario } from '../../lib/reservas-api';
import { primerMensaje } from '../../lib/mensaje-zod';
import { useRefrescar } from '../../lib/refrescar';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { CLASE_FOCO, MensajeError, Panel } from './piezas';

interface Fila {
  clave: number;
  descripcion: string;
  cantidad: string;
  estado: string;
}

let secuencia = 0;
const fila = (d = '', c = '1', e = ''): Fila => ({
  clave: ++secuencia,
  descripcion: d,
  cantidad: c,
  estado: e,
});

/**
 * El inventario del contrato (reglas 150 a 153; Florencia, Vacker,
 * 15/10/2026): lo que se entrega con la propiedad, ítem por ítem, y las
 * observaciones. Se edita en borrador y en vigente —no toca plata— y sale en
 * el Word del contrato con `{#inventario}…{/inventario}`.
 *
 * Pieza propia en la ficha y no un paso más del alta: así se completa
 * también con el contrato ya vigente.
 */
export function InventarioContrato({
  contratoId,
  inventario,
}: {
  contratoId: string;
  inventario: InventarioDto;
}) {
  const { refrescar, refrescando } = useRefrescar();
  const [editando, setEditando] = useState(false);
  const desde = () =>
    inventario.items.length
      ? inventario.items.map((i) => fila(i.descripcion, String(i.cantidad), i.estado ?? ''))
      : [fila()];
  const [filas, setFilas] = useState<Fila[]>(desde);
  const [observaciones, setObservaciones] = useState(inventario.observaciones ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (clave: number, c: Partial<Fila>) =>
    setFilas((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...c } : x)));

  async function guardar() {
    setError(null);
    // Un renglón sin nada escrito no es un ítem: se descarta en vez de pedir su descripción.
    const items = filas
      .filter((f) => f.descripcion.trim() || f.estado.trim())
      .map((f) => ({
        descripcion: f.descripcion,
        cantidad: f.cantidad.trim() === '' ? 1 : Number(f.cantidad),
        estado: f.estado || null,
      }));
    const r = InventarioInputSchema.safeParse({ items, observaciones: observaciones || null });
    if (!r.success) return setError(primerMensaje(r.error, 'Revisá los ítems.'));
    setGuardando(true);
    try {
      await guardarInventario(await getAccessToken(), contratoId, r.data);
      await refrescar();
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el inventario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Panel
      icono="🪑"
      titulo="Inventario"
      derecha={
        !editando &&
        inventario.editable && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFilas(desde());
              setObservaciones(inventario.observaciones ?? '');
              setEditando(true);
            }}
          >
            {inventario.items.length || inventario.observaciones
              ? '✏️ Editar'
              : '＋ Cargar inventario'}
          </Button>
        )
      }
    >
      {!editando ? (
        inventario.items.length === 0 && !inventario.observaciones ? (
          <p className="text-sm text-muted">Sin inventario cargado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {inventario.items.length > 0 && (
              <ol className="flex flex-col divide-y divide-line text-sm">
                {inventario.items.map((i, n) => (
                  <li key={n} className="flex items-baseline gap-2 py-1.5">
                    <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{n + 1}.</span>
                    <span className="min-w-0">
                      <span className="font-semibold tabular-nums text-ink">{i.cantidad} ×</span>{' '}
                      <span className="text-ink">{i.descripcion}</span>
                      {i.estado && <span className="text-muted"> · {i.estado}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {inventario.observaciones && (
              <p className="whitespace-pre-line text-sm text-muted">{inventario.observaciones}</p>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {filas.map((f, n) => (
              <li
                key={f.clave}
                className="grid grid-cols-[5rem_1fr_auto] gap-2 rounded-brand border border-line p-2 sm:grid-cols-[5rem_1fr_1fr_auto] sm:border-0 sm:p-0"
              >
                <input
                  className={inputClass}
                  inputMode="numeric"
                  aria-label={`Cantidad, ítem ${n + 1}`}
                  value={f.cantidad}
                  onChange={(e) => cambiar(f.clave, { cantidad: e.target.value })}
                />
                <input
                  className={inputClass}
                  aria-label={`Descripción, ítem ${n + 1}`}
                  placeholder="Qué es: cocina, heladera, cortinas…"
                  value={f.descripcion}
                  onChange={(e) => cambiar(f.clave, { descripcion: e.target.value })}
                />
                <input
                  className={`${inputClass} col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto`}
                  aria-label={`Estado, ítem ${n + 1}`}
                  placeholder="Estado u observación"
                  value={f.estado}
                  onChange={(e) => cambiar(f.clave, { estado: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setFilas((xs) => xs.filter((x) => x.clave !== f.clave))}
                  className={`col-start-3 row-start-1 min-h-11 rounded px-2 text-sm text-muted hover:text-danger sm:col-start-auto sm:row-start-auto ${CLASE_FOCO}`}
                  aria-label={`Quitar el ítem ${n + 1}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={filas.length >= INVENTARIO_MAX_ITEMS}
              onClick={() => setFilas((xs) => [...xs, fila()])}
            >
              ＋ Agregar ítem
            </Button>
          </div>
          <Campo label="Observaciones">
            <textarea
              className={textareaClass}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={guardando}
              onClick={() => {
                setEditando(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
              {refrescando ? 'Actualizando…' : guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
