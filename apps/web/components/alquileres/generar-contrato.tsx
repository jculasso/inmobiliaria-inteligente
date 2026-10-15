'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ContratoDto, PlantillaDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarDesdePlantilla } from '../../lib/alquileres-api';
import { generarAnexoInventario } from '../../lib/reservas-api';
import { descargarArchivo } from '../../lib/descargar-archivo';
import type { ArchivoDescargado } from '../../lib/api-client';
import { inputClass } from '../form-ui';
import { useRefrescar } from '../../lib/refrescar';
import { MensajeError, Panel } from './piezas';

/** La opción del anexo con el modelo de la plataforma, cuando la inmobiliaria no subió el suyo. */
const MODELO = '__modelo__';

/**
 * El contrato desde una plantilla de Word (entrega 15, rehecha el 7/10/2026):
 * se elige la plantilla y se descarga el Word completo con los datos del
 * contrato. No hay PDF automático: se revisa en Word, se guarda como PDF y se
 * sube en «Documento y firma», el panel de abajo.
 *
 * Al lado, el anexo de inventario (regla 174; Florencia, Vacker, 15/10/2026:
 * «lo mejor es que sea un apéndice del contrato»): con la plantilla de anexo
 * de la inmobiliaria o, si no subió ninguna, con el modelo de la plataforma.
 */
export function GenerarContrato({
  contrato,
  plantillas,
}: {
  contrato: ContratoDto;
  plantillas: PlantillaDto[];
}) {
  const { refrescar, refrescando } = useRefrescar();
  const sirve = (p: PlantillaDto) =>
    p.formato === 'word' && (!p.tipoContrato || p.tipoContrato === contrato.tipo);
  // Las de texto del editor anterior ya no generan: se reemplazan por un Word.
  // Las de reserva se usan desde la reserva y las de anexo, abajo (reglas 162 y 174).
  const sirven = plantillas.filter((p) => sirve(p) && p.documento === 'contrato');
  const anexos = plantillas.filter((p) => sirve(p) && p.documento === 'inventario');
  const [plantillaId, setPlantillaId] = useState(sirven[0]?.id ?? '');
  const [anexoId, setAnexoId] = useState(anexos[0]?.id ?? MODELO);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<null | 'contrato' | 'anexo'>(null);
  if (contrato.estado === 'anulado') return null;

  async function descargar(
    cual: 'contrato' | 'anexo',
    pedir: (token: string) => Promise<ArchivoDescargado>,
  ) {
    setError(null);
    setDescargando(cual);
    try {
      const { blob, nombre } = await pedir(await getAccessToken());
      descargarArchivo(blob, nombre);
      // Queda en el historial del contrato, más abajo.
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el Word.');
    } finally {
      setDescargando(null);
    }
  }

  const ocupado = descargando !== null || refrescando;

  return (
    <Panel icono="📝" titulo="Contrato y anexo desde plantilla">
      <div className="flex flex-col gap-4">
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
                onClick={() =>
                  descargar('contrato', (t) => generarDesdePlantilla(t, contrato.id, plantillaId))
                }
                disabled={ocupado || !plantillaId}
              >
                {descargando === 'contrato' ? 'Preparando…' : '⬇️ Descargar el contrato en Word'}
              </Button>
            </div>
            <p className="text-xs text-muted">
              Revisalo en Word, guardalo como PDF y subilo abajo, en «Documento y firma», para
              mandarlo a firmar.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Plantilla del anexo de inventario"
              className={`${inputClass} w-64`}
              value={anexoId}
              onChange={(e) => setAnexoId(e.target.value)}
            >
              {anexos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
              <option value={MODELO}>Modelo de la plataforma</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              // En el teléfono el rótulo no entra en un renglón: que baje.
              className="h-auto shrink whitespace-normal py-1.5 text-left"
              onClick={() =>
                descargar('anexo', (t) =>
                  generarAnexoInventario(t, contrato.id, anexoId === MODELO ? null : anexoId),
                )
              }
              disabled={ocupado}
            >
              {descargando === 'anexo'
                ? 'Preparando…'
                : '⬇️ Descargar el anexo de inventario (Word)'}
            </Button>
          </div>
          <p className="text-xs text-muted">
            El inventario de arriba, como apéndice del contrato.
            {anexos.length === 0 &&
              ' Para usar el tuyo, subilo en Plantillas como anexo de inventario.'}
          </p>
        </div>
        <MensajeError>{error}</MensajeError>
      </div>
    </Panel>
  );
}
