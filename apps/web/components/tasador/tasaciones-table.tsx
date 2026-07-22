'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TasacionResumenDto } from '@vacker/types';
import { Button, Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { deleteTasacion, generarInforme } from '../../lib/tasador-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { CambiarEstadoModal } from './cambiar-estado-modal';
import { TasacionFila } from './tasacion-fila';

interface Props {
  tasaciones: TasacionResumenDto[];
  puedeBorrar: boolean;
}

/** Historial de tasaciones — mismo estilo de fila que el dashboard, más buscador y gestión (nueva/borrar). */
export function TasacionesTable({ tasaciones, puedeBorrar }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modalEstado, setModalEstado] = useState<TasacionResumenDto | null>(null);
  const [generandoId, setGenerandoId] = useState<string | null>(null);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);

  // Copia local del prop: un cambio de estado se patchea acá sin pedirle a
  // Next.js que vuelva a correr el listado solo para reflejar un campo.
  const [rows, setRows] = useState(tasaciones);
  useEffect(() => setRows(tasaciones), [tasaciones]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) =>
        t.cliente.toLowerCase().includes(q) ||
        t.direccion.toLowerCase().includes(q) ||
        t.agente.nombre.toLowerCase().includes(q),
    );
  }, [rows, busqueda]);

  async function handleDelete(id: string) {
    const accessToken = await getAccessToken();
    await deleteTasacion(accessToken, id);
    router.refresh();
  }

  async function handleGenerarInforme(id: string) {
    setGenerandoId(id);
    setErrorInforme(null);
    await abrirPdfEnPestana(async () => generarInforme(await getAccessToken(), id), {
      titulo: 'Generando informe de tasación',
      onError: setErrorInforme,
    });
    setGenerandoId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <Button variant="primary" size="sm" onClick={() => router.push('/tasador/tasaciones/nueva')}>
            ＋ Nueva tasación
          </Button>
        </div>
      </div>

      {errorInforme && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {errorInforme}
        </p>
      )}

      <Card className="px-5 py-4">
        <div className="flex flex-col">
          {filtradas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Sin tasaciones para mostrar.</p>
          ) : (
            filtradas.map((t) => (
              <TasacionFila
                key={t.id}
                tasacion={t}
                onEstado={() => setModalEstado(t)}
                onVer={() => handleGenerarInforme(t.id)}
                generando={generandoId === t.id}
                onBorrar={puedeBorrar ? () => handleDelete(t.id) : undefined}
              />
            ))
          )}
        </div>
      </Card>

      {modalEstado && (
        <CambiarEstadoModal
          tasacion={modalEstado}
          onClose={() => setModalEstado(null)}
          onSaved={(patch) => {
            const id = modalEstado.id;
            setModalEstado(null);
            setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
          }}
        />
      )}
    </div>
  );
}
