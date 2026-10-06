'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { recortarAlLimite, type TasacionResumenDto } from '@vacker/types';
import { Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { deleteTasacion, generarInforme } from '../../lib/tasador-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { CambiarEstadoModal } from './cambiar-estado-modal';
import { AvisoListaRecortada } from '../aviso-lista-recortada';
import { TasacionFila } from './tasacion-fila';
import { BarraLista, BotonNuevo, MensajeError } from '../piezas';

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
  // La API pide una fila de más que el tope: si vino, quedó algo afuera.
  const { visibles, hayMas } = recortarAlLimite(rows);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return visibles;
    return visibles.filter(
      (t) =>
        t.cliente.toLowerCase().includes(q) ||
        t.direccion.toLowerCase().includes(q) ||
        (t.ciudad?.toLowerCase().includes(q) ?? false) ||
        t.agente.nombre.toLowerCase().includes(q),
    );
  }, [visibles, busqueda]);

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
      {/* «de cuántas» cuenta las visibles: la fila de sonda de la API (la 501)
          no es una tasación que se pueda ver. */}
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por cliente, dirección, ciudad o agente…"
        visibles={filtradas.length}
        total={visibles.length}
        nombre="tasaciones"
      >
        <BotonNuevo href="/tasador/tasaciones/nueva">Nueva tasación</BotonNuevo>
      </BarraLista>

      {hayMas && <AvisoListaRecortada que="tasaciones" />}

      <MensajeError>{errorInforme}</MensajeError>

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
