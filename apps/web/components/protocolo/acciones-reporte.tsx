'use client';

import { useState } from 'react';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { enviarReporteSemanal, generarReporteSemanalPdf } from '../../lib/protocolo-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';

/**
 * Descargar el reporte y mandarlo por mail.
 *
 * "Enviar por mail" pide confirmación: manda un correo real a personas reales,
 * y un click sin querer no puede tener ese efecto. Después del envío dice a
 * QUIÉNES les llegó — sin eso no hay forma de saber si la lista de
 * destinatarios está bien.
 */
export function AccionesReporte() {
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function descargar() {
    setGenerando(true);
    setError(null);
    await abrirPdfEnPestana(async () => generarReporteSemanalPdf(await getAccessToken()), {
      titulo: 'Generando el reporte',
      onError: setError,
    });
    setGenerando(false);
  }

  async function enviar() {
    if (!window.confirm('Se va a mandar el reporte por mail a quienes lo tengan marcado. ¿Seguimos?')) {
      return;
    }
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await enviarReporteSemanal(await getAccessToken());
      setAviso(
        r.enviado
          ? `Enviado a ${r.destinatarios.join(', ')}.`
          : (r.motivo ?? 'No se mandó el reporte.'),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mandar el reporte.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={descargar} disabled={generando}>
          {generando ? 'Generando…' : 'Descargar PDF'}
        </Button>
        <Button type="button" variant="primary" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar por mail'}
        </Button>
      </div>
      {aviso && <p className="max-w-xs text-right text-xs text-muted">{aviso}</p>}
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
