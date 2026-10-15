'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlantillaDto, ReservaDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarReservaEnWord } from '../../lib/reservas-api';
import { descargarArchivo } from '../../lib/descargar-archivo';
import { useRefrescar } from '../../lib/refrescar';
import { inputClass } from '../form-ui';
import { MensajeError, Panel } from './piezas';

/**
 * La reserva en Word (regla 163), con una plantilla DE RESERVA (regla 162):
 * se elige la plantilla y se descarga el formulario completo. No se guarda;
 * queda en la línea de tiempo.
 */
export function GenerarReserva({
  reserva,
  plantillas,
}: {
  reserva: ReservaDto;
  plantillas: PlantillaDto[];
}) {
  const { refrescar, refrescando } = useRefrescar();
  const sirven = plantillas.filter(
    (p) =>
      p.formato === 'word' &&
      p.documento === 'reserva' &&
      (!p.tipoContrato || p.tipoContrato === reserva.tipo),
  );
  const [plantillaId, setPlantillaId] = useState(sirven[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  if (reserva.estado === 'anulada') return null;

  async function descargar() {
    setError(null);
    setDescargando(true);
    try {
      const { blob, nombre } = await generarReservaEnWord(
        await getAccessToken(),
        reserva.id,
        plantillaId,
      );
      descargarArchivo(blob, nombre);
      // Queda en la línea de tiempo, más abajo.
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar la reserva.');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Panel icono="📝" titulo="Formulario de reserva">
      {sirven.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay una plantilla de reserva en Word.{' '}
          <Link
            href="/alquileres/plantillas"
            className="font-semibold text-brand-red hover:underline"
          >
            Subir una
          </Link>{' '}
          (hay un ejemplo para descargar).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Plantilla de reserva"
              className={`${inputClass} w-64`}
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
            >
              {sirven.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={descargar}
              disabled={descargando || refrescando || !plantillaId}
            >
              {descargando ? 'Preparando…' : '⬇️ Descargar la reserva en Word'}
            </Button>
          </div>
          <MensajeError>{error}</MensajeError>
        </div>
      )}
    </Panel>
  );
}
