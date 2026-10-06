'use client';

import { useEffect, useState } from 'react';
import {
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO_RECLAMO,
  ReclamoInputSchema,
  type ContratoResumenDto,
  type EstadoReclamo,
  type PrioridadReclamo,
  type TipoReclamo,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { crearReclamo, listUsuariosAsignables } from '../../lib/alquileres-api';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { Insignia, type TonoInsignia } from './piezas';

// «Urgente» va en rojo de urgencia, no en el color de la marca (CONVENCIONES_TECNICAS §13); «En curso» no urge: avisa.
const TONO_ESTADO: Record<EstadoReclamo, TonoInsignia> = { abierto: 'aviso', en_curso: 'aviso', resuelto: 'exito', cerrado: 'neutro' };
const TONO_PRIORIDAD: Record<PrioridadReclamo, TonoInsignia> = { urgente: 'peligro', alta: 'aviso', media: 'neutro', baja: 'neutro' };

export const EstadoReclamoBadge = ({ estado }: { estado: EstadoReclamo }) => <Insignia tono={TONO_ESTADO[estado]}>{NOMBRE_ESTADO_RECLAMO[estado]}</Insignia>;
export const PrioridadBadge = ({ prioridad }: { prioridad: PrioridadReclamo }) => (
  <Insignia tono={TONO_PRIORIDAD[prioridad]}>
    {prioridad === 'urgente' ? '🔥 ' : ''}
    {NOMBRE_PRIORIDAD[prioridad]}
  </Insignia>
);

/** Los usuarios a los que se les puede asignar un reclamo. */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const xs = await listUsuariosAsignables(await getAccessToken());
        if (vigente) setUsuarios(xs);
      } catch {
        /* sin la lista se puede abrir igual, sin asignar */
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);
  return usuarios;
}

/** Abrir un reclamo: de un contrato (y su inquilino), con tipo, prioridad y a quién se le asigna. */
export function NuevoReclamoModal({
  contratos,
  contratoFijo,
  onClose,
  onCreado,
}: {
  contratos: Pick<ContratoResumenDto, 'id' | 'codigo' | 'propiedad' | 'estado'>[];
  contratoFijo?: string;
  onClose: () => void;
  onCreado: (id: string) => void;
}) {
  const usuarios = useUsuarios();
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoReclamo>('mantenimiento');
  const [prioridad, setPrioridad] = useState<PrioridadReclamo>('media');
  const [contratoId, setContratoId] = useState(contratoFijo ?? '');
  const [asignadoAId, setAsignadoAId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear() {
    const dto = { asunto, descripcion, tipo, prioridad, contratoId: contratoId || null, personaId: null, asignadoAId: asignadoAId || null };
    const r = ReclamoInputSchema.safeParse(dto);
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const creado = await crearReclamo(await getAccessToken(), dto);
      onCreado(creado.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir.');
      setEnviando(false);
    }
  }

  return (
    <Modal title="Nuevo reclamo" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {!contratoFijo && (
          <Campo label="Contrato" requerido>
            <select className={inputClass} value={contratoId} onChange={(e) => setContratoId(e.target.value)}>
              <option value="">Elegí el contrato…</option>
              {contratos
                .filter((c) => c.estado === 'vigente')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {c.propiedad.direccion}
                    {c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}
                  </option>
                ))}
            </select>
          </Campo>
        )}
        <Campo label="Asunto" requerido>
          <input className={inputClass} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Pérdida de agua en el baño" autoFocus />
        </Campo>
        <Campo label="Detalle">
          <textarea className={textareaClass} rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Tipo">
            <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as TipoReclamo)}>
              {Object.entries(NOMBRE_TIPO_RECLAMO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Prioridad">
            <select className={inputClass} value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadReclamo)}>
              {Object.entries(NOMBRE_PRIORIDAD).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Asignado a">
            <select className={inputClass} value={asignadoAId} onChange={(e) => setAsignadoAId(e.target.value)}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={crear} disabled={enviando}>
            {enviando ? 'Abriendo…' : 'Abrir el reclamo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
