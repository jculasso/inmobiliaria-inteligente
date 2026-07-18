'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TasacionDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { deleteTasacion, generarInforme } from '../../lib/tasador-api';
import { fmtNum } from '../../lib/format';
import { ConfirmDeleteButton } from '../tablero/confirm-delete-button';
import { TasacionFormModal } from './tasacion-form-modal';

function estadoClass(estado: string): string {
  if (estado === 'Captada') return 'bg-success/10 text-success';
  if (estado === 'No captada') return 'bg-brand-red/10 text-brand-red';
  return 'bg-surface text-muted';
}

interface Props {
  tasaciones: TasacionDto[];
  puedeBorrar: boolean;
}

export function TasacionesTable({ tasaciones, puedeBorrar }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'create' | TasacionDto | null>(null);
  const [generandoId, setGenerandoId] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return tasaciones;
    return tasaciones.filter(
      (t) =>
        t.cliente.toLowerCase().includes(q) ||
        t.direccion.toLowerCase().includes(q) ||
        t.agente.nombre.toLowerCase().includes(q),
    );
  }, [tasaciones, busqueda]);

  async function handleDelete(id: string) {
    const accessToken = await getAccessToken();
    await deleteTasacion(accessToken, id);
    router.refresh();
  }

  async function handleGenerarInforme(id: string) {
    setGenerandoId(id);
    try {
      const accessToken = await getAccessToken();
      const { url } = await generarInforme(accessToken, id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setGenerandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente, dirección o agente…"
          className="h-9 w-full max-w-sm rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
        />
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-muted">
            {filtradas.length} de {tasaciones.length} tasaciones
          </span>
          <Button variant="primary" size="sm" onClick={() => setModal('create')}>
            ＋ Nueva tasación
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Dirección</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Sup. total</th>
              <th className="px-4 py-2">Agente</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">
                  Sin tasaciones para mostrar.
                </td>
              </tr>
            ) : (
              filtradas.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{t.fecha}</td>
                  <td className="px-4 py-2 font-medium text-ink">{t.cliente}</td>
                  <td className="px-4 py-2">{t.direccion}</td>
                  <td className="px-4 py-2 text-muted">{t.tipoPropiedad}</td>
                  <td className="px-4 py-2">{fmtNum(t.superficieTotal)} m²</td>
                  <td className="px-4 py-2 text-muted">{t.agente.nombre}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estadoClass(t.estado)}`}>
                      {t.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setModal(t)}
                        aria-label="Editar"
                        className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerarInforme(t.id)}
                        disabled={generandoId === t.id}
                        className="text-xs font-medium text-brand-red hover:underline disabled:opacity-50"
                      >
                        {generandoId === t.id ? 'Generando…' : 'Informe (PDF)'}
                      </button>
                      {puedeBorrar && (
                        <ConfirmDeleteButton
                          confirmMessage={`¿Borrar la tasación de ${t.cliente}?`}
                          onConfirm={() => handleDelete(t.id)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <TasacionFormModal
          tasacion={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
