'use client';

import { useRef, useState } from 'react';
import type { DocumentoContratoDto, EstadoFirma, EstadoFirmante } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarFirma, cargarContratoFirmado, cargarDocumentoContrato, enviarAFirmar, urlDocumento } from '../../lib/alquileres-api';
import { inputClass } from '../form-ui';
import { Panel } from './piezas';

export const NOMBRE_ESTADO_FIRMA: Record<EstadoFirma, string> = {
  sin_enviar: 'Sin enviar',
  enviado: 'Enviado a firmar',
  firmado_parcial: 'Firmado en parte',
  firmado: 'Firmado',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
};

const ESTILO_ESTADO: Record<EstadoFirma, string> = {
  sin_enviar: 'bg-surface text-muted',
  enviado: 'bg-warning/10 text-warning',
  firmado_parcial: 'bg-warning/10 text-warning',
  firmado: 'bg-success/10 text-success',
  rechazado: 'bg-brand-red/10 text-brand-red',
  vencido: 'bg-brand-red/10 text-brand-red',
};

const PAPEL = { propietario: 'Propietario', inquilino: 'Inquilino', garante: 'Garante' } as const;
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * El documento del contrato y su firma (reglas 33 a 36). Por ahora con el
 * adaptador manual: la inmobiliaria manda el PDF por su cuenta y marca quién
 * firmó, o sube el contrato firmado. Cada cambio queda en el historial.
 */
export function FirmaContrato({ contratoId, documento: inicial }: { contratoId: string; documento: DocumentoContratoDto | null }) {
  const [doc, setDoc] = useState(inicial);
  const [cambios, setCambios] = useState<Record<string, EstadoFirmante>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const firmado = useRef<HTMLInputElement>(null);

  async function hacer(accion: () => Promise<DocumentoContratoDto>) {
    setError(null);
    setOcupado(true);
    try {
      setDoc(await accion());
      setCambios({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  async function abrir(esFirmado: boolean) {
    if (!doc) return;
    // La pestaña se abre en el click (si no, el navegador la bloquea) y se le pone el link al llegar.
    const ventana = window.open('', '_blank');
    try {
      const { url } = await urlDocumento(await getAccessToken(), doc.id, esFirmado);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    } catch (err) {
      ventana?.close();
      setError(err instanceof Error ? err.message : 'No se pudo abrir el PDF.');
    }
  }

  const elegirArchivo = (input: HTMLInputElement | null, subir: (f: File) => Promise<DocumentoContratoDto>) => {
    const f = input?.files?.[0];
    if (input) input.value = '';
    if (f) void hacer(() => subir(f));
  };

  const sePuedeCambiarPdf = !doc || doc.estadoFirma === 'sin_enviar';
  const pendientesDeGuardar = Object.keys(cambios).length > 0;

  return (
    <Panel
      icono="✍️"
      titulo="Documento y firma"
      derecha={doc && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ESTILO_ESTADO[doc.estadoFirma]}`}>{NOMBRE_ESTADO_FIRMA[doc.estadoFirma]}</span>}
    >

      <input ref={archivo} type="file" accept="application/pdf" className="hidden" aria-label="PDF del contrato" onChange={(e) => elegirArchivo(e.currentTarget, async (f) => cargarDocumentoContrato(await getAccessToken(), contratoId, f))} />
      <input ref={firmado} type="file" accept="application/pdf" className="hidden" aria-label="PDF firmado" onChange={(e) => elegirArchivo(e.currentTarget, async (f) => cargarContratoFirmado(await getAccessToken(), doc!.id, f))} />

      {!doc ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Todavía no se cargó el PDF del contrato. Puede estar vigente igual: se firmó en papel y se carga después.</p>
          <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => archivo.current?.click()}>
            Cargar el PDF
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => abrir(false)} className="font-semibold text-brand-red hover:underline">
              {doc.nombreArchivo ?? 'Ver el PDF'}
            </button>
            {doc.tieneFirmado && (
              <button type="button" onClick={() => abrir(true)} className="font-semibold text-success hover:underline">
                · Ver el firmado
              </button>
            )}
            {doc.proveedor && doc.proveedor !== 'manual' && <span className="text-xs text-muted">· por {doc.proveedor}</span>}
          </div>

          <ul className="divide-y divide-line rounded-brand border border-line text-sm">
            {doc.firmantes.map((f) => (
              <li key={f.personaId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-semibold text-ink">{f.nombre}</span> <span className="text-xs text-muted">{PAPEL[f.papel]}</span>
                </span>
                <span className="w-36 shrink-0">
                  <select
                    aria-label={`Firma de ${f.nombre}`}
                    className={`${inputClass} h-9`}
                    value={cambios[f.personaId] ?? f.estado}
                    disabled={doc.estadoFirma === 'sin_enviar'}
                    onChange={(e) => setCambios({ ...cambios, [f.personaId]: e.target.value as EstadoFirmante })}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="firmado">Firmó</option>
                    <option value="rechazado">Rechazó</option>
                  </select>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            {sePuedeCambiarPdf && (
              <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => archivo.current?.click()}>
                Cambiar el PDF
              </Button>
            )}
            {['sin_enviar', 'vencido', 'rechazado'].includes(doc.estadoFirma) && (
              <Button variant="primary" size="sm" disabled={ocupado} onClick={() => hacer(async () => enviarAFirmar(await getAccessToken(), doc.id))}>
                Marcar como enviado
              </Button>
            )}
            {pendientesDeGuardar && (
              <Button
                variant="primary"
                size="sm"
                disabled={ocupado}
                onClick={() =>
                  hacer(async () => cambiarFirma(await getAccessToken(), doc.id, { firmantes: Object.entries(cambios).map(([personaId, estado]) => ({ personaId, estado })) }))
                }
              >
                Guardar las firmas
              </Button>
            )}
            {doc.estadoFirma !== 'sin_enviar' && doc.estadoFirma !== 'firmado' && (
              <>
                <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => firmado.current?.click()}>
                  Subir el contrato firmado
                </Button>
                {doc.estadoFirma !== 'vencido' && (
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => hacer(async () => cambiarFirma(await getAccessToken(), doc.id, { marcar: 'vencido' }))}>
                    Marcar como vencido
                  </Button>
                )}
              </>
            )}
          </div>

          {doc.eventos.length > 0 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-semibold">Historial · {doc.eventos.length}</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {[...doc.eventos].reverse().map((e, i) => (
                  <li key={i}>
                    {fechaHora(e.fecha)} · {e.estadoAnterior && e.estadoAnterior !== e.estadoNuevo ? `${NOMBRE_ESTADO_FIRMA[e.estadoAnterior]} → ` : ''}
                    {NOMBRE_ESTADO_FIRMA[e.estadoNuevo]} · {e.origen === 'manual' ? 'a mano' : e.origen}
                    {e.detalle ? ` · ${e.detalle}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}
    </Panel>
  );
}
