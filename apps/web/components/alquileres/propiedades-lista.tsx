'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, recortarAlLimite, type PropiedadAlquilerDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { Buscador, paraBuscar } from './buscador';
import { NOMBRE_TIPO_PROPIEDAD, PropiedadFormModal } from './propiedad-form-modal';

export function PropiedadesLista({ propiedades }: { propiedades: PropiedadAlquilerDto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'nueva' | PropiedadAlquilerDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(propiedades);

  const filtradas = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((p) => [p.direccion, p.unidad, p.ciudad].some((c) => paraBuscar(c).includes(q)));
  }, [visibles, busqueda]);

  const guardado = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por dirección o ciudad" />
        <Button variant="primary" size="sm" onClick={() => setModal('nueva')}>
          + Nueva propiedad
        </Button>
      </div>

      {hayMas && (
        <p role="status" className="text-sm text-muted">
          Se muestran las primeras {LIMITE_LISTA} propiedades por dirección.
        </p>
      )}

      {propiedades.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          Todavía no hay propiedades cargadas.
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          Ninguna propiedad coincide con «{busqueda}».
        </p>
      ) : (
        <>
          <ListaTarjetas etiqueta="Propiedades">
            {filtradas.map((p) => (
              <Tarjeta key={p.id} onClick={() => setModal(p)} titulo={`Editar ${p.direccion}`}>
                <span className="block text-sm font-bold text-ink">
                  {p.direccion}
                  {p.unidad ? ` ${p.unidad}` : ''}
                </span>
                <CamposTarjeta>
                  <CampoTarjeta etiqueta="Ciudad">{p.ciudad ?? '—'}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Tipo">{p.tipo ? NOMBRE_TIPO_PROPIEDAD[p.tipo] : '—'}</CampoTarjeta>
                </CamposTarjeta>
              </Tarjeta>
            ))}
          </ListaTarjetas>
          <div className="hidden overflow-x-auto rounded-brand border border-line bg-white sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Dirección</th>
                  <th className="px-4 py-2.5">Piso / depto</th>
                  <th className="px-4 py-2.5">Ciudad</th>
                  <th className="px-4 py-2.5">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setModal(p)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-4 py-2.5 font-semibold text-ink">{p.direccion}</td>
                    <td className="px-4 py-2.5 text-muted">{p.unidad ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{p.ciudad ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{p.tipo ? NOMBRE_TIPO_PROPIEDAD[p.tipo] : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <PropiedadFormModal propiedad={modal === 'nueva' ? undefined : modal} onClose={() => setModal(null)} onSaved={guardado} />
      )}
    </div>
  );
}
