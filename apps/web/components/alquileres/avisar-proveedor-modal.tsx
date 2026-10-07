'use client';

import { useState } from 'react';
import {
  AvisoProveedorSchema,
  lineaInquilino,
  redactarAvisoProveedor,
  type ReclamoDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { avisarProveedor } from '../../lib/alquileres-api';
import { primerMensaje } from '../../lib/mensaje-zod';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { Dato } from './piezas';

/**
 * «Avisar al proveedor» (regla 73): el mail ya redactado —dirección, qué
 * pasa, prioridad, el inquilino y quién lo sigue— y editable. Sale solo al
 * email del proveedor, a nombre de la inmobiliaria y con tu firma; si
 * contesta, te llega a vos. Nada se manda solo: hasta que se toca «Enviar».
 */
export function AvisarProveedorModal({
  reclamo: r,
  email,
  onClose,
  onEnviado,
}: {
  reclamo: ReclamoDto;
  /** El email del proveedor: el botón que abre esto no aparece sin él. */
  email: string;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const conTelefono = !!r.inquilino?.telefono;
  const [incluirTelefono, setIncluirTelefono] = useState(true);
  const [{ asunto, cuerpo }, setMail] = useState(() => redactarAvisoProveedor(r, true));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const nombre = r.proveedor?.nombre ?? 'el proveedor';

  /** El tilde cambia la línea del inquilino por la otra, sin pisar lo que se haya editado. */
  function alternarTelefono(incluir: boolean) {
    setIncluirTelefono(incluir);
    if (!r.inquilino) return;
    const antes = lineaInquilino(r.inquilino, !incluir);
    const despues = lineaInquilino(r.inquilino, incluir);
    setMail((m) => ({ ...m, cuerpo: m.cuerpo.replace(antes, despues) }));
  }

  async function enviar() {
    const v = AvisoProveedorSchema.safeParse({ asunto, cuerpo });
    if (!v.success) {
      setError(primerMensaje(v.error, 'Revisá el mail.'));
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await avisarProveedor(await getAccessToken(), r.id, v.data);
      setListo(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mandar.');
      setEnviando(false);
    }
  }

  return (
    <Modal
      title={`Avisar a ${nombre}`}
      subtitle="Sale a nombre de la inmobiliaria, con tu firma. Si contesta, la respuesta te llega a vos."
      onClose={listo ? onEnviado : onClose}
      size="lg"
    >
      {listo ? (
        <div className="flex flex-col gap-3">
          <p
            role="status"
            className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink"
          >
            ✉️ Enviado a {nombre} ({email}). Quedó en el historial del reclamo.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onEnviado}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <dl>
            <Dato etiqueta="Para">
              <span className="font-semibold">{nombre}</span> · {email}
            </Dato>
          </dl>
          <Campo label="Asunto" requerido>
            <input
              className={inputClass}
              value={asunto}
              onChange={(e) => setMail((m) => ({ ...m, asunto: e.target.value }))}
            />
          </Campo>
          {conTelefono && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-red"
                checked={incluirTelefono}
                onChange={(e) => alternarTelefono(e.target.checked)}
              />
              Incluir el teléfono del inquilino
            </label>
          )}
          <Campo label="Mail" hint="Revisalo y cambiá lo que haga falta: se manda tal cual.">
            <textarea
              className={textareaClass}
              rows={14}
              value={cuerpo}
              onChange={(e) => setMail((m) => ({ ...m, cuerpo: e.target.value }))}
            />
          </Campo>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : '✉️ Enviar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
