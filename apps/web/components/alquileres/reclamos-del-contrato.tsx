'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContratoDto, ReclamoResumenDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { fmtFecha } from '../../lib/format';
import { Bloque } from './piezas';
import { EstadoReclamoBadge, NuevoReclamoModal, PrioridadBadge } from './reclamos-piezas';

/** Los reclamos de un contrato, en su ficha, con el botón para abrir uno. */
export function ReclamosDelContrato({ contrato, reclamos }: { contrato: ContratoDto; reclamos: ReclamoResumenDto[] }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState(false);
  return (
    <Bloque
      icono="🛠️"
      titulo="Reclamos"
      detalle={reclamos.length ? `${reclamos.length}` : undefined}
      acciones={
        contrato.estado === 'vigente' && (
          <Button variant="secondary" size="sm" onClick={() => setNuevo(true)}>
            ＋ Nuevo reclamo
          </Button>
        )
      }
    >
      {reclamos.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">Sin reclamos.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {reclamos.map((r) => (
            <li key={r.id}>
              <Link href={`/alquileres/reclamos/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface/60">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    {r.numero} · {r.asunto}
                  </span>
                  <span className="block text-xs text-muted">
                    {fmtFecha(r.abierto.slice(0, 10))} · {r.asignadoA ?? 'sin asignar'}
                  </span>
                </span>
                <span className="flex gap-1">
                  <PrioridadBadge prioridad={r.prioridad} />
                  <EstadoReclamoBadge estado={r.estado} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {nuevo && (
        <NuevoReclamoModal
          contratos={[{ id: contrato.id, codigo: contrato.codigo, propiedad: { id: contrato.propiedad.id, direccion: contrato.propiedad.direccion, unidad: contrato.propiedad.unidad }, estado: contrato.estado }]}
          contratoFijo={contrato.id}
          onClose={() => setNuevo(false)}
          onCreado={(id) => router.push(`/alquileres/reclamos/${id}`)}
        />
      )}
    </Bloque>
  );
}
