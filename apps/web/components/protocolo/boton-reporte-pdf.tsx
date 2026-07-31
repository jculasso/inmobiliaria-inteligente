'use client';

import { useState } from 'react';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarReporteSemanalPdf } from '../../lib/protocolo-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';

/**
 * Descarga el reporte en PDF.
 *
 * Va por `abrirPdfEnPestana` para que la pestaña se abra DENTRO del click: si
 * se abre después de esperar la respuesta, el navegador la bloquea como popup.
 */
export function BotonReportePdf() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setGenerando(true);
    setError(null);
    await abrirPdfEnPestana(async () => generarReporteSemanalPdf(await getAccessToken()), {
      titulo: 'Generando el reporte',
      onError: setError,
    });
    setGenerando(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" onClick={generar} disabled={generando}>
        {generando ? 'Generando…' : 'Descargar PDF'}
      </Button>
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
