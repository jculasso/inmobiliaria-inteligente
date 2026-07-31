'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DestinatarioReporte } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { enviarReporteSemanal, getDestinatariosReporte } from '../../lib/protocolo-api';

/**
 * Confirmación del envío del reporte por mail.
 *
 * Reemplaza a un `window.confirm` que preguntaba "¿seguimos?" sin decir a
 * quién le iba a llegar, y que devolvía el resultado en una línea gris de once
 * píxeles. Con eso, el caso más frecuente —que todavía no haya nadie marcado—
 * pasaba inadvertido: el mail no salía y parecía que sí.
 *
 * Ahora la lista de destinatarios se muestra ANTES de mandar, y si está vacía
 * el botón ni siquiera se habilita: se explica dónde se marca y se ofrece el
 * link.
 */
export function EnviarReporteModal({ onClose }: { onClose: () => void }) {
  const [destinatarios, setDestinatarios] = useState<DestinatarioReporte[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await getDestinatariosReporte(await getAccessToken());
        if (vivo) setDestinatarios(lista);
      } catch (err) {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudo leer la lista.');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await enviarReporteSemanal(await getAccessToken());
      setResultado({
        ok: r.enviado,
        mensaje: r.enviado
          ? `Salió a ${r.destinatarios.length} ${r.destinatarios.length === 1 ? 'destinatario' : 'destinatarios'}. Si es el primer envío, puede tardar unos minutos y conviene mirar la carpeta de correo no deseado.`
          : (r.motivo ?? 'No se mandó el reporte.'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mandar el reporte.');
    } finally {
      setEnviando(false);
    }
  }

  const vacia = destinatarios?.length === 0;

  return (
    <Modal title="Enviar el reporte por mail" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {resultado ? (
          <div
            className={`rounded-brand border px-4 py-3 text-sm font-semibold ${
              resultado.ok
                ? 'border-success/30 bg-success/5 text-success'
                : 'border-warning/40 bg-warning/5 text-warning'
            }`}
          >
            {resultado.ok ? '✓ ' : ''}
            {resultado.mensaje}
          </div>
        ) : (
          <>
            {destinatarios === null && !error && (
              <p className="text-sm text-muted">Buscando los destinatarios…</p>
            )}

            {vacia && (
              <div className="rounded-brand border border-warning/40 bg-warning/5 px-4 py-3">
                <p className="text-sm font-bold text-warning">Todavía no hay destinatarios</p>
                <p className="mt-1 text-xs text-muted">
                  El reporte se manda solo a quien lo tenga marcado. Se activa por persona, desde la
                  administración de la inmobiliaria, editando el usuario.
                </p>
                <Link
                  href="/admin"
                  className="mt-2 inline-block text-xs font-bold text-brand-red hover:underline"
                >
                  Ir a la administración →
                </Link>
              </div>
            )}

            {destinatarios && destinatarios.length > 0 && (
              <div>
                <p className="text-sm text-ink">
                  Le va a llegar a{' '}
                  <strong>
                    {destinatarios.length}{' '}
                    {destinatarios.length === 1 ? 'persona' : 'personas'}
                  </strong>
                  , con el PDF adjunto:
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {destinatarios.map((d) => (
                    <li
                      key={d.email}
                      className="rounded-brand border border-line bg-surface px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-ink">{d.nombre}</span>{' '}
                      <span className="text-muted">· {d.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {resultado ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!resultado && (
            <Button
              type="button"
              variant="primary"
              onClick={enviar}
              disabled={enviando || !destinatarios || vacia}
            >
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
