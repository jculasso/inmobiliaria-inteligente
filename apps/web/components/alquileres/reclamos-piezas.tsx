'use client';

import { useEffect, useState } from 'react';
import {
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO_RECLAMO,
  ReclamoInputSchema,
  nombrePrioridad,
  type ContratoResumenDto,
  type EstadoReclamo,
  type PrioridadReclamo,
  type ProveedorDelReclamo,
  type ProveedorDto,
  type TipoReclamo,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { crearReclamo, listProveedores, listUsuariosAsignables } from '../../lib/alquileres-api';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { Insignia, type TonoInsignia } from './piezas';
import { primerMensaje } from '../../lib/mensaje-zod';

// «Urgente» va en rojo de urgencia, no en el color de la marca (CONVENCIONES_TECNICAS §13); «En curso» no urge: avisa.
// Tres estados (regla 67): «Cerrado» se fue.
const TONO_ESTADO: Record<EstadoReclamo, TonoInsignia> = {
  abierto: 'aviso',
  en_curso: 'aviso',
  resuelto: 'exito',
};
const TONO_PRIORIDAD: Record<PrioridadReclamo, TonoInsignia> = {
  urgente: 'peligro',
  alta: 'aviso',
  media: 'neutro',
  baja: 'neutro',
};

export const EstadoReclamoBadge = ({ estado }: { estado: EstadoReclamo }) => (
  <Insignia tono={TONO_ESTADO[estado]}>{NOMBRE_ESTADO_RECLAMO[estado]}</Insignia>
);
/**
 * Suelta, la insignia dice «Prioridad media»: «Media» sola no se entiende
 * (regla 69). `corta` es para cuando ya está bajo el rótulo «Prioridad».
 */
export const PrioridadBadge = ({
  prioridad,
  corta = false,
}: {
  prioridad: PrioridadReclamo;
  corta?: boolean;
}) => (
  <Insignia tono={TONO_PRIORIDAD[prioridad]}>
    {prioridad === 'urgente' ? '🔥 ' : ''}
    {corta ? NOMBRE_PRIORIDAD[prioridad] : nombrePrioridad(prioridad)}
  </Insignia>
);

type Opcion = { id: string; nombre: string };

/**
 * Una lista que se pide al abrir: `null` mientras no llegó (o si falló). Sin
 * la lista el reclamo se abre igual, sin asignar y sin proveedor.
 */
function useLista<T extends Opcion>(pedir: (token: string) => Promise<T[]>): T[] | null {
  const [xs, setXs] = useState<T[] | null>(null);
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const lista = await pedir(await getAccessToken());
        if (vigente) setXs(lista);
      } catch {
        /* queda en null: se puede seguir sin elegir */
      }
    })();
    return () => {
      vigente = false;
    };
  }, [pedir]);
  return xs;
}

/** Quiénes pueden seguir un reclamo: los que entran al módulo (la API ya los filtra). */
export const useUsuarios = () => useLista(listUsuariosAsignables);
/** Los proveedores del módulo, para elegir quién arregla el reclamo. */
export const useProveedores = (): ProveedorDto[] | null => useLista(listProveedores);

/**
 * «Lo sigue». Si el reclamo ya lo tenía alguien que no está en la lista —un
 * vendedor, de antes de la regla 61— se muestra como la opción actual, marcada,
 * para que guardar otro cambio no lo pierda en silencio (regla 63).
 */
export function SelectLoSigue({
  usuarios,
  value,
  onChange,
  actual,
}: {
  usuarios: Opcion[] | null;
  value: string;
  onChange: (id: string) => void;
  /** El que tiene hoy el reclamo, con su nombre. */
  actual?: { id: string; nombre: string | null } | null;
}) {
  const fuera = actual && !(usuarios ?? []).some((u) => u.id === actual.id) ? actual : null;
  return (
    <Campo label="Lo sigue">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar</option>
        {fuera && (
          <option value={fuera.id}>
            {fuera.nombre ?? 'Otro usuario'}
            {usuarios ? ' · no usa Alquileres' : ''}
          </option>
        )}
        {(usuarios ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** «Proveedor»: quién lo arregla, de la lista de Proveedores. */
export function SelectProveedor({
  proveedores,
  value,
  onChange,
  actual,
}: {
  proveedores: Opcion[] | null;
  value: string;
  onChange: (id: string) => void;
  actual?: Pick<ProveedorDelReclamo, 'id' | 'nombre'> | null;
}) {
  const fuera = actual && !(proveedores ?? []).some((p) => p.id === actual.id) ? actual : null;
  return (
    <Campo label="Proveedor">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin proveedor</option>
        {fuera && <option value={fuera.id}>{fuera.nombre}</option>}
        {(proveedores ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** Abrir un reclamo: de un contrato (y su inquilino), con tipo, prioridad, quién lo sigue y el proveedor. */
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
  const proveedores = useProveedores();
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoReclamo>('mantenimiento');
  const [prioridad, setPrioridad] = useState<PrioridadReclamo>('media');
  const [contratoId, setContratoId] = useState(contratoFijo ?? '');
  const [asignadoAId, setAsignadoAId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear() {
    const dto = {
      asunto,
      descripcion,
      tipo,
      prioridad,
      contratoId: contratoId || null,
      personaId: null,
      asignadoAId: asignadoAId || null,
      proveedorId: proveedorId || null,
    };
    const r = ReclamoInputSchema.safeParse(dto);
    if (!r.success) {
      setError(primerMensaje(r.error, 'Revisá los datos.'));
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
            <select
              className={inputClass}
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
            >
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
          <input
            className={inputClass}
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="Pérdida de agua en el baño"
            autoFocus
          />
        </Campo>
        <Campo label="Detalle">
          <textarea
            className={textareaClass}
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Tipo">
            <select
              className={inputClass}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoReclamo)}
            >
              {Object.entries(NOMBRE_TIPO_RECLAMO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Prioridad">
            <select
              className={inputClass}
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadReclamo)}
            >
              {Object.entries(NOMBRE_PRIORIDAD).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
          <SelectLoSigue usuarios={usuarios} value={asignadoAId} onChange={setAsignadoAId} />
          <SelectProveedor
            proveedores={proveedores}
            value={proveedorId}
            onChange={setProveedorId}
          />
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

/** El teléfono como link para llamar: solo dígitos y el «+» del principio. */
export function hrefTelefono(telefono: string): string {
  return `tel:${telefono.trim().replace(/(?!^\+)[^\d]/g, '')}`;
}

/** El proveedor de un reclamo, con su teléfono y su email para llamarlo o escribirle. */
export function ContactoProveedor({ proveedor: p }: { proveedor: ProveedorDelReclamo | null }) {
  if (!p) return <>Sin proveedor</>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-semibold">{p.nombre}</span>
      {p.telefono && (
        <a href={hrefTelefono(p.telefono)} className="text-ink underline-offset-2 hover:underline">
          📞 {p.telefono}
        </a>
      )}
      {p.email && (
        <a href={`mailto:${p.email}`} className="text-ink underline-offset-2 hover:underline">
          ✉️ {p.email}
        </a>
      )}
    </span>
  );
}
