'use client';

import { useEffect, useState } from 'react';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { getFichaPersona } from '../../lib/alquileres-api';
import { Campo, inputClass } from '../form-ui';

interface Sugerido {
  email: string;
  quien: string;
}

/**
 * Mandar un recibo o una liquidación por mail (punto 14 de Javier, con
 * Resend). Propone los mails de la persona y de sus contactos; se puede sumar
 * otro. Sale a nombre de la inmobiliaria y queda en el historial.
 */
export function EnviarMailModal({
  titulo,
  personaId,
  enviar,
  onClose,
  onEnviado,
}: {
  titulo: string;
  personaId: string;
  enviar: (para: string[]) => Promise<unknown>;
  onClose: () => void;
  onEnviado?: (para: string[]) => void;
}) {
  const [sugeridos, setSugeridos] = useState<Sugerido[] | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [otro, setOtro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string[] | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const f = await getFichaPersona(await getAccessToken(), personaId);
        if (!vigente) return;
        const xs: Sugerido[] = [
          ...(f.persona.email ? [{ email: f.persona.email, quien: f.persona.nombre }] : []),
          ...f.contactos.filter((c) => c.email).map((c) => ({ email: c.email!, quien: `${c.nombre}${c.relacion ? ` (${c.relacion})` : ''}` })),
        ];
        setSugeridos(xs);
        setElegidos(xs.slice(0, 1).map((x) => x.email));
      } catch {
        if (vigente) setSugeridos([]);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [personaId]);

  const alternar = (email: string) => setElegidos((xs) => (xs.includes(email) ? xs.filter((x) => x !== email) : [...xs, email]));

  async function mandar() {
    const para = [...new Set([...elegidos, ...otro.split(/[,;\s]+/).filter(Boolean)].map((x) => x.trim().toLowerCase()))];
    if (para.length === 0) {
      setError('Elegí a quién mandarlo.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await enviar(para);
      setListo(para);
      onEnviado?.(para);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mandar.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={titulo} subtitle="Sale a nombre de la inmobiliaria, con el PDF adjunto." onClose={onClose}>
      {listo ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink">
            ✉️ Enviado a {listo.join(', ')}. Quedó en el historial.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sugeridos === null ? (
            <p className="text-sm text-muted">Buscando los mails…</p>
          ) : sugeridos.length === 0 ? (
            <p className="text-sm text-muted">No tiene un mail cargado: escribilo abajo (y conviene sumarlo a su ficha).</p>
          ) : (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">A quién</legend>
              {sugeridos.map((s) => (
                <label key={s.email} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="h-4 w-4 accent-brand-red" checked={elegidos.includes(s.email)} onChange={() => alternar(s.email)} />
                  <span>
                    {s.email} <span className="text-muted">· {s.quien}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <Campo label="Otro email" hint="Si son varios, separalos con coma.">
            <input className={inputClass} type="email" multiple value={otro} onChange={(e) => setOtro(e.target.value)} />
          </Campo>
          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={mandar} disabled={enviando || sugeridos === null}>
              {enviando ? 'Enviando…' : '✉️ Enviar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
