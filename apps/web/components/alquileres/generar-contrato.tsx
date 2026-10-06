'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContratoDto, DocumentoContratoDto, PlantillaDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarDesdePlantilla, vistaPreviaPlantilla } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { inputClass } from '../form-ui';
import { Panel } from './piezas';

/**
 * Generar el contrato desde una plantilla (entrega 15): el PDF queda como el
 * documento del contrato, listo para mandar a firmar. Mientras no se envió,
 * se puede volver a generar.
 */
export function GenerarContrato({ contrato, plantillas, documento }: { contrato: ContratoDto; plantillas: PlantillaDto[]; documento: DocumentoContratoDto | null }) {
  const router = useRouter();
  const sirven = plantillas.filter((p) => !p.tipoContrato || p.tipoContrato === contrato.tipo);
  const [plantillaId, setPlantillaId] = useState(sirven[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const enviado = documento != null && documento.estadoFirma !== 'sin_enviar';
  if (enviado || contrato.estado === 'anulado') return null;

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      await generarDesdePlantilla(await getAccessToken(), contrato.id, plantillaId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Panel icono="📝" titulo="Contrato desde plantilla">
      {sirven.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay plantillas para este tipo de contrato.{' '}
          <Link href="/alquileres/plantillas" className="font-semibold text-brand-red hover:underline">
            Crear una
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Plantilla" className={`${inputClass} w-64`} value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
              {sirven.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                abrirPdfEnPestana(async () => vistaPreviaPlantilla(await getAccessToken(), contrato.id, sirven.find((p) => p.id === plantillaId)!.cuerpo), { titulo: 'Vista previa', onError: setError })
              }
            >
              👁️ Vista previa
            </Button>
            <Button variant="primary" size="sm" onClick={generar} disabled={generando || !plantillaId}>
              {generando ? 'Generando…' : documento ? '📝 Volver a generar el PDF' : '📝 Generar el PDF del contrato'}
            </Button>
          </div>
          <p className="text-xs text-muted">Queda como el documento del contrato, abajo, para mandar a firmar.</p>
          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
