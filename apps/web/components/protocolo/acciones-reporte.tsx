'use client';

import { useState } from 'react';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarReporteSemanalPdf } from '../../lib/protocolo-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { EnviarReporteModal } from './enviar-reporte-modal';

/**
 * Descargar el reporte y mandarlo por mail.
 *
 * El envío abre un modal en vez de un `window.confirm`: manda un correo real a
 * personas reales, y hay que ver A QUIÉNES antes de apretar. Con la
 * confirmación del navegador, el caso más frecuente —que todavía no haya nadie
 * marcado— pasaba inadvertido.
 */
export function AccionesReporte() {
  const [generando, setGenerando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setGenerando(true);
    setError(null);
    await abrirPdfEnPestana(async () => generarReporteSemanalPdf(await getAccessToken()), {
      titulo: 'Generando el reporte',
      onError: setError,
    });
    setGenerando(false);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={descargar} disabled={generando}>
          {generando ? 'Generando…' : 'Descargar PDF'}
        </Button>
        <Button type="button" variant="primary" onClick={() => setAbierto(true)}>
          Enviar por mail
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      {abierto && <EnviarReporteModal onClose={() => setAbierto(false)} />}
    </div>
  );
}
