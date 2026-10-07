'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO_RECLAMO,
  type EstadoReclamo,
  type PrioridadReclamo,
  type ReclamoDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarReclamo } from '../../lib/alquileres-api';
import { fmtFechaDe, fmtFechaHora } from '../../lib/format';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { Bloque, Dato, EncabezadoPagina, Panel, VacioBloque } from './piezas';
import {
  ContactoProveedor,
  EstadoReclamoBadge,
  PrioridadBadge,
  SelectLoSigue,
  SelectProveedor,
  useProveedores,
  useUsuarios,
} from './reclamos-piezas';

/** Un reclamo: qué pasa, de quién, quién lo sigue, quién lo arregla, y su historial de notas. */
export function ReclamoFicha({ reclamo: r }: { reclamo: ReclamoDto }) {
  const router = useRouter();
  const usuarios = useUsuarios();
  const proveedores = useProveedores();
  const [estado, setEstado] = useState<EstadoReclamo>(r.estado);
  const [prioridad, setPrioridad] = useState<PrioridadReclamo>(r.prioridad);
  const [asignado, setAsignado] = useState(r.asignadoAId ?? '');
  const [proveedor, setProveedor] = useState(r.proveedor?.id ?? '');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambio =
    estado !== r.estado ||
    prioridad !== r.prioridad ||
    asignado !== (r.asignadoAId ?? '') ||
    proveedor !== (r.proveedor?.id ?? '') ||
    nota.trim() !== '';

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await cambiarReclamo(await getAccessToken(), r.id, {
        ...(estado !== r.estado ? { estado } : {}),
        ...(prioridad !== r.prioridad ? { prioridad } : {}),
        ...(asignado !== (r.asignadoAId ?? '') ? { asignadoAId: asignado || null } : {}),
        ...(proveedor !== (r.proveedor?.id ?? '') ? { proveedorId: proveedor || null } : {}),
        nota: nota.trim() || null,
      });
      setNota('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo={`Reclamo ${r.numero} · ${r.asunto}`}
        volver={{ href: '/alquileres/reclamos', texto: 'Reclamos' }}
      >
        <PrioridadBadge prioridad={r.prioridad} />
        <EstadoReclamoBadge estado={r.estado} />
      </EncabezadoPagina>
      <Panel icono="🛠️" titulo={NOMBRE_TIPO_RECLAMO[r.tipo]}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dato etiqueta="Contrato">
            {r.contrato && (
              <Link
                href={`/alquileres/contratos/${r.contrato.id}`}
                className="font-semibold text-ink hover:underline"
              >
                {r.contrato.codigo} · {r.contrato.propiedad}
              </Link>
            )}
          </Dato>
          <Dato etiqueta="De">
            {r.persona && (
              <Link
                href={`/alquileres/personas/${r.persona.id}`}
                className="text-ink hover:underline"
              >
                {r.persona.nombre}
              </Link>
            )}
          </Dato>
          <Dato etiqueta="Abierto">
            {fmtFechaDe(r.abierto)}
            {r.abiertoPor ? ` · ${r.abiertoPor}` : ''}
          </Dato>
          <Dato etiqueta="Lo sigue">{r.asignadoA ?? 'Sin asignar'}</Dato>
          <Dato etiqueta="Proveedor">
            <ContactoProveedor proveedor={r.proveedor} />
          </Dato>
        </dl>
        {r.descripcion && (
          <p className="mt-3 whitespace-pre-line text-sm text-ink">{r.descripcion}</p>
        )}
      </Panel>
      <Panel icono="✍️" titulo="Actualizar">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Estado">
              <select
                className={inputClass}
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoReclamo)}
              >
                {Object.entries(NOMBRE_ESTADO_RECLAMO).map(([v, l]) => (
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
            <SelectLoSigue
              usuarios={usuarios}
              value={asignado}
              onChange={setAsignado}
              actual={r.asignadoAId ? { id: r.asignadoAId, nombre: r.asignadoA } : null}
            />
            <SelectProveedor
              proveedores={proveedores}
              value={proveedor}
              onChange={setProveedor}
              actual={r.proveedor}
            />
          </div>
          <Campo
            label="Nota"
            hint="Lo que se hizo o se habló: queda en el historial con tu nombre."
          >
            <textarea
              className={textareaClass}
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </Campo>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={guardar} disabled={guardando || !cambio}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Panel>
      <Bloque icono="🕓" titulo="Historial" detalle={`${r.notas.length}`}>
        {r.notas.length === 0 ? (
          <VacioBloque>Sin notas todavía.</VacioBloque>
        ) : (
          <ol className="divide-y divide-line text-sm">
            {r.notas.map((n) => (
              <li key={n.id} className="px-4 py-2.5">
                <p className="whitespace-pre-line text-ink">{n.texto}</p>
                <p className="text-xs text-muted">
                  {n.usuario ?? 'Sin operador'} · {fmtFechaHora(n.en)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Bloque>
    </div>
  );
}
