'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NOMBRE_ESTADO_RECLAMO, NOMBRE_PRIORIDAD, NOMBRE_TIPO_RECLAMO, type EstadoReclamo, type PrioridadReclamo, type ReclamoDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarReclamo } from '../../lib/alquileres-api';
import { fmtFecha } from '../../lib/format';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { Bloque, EncabezadoPagina, Panel } from './piezas';
import { EstadoReclamoBadge, PrioridadBadge, useUsuarios } from './reclamos-piezas';

const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Un reclamo: qué pasa, de quién, quién lo tiene, y su historial de notas. */
export function ReclamoFicha({ reclamo: r }: { reclamo: ReclamoDto }) {
  const router = useRouter();
  const usuarios = useUsuarios();
  const [estado, setEstado] = useState<EstadoReclamo>(r.estado);
  const [prioridad, setPrioridad] = useState<PrioridadReclamo>(r.prioridad);
  const [asignado, setAsignado] = useState(r.asignadoAId ?? '');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambio = estado !== r.estado || prioridad !== r.prioridad || asignado !== (r.asignadoAId ?? '') || nota.trim() !== '';

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await cambiarReclamo(await getAccessToken(), r.id, {
        ...(estado !== r.estado ? { estado } : {}),
        ...(prioridad !== r.prioridad ? { prioridad } : {}),
        ...(asignado !== (r.asignadoAId ?? '') ? { asignadoAId: asignado || null } : {}),
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
      <EncabezadoPagina titulo={`Reclamo ${r.numero} · ${r.asunto}`} volver={{ href: '/alquileres/reclamos', texto: 'Reclamos' }}>
        <PrioridadBadge prioridad={r.prioridad} />
        <EstadoReclamoBadge estado={r.estado} />
      </EncabezadoPagina>
      <Panel icono="🛠️" titulo={NOMBRE_TIPO_RECLAMO[r.tipo]}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Contrato</dt>
            <dd>
              {r.contrato ? (
                <Link href={`/alquileres/contratos/${r.contrato.id}`} className="font-semibold text-ink hover:underline">
                  {r.contrato.codigo} · {r.contrato.propiedad}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">De</dt>
            <dd>
              {r.persona ? (
                <Link href={`/alquileres/personas/${r.persona.id}`} className="text-ink hover:underline">
                  {r.persona.nombre}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Abierto</dt>
            <dd className="text-ink">
              {fmtFecha(r.abierto.slice(0, 10))}
              {r.abiertoPor ? ` · ${r.abiertoPor}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Asignado a</dt>
            <dd className="text-ink">{r.asignadoA ?? 'Sin asignar'}</dd>
          </div>
        </dl>
        {r.descripcion && <p className="mt-3 whitespace-pre-line text-sm text-ink">{r.descripcion}</p>}
      </Panel>
      <Panel icono="✍️" titulo="Actualizar">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Estado">
              <select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value as EstadoReclamo)}>
                {Object.entries(NOMBRE_ESTADO_RECLAMO).map(([v, l]) => (
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
              <select className={inputClass} value={asignado} onChange={(e) => setAsignado(e.target.value)}>
                <option value="">Sin asignar</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo label="Nota" hint="Lo que se hizo o se habló: queda en el historial con tu nombre.">
            <textarea className={textareaClass} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
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
        <ol className="divide-y divide-line text-sm">
          {r.notas.map((n) => (
            <li key={n.id} className="px-4 py-2.5">
              <p className="whitespace-pre-line text-ink">{n.texto}</p>
              <p className="text-xs text-muted">
                {n.usuario ?? 'Sin operador'} · {cuando(n.en)}
              </p>
            </li>
          ))}
        </ol>
      </Bloque>
    </div>
  );
}
