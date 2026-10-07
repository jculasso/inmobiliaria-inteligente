'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ContratoDto, PlantillaDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarDesdePlantilla } from '../../lib/alquileres-api';
import { descargarArchivo } from '../../lib/descargar-archivo';
import { inputClass } from '../form-ui';
import { useRefrescar } from '../../lib/refrescar';
import { MensajeError, Panel } from './piezas';

/**
 * El contrato desde una plantilla de Word (entrega 15, rehecha el 7/10/2026):
 * se elige la plantilla y se descarga el Word completo con los datos del
 * contrato. No hay PDF automático: se revisa en Word, se guarda como PDF y se
 * sube en «Documento y firma», el panel de abajo.
 */
export function GenerarContrato({
  contrato,
  plantillas,
}: {
  contrato: ContratoDto;
  plantillas: PlantillaDto[];
}) {
  const { refrescar, refrescando } = useRefrescar();
  // Las de texto del editor anterior ya no generan: se reemplazan por un Word.
  const sirven = plantillas.filter(
    (p) => p.formato === 'word' && (!p.tipoContrato || p.tipoContrato === contrato.tipo),
  );
  const [plantillaId, setPlantillaId] = useState(sirven[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  if (contrato.estado === 'anulado') return null;

  async function descargar() {
    setError(null);
    setDescargando(true);
    try {
      const { blob, nombre } = await generarDesdePlantilla(
        await getAccessToken(),
        contrato.id,
        plantillaId,
      );
      descargarArchivo(blob, nombre);
      // Queda en el historial del contrato, más abajo.
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el contrato.');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Panel icono="📝" titulo="Contrato desde plantilla">
      {sirven.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay plantillas en Word para este tipo de contrato.{' '}
          <Link
            href="/alquileres/plantillas"
            className="font-semibold text-brand-red hover:underline"
          >
            Subir una
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Plantilla"
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
              {descargando ? 'Preparando…' : '⬇️ Descargar el contrato en Word'}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Revisalo en Word, guardalo como PDF y subilo abajo, en «Documento y firma», para
            mandarlo a firmar.
          </p>
          <MensajeError>{error}</MensajeError>
        </div>
      )}
    </Panel>
  );
}
