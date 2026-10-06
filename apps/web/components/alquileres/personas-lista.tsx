'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, recortarAlLimite, type PersonaDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { Buscador, paraBuscar } from './buscador';
import { PersonaFormModal } from './persona-form-modal';

/** Documento con formato legible: DNI con puntos, CUIT con guiones. */
export function documentoLegible(doc: string | null): string {
  if (!doc) return '—';
  if (doc.length === 11) return `${doc.slice(0, 2)}-${doc.slice(2, 10)}-${doc.slice(10)}`;
  return doc.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function PersonasLista({ personas }: { personas: PersonaDto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'nueva' | null>(null);
  const { visibles, hayMas } = recortarAlLimite(personas);

  const filtradas = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((p) => [p.nombre, p.documento, p.email, p.telefono].some((c) => paraBuscar(c).includes(q)));
  }, [visibles, busqueda]);

  // La fila abre la cuenta corriente; los datos se editan desde ahí.
  const abrir = (p: PersonaDto) => router.push(`/alquileres/personas/${p.id}`);

  const guardado = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o documento" />
        <Button variant="primary" size="sm" onClick={() => setModal('nueva')}>
          + Nueva persona
        </Button>
      </div>

      {hayMas && (
        <p role="status" className="text-sm text-muted">
          Se muestran las primeras {LIMITE_LISTA} personas por orden alfabético.
        </p>
      )}

      {personas.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          Todavía no hay personas cargadas. Empezá por los propietarios.
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          Nadie coincide con «{busqueda}».
        </p>
      ) : (
        <>
          <ListaTarjetas etiqueta="Personas">
            {filtradas.map((p) => (
              <Tarjeta key={p.id} onClick={() => abrir(p)} titulo={`Abrir la cuenta de ${p.nombre}`}>
                <span className="block text-sm font-bold text-ink">{p.nombre}</span>
                <CamposTarjeta>
                  <CampoTarjeta etiqueta="Documento">{documentoLegible(p.documento)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Teléfono">{p.telefono ?? '—'}</CampoTarjeta>
                </CamposTarjeta>
              </Tarjeta>
            ))}
          </ListaTarjetas>
          <div className="hidden overflow-x-auto rounded-brand border border-line bg-white sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Documento</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => abrir(p)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-4 py-2.5 font-semibold text-ink">{p.nombre}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{documentoLegible(p.documento)}</td>
                    <td className="px-4 py-2.5 text-muted">{p.email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{p.telefono ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <PersonaFormModal onClose={() => setModal(null)} onSaved={guardado} />
      )}
    </div>
  );
}
