'use client';

import { useState } from 'react';
import {
  GarantiaInputSchema,
  NOMBRE_TIPO_GARANTIA,
  type EstadoGarantia,
  type GarantiaDto,
  type TipoGarantia,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { guardarGarantias } from '../../lib/alquileres-api';
import { fmtFecha } from '../../lib/format';
import { useRefrescar } from '../../lib/refrescar';
import { Campo, inputClass } from '../form-ui';
import { CLASE_FOCO, Insignia, Panel, type TonoInsignia } from './piezas';

const ESTADO: Record<EstadoGarantia, { texto: string; tono: TonoInsignia }> = {
  pendiente: { texto: 'Informe pendiente', tono: 'aviso' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
};

const DETALLE: Record<TipoGarantia, string> = {
  propietaria: 'Propiedad que garantiza (dirección, localidad)',
  laboral: 'Empleador y antigüedad',
  caucion: 'Aseguradora y número de póliza',
  otra: 'Detalle',
};

interface Fila {
  tipo: TipoGarantia;
  personaId: string | null;
  garante: string;
  detalle: string;
  estado: EstadoGarantia;
  aprobadaEl: string;
  obs: string;
}
const deDto = (g: GarantiaDto): Fila => ({
  ...g,
  garante: g.garante ?? '',
  detalle: g.detalle ?? '',
  aprobadaEl: g.aprobadaEl ?? '',
  obs: g.obs ?? '',
});

/**
 * Las garantías del contrato y su informe (punto 11 de Javier, como Gexion):
 * tipo, garante, lo que garantiza, y el estado de la verificación.
 */
export function Garantias({
  contratoId,
  garantias,
  garantes,
}: {
  contratoId: string;
  garantias: GarantiaDto[];
  garantes: { personaId: string; nombre: string }[];
}) {
  const { refrescar, refrescando } = useRefrescar();
  const [editando, setEditando] = useState(false);
  const [filas, setFilas] = useState<Fila[]>(garantias.map(deDto));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (i: number, c: Partial<Fila>) =>
    setFilas((xs) => xs.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const nombreDe = (g: GarantiaDto) =>
    g.garante ?? garantes.find((x) => x.personaId === g.personaId)?.nombre ?? '—';

  async function guardar() {
    setError(null);
    const datos = filas.map((f) => ({
      ...f,
      aprobadaEl: f.estado === 'aprobada' ? f.aprobadaEl || null : null,
    }));
    for (const [i, f] of datos.entries()) {
      const r = GarantiaInputSchema.safeParse(f);
      if (!r.success) {
        setError(`Garantía ${i + 1}: ${r.error.issues[0]?.message ?? 'revisá los datos.'}`);
        return;
      }
    }
    setGuardando(true);
    try {
      await guardarGarantias(await getAccessToken(), contratoId, datos);
      // Se sale de la edición con la lista nueva ya a la vista: antes, unos
      // segundos se veía la vieja, sin la garantía recién cargada.
      await refrescar();
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Panel
      icono="🤝"
      titulo="Garantías"
      derecha={
        !editando && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Con lo que dice la página ahora, no con lo que había al montar.
              setFilas(garantias.map(deDto));
              setEditando(true);
            }}
          >
            {garantias.length ? '✏️ Editar' : '＋ Agregar garantías'}
          </Button>
        )
      }
    >
      {!editando ? (
        garantias.length === 0 ? (
          <p className="text-sm text-muted">Sin garantías cargadas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {garantias.map((g) => (
              <li key={g.id} className="rounded-brand border border-line px-3 py-2 text-sm">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {NOMBRE_TIPO_GARANTIA[g.tipo]} · {nombreDe(g)}
                  </span>
                  <Insignia tono={ESTADO[g.estado].tono}>
                    {ESTADO[g.estado].texto}
                    {g.aprobadaEl ? ` el ${fmtFecha(g.aprobadaEl)}` : ''}
                  </Insignia>
                </p>
                {g.detalle && <p className="text-muted">{g.detalle}</p>}
                {g.obs && <p className="mt-1 whitespace-pre-line text-xs text-muted">{g.obs}</p>}
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {filas.map((f, i) => (
            <fieldset
              key={i}
              className="grid gap-2 rounded-brand border border-line p-3 sm:grid-cols-3"
            >
              <Campo label="Tipo">
                <select
                  className={inputClass}
                  value={f.tipo}
                  onChange={(e) => cambiar(i, { tipo: e.target.value as TipoGarantia })}
                >
                  {Object.entries(NOMBRE_TIPO_GARANTIA).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Garante">
                {garantes.length > 0 ? (
                  <select
                    className={inputClass}
                    value={f.personaId ?? ''}
                    onChange={(e) =>
                      cambiar(i, {
                        personaId: e.target.value || null,
                        garante: e.target.value ? '' : f.garante,
                      })
                    }
                  >
                    <option value="">Otro (escribir)</option>
                    {garantes.map((g) => (
                      <option key={g.personaId} value={g.personaId}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={f.garante}
                    onChange={(e) => cambiar(i, { garante: e.target.value })}
                  />
                )}
              </Campo>
              <Campo label="Estado del informe">
                <select
                  className={inputClass}
                  value={f.estado}
                  onChange={(e) => cambiar(i, { estado: e.target.value as EstadoGarantia })}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
              </Campo>
              {garantes.length > 0 && !f.personaId && (
                <Campo label="Nombre del garante">
                  <input
                    className={inputClass}
                    value={f.garante}
                    onChange={(e) => cambiar(i, { garante: e.target.value })}
                  />
                </Campo>
              )}
              <div className="sm:col-span-2">
                <Campo label={DETALLE[f.tipo]}>
                  <input
                    className={inputClass}
                    value={f.detalle}
                    onChange={(e) => cambiar(i, { detalle: e.target.value })}
                  />
                </Campo>
              </div>
              {f.estado === 'aprobada' && (
                <Campo label="Aprobada el">
                  <input
                    type="date"
                    className={inputClass}
                    value={f.aprobadaEl}
                    onChange={(e) => cambiar(i, { aprobadaEl: e.target.value })}
                  />
                </Campo>
              )}
              <div className="sm:col-span-3">
                <Campo label="Observaciones del informe">
                  <input
                    className={inputClass}
                    value={f.obs}
                    onChange={(e) => cambiar(i, { obs: e.target.value })}
                  />
                </Campo>
              </div>
              <div className="flex justify-end sm:col-span-3">
                <button
                  type="button"
                  onClick={() => setFilas((xs) => xs.filter((_, j) => j !== i))}
                  className={`rounded px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5 ${CLASE_FOCO}`}
                >
                  🗑️ Quitar
                </button>
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setFilas((xs) => [
                  ...xs,
                  {
                    tipo: 'propietaria',
                    personaId: garantes[0]?.personaId ?? null,
                    garante: '',
                    detalle: '',
                    estado: 'pendiente',
                    aprobadaEl: '',
                    obs: '',
                  },
                ])
              }
            >
              ＋ Agregar garantía
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={guardando}
                onClick={() => {
                  setFilas(garantias.map(deDto));
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
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
