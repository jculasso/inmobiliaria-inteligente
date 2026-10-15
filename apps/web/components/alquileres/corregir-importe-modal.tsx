'use client';

import { useEffect, useState } from 'react';
import type { ContratoDto, CorreccionTramoDto, EstadoMesCorreccionDto } from '@vacker/types';
import { mesLargo, planDeCorreccion } from '@vacker/domain';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { corregirImporteTramo, getCorreccionTramo } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { leerImporte } from '../../lib/importe';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { InputImporte } from '../input-importe';

const mes = (periodo: string) => mesLargo(`${periodo}-01`);

/** Cómo se lee el estado de un mes al lado de su nombre. */
export const ESTADO_MES: Record<EstadoMesCorreccionDto, string> = {
  cobrado: 'cobrado: queda como está',
  liquidado: 'liquidado: queda como está',
  anulado: 'anulado: queda como está',
  generado: 'se vuelve a generar',
  sin_generar: 'todavía sin generar',
};

/** «octubre de 2026, noviembre de 2026 y diciembre de 2026». */
function enumerar(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

/**
 * Lo que va a pasar con cada mes desde el elegido (regla 109), con la misma
 * cuenta que hace la API (`planDeCorreccion`): lo que se vuelve a generar, lo
 * que queda como está y por qué, y lo que todavía no se generó.
 */
export function resumenDeCorreccion(meses: CorreccionTramoDto['meses'], desde: string): string[] {
  const plan = planDeCorreccion(meses, desde);
  return [
    plan.regenerar.length
      ? `Se vuelve a generar con el importe nuevo: ${enumerar(plan.regenerar.map(mes))}.`
      : null,
    plan.quedan.length
      ? `${plan.quedan.length === 1 ? 'Queda como está' : 'Quedan como están'}: ${enumerar(plan.quedan.map((m) => `${mes(m.periodo)} (${m.estado})`))}. Lo cobrado y lo liquidado no se toca.`
      : null,
    plan.sinGenerar.length
      ? `Todavía sin generar: ${enumerar(plan.sinGenerar.map(mes))}. ${plan.sinGenerar.length === 1 ? 'Al generarlo ya sale' : 'Al generarlos ya salen'} con el importe nuevo.`
      : null,
  ].filter((x): x is string => x !== null);
}

/**
 * Corregir el importe de un tramo ya confirmado (reglas 108 a 110). Florencia
 * (Vacker), 15/10/2026: después de una indexación las partes negocian otro
 * importe, y ese pasa a ser la base de las indexaciones siguientes.
 */
export function CorregirImporteModal({
  contrato: c,
  numero,
  onClose,
  onDone,
}: {
  contrato: ContratoDto;
  numero: number;
  onClose: () => void;
  /** Si devuelve una promesa (el refresh de la página), el modal la espera ocupado. */
  onDone: () => void | Promise<void>;
}) {
  const [datos, setDatos] = useState<CorreccionTramoDto | null>(null);
  const [importe, setImporte] = useState('');
  const [desde, setDesde] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await getCorreccionTramo(await getAccessToken(), c.id, numero);
        if (!vivo) return;
        setDatos(d);
        setDesde(d.desdeSugerido ?? '');
      } catch (err) {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudo leer el tramo.');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [c.id, numero]);

  async function corregir() {
    const n = leerImporte(importe);
    if (n == null) return;
    setError(null);
    setEnviando(true);
    try {
      await corregirImporteTramo(await getAccessToken(), c.id, numero, {
        importe: n,
        desde,
        motivo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo corregir.');
      setEnviando(false);
      return;
    }
    setActualizando(true);
    await onDone();
  }

  const nuevo = leerImporte(importe);
  const resumen = datos && desde ? resumenDeCorreccion(datos.meses, desde) : [];
  return (
    <Modal
      title={`Corregir el importe del tramo ${numero}`}
      subtitle={
        datos
          ? `Del ${fmtFecha(datos.desde)} al ${fmtFecha(datos.hasta)} · hoy ${fmtMoneda(datos.importe, c.moneda)}`
          : undefined
      }
      onClose={onClose}
      cerrable={!enviando}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Para un importe que las partes acordaron después de indexar. El importe nuevo queda en el
          tramo y es la base de las indexaciones siguientes.
        </p>
        {datos == null && !error && <p className="text-sm text-muted">Cargando los meses…</p>}
        {datos && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Importe mensual nuevo" requerido>
                <InputImporte moneda={c.moneda} value={importe} onChange={setImporte} autoFocus />
              </Campo>
              <Campo label="Desde qué mes" requerido>
                <select
                  className={inputClass}
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                >
                  {datos.desdeSugerido == null && <option value="">Elegí el mes…</option>}
                  {datos.meses.map((m) => (
                    <option key={m.periodo} value={m.periodo}>
                      {mes(m.periodo)} · {ESTADO_MES[m.estado]}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {datos.desdeSugerido == null && (
              <p role="status" className="text-sm text-warning">
                Todos los meses de este tramo ya se cobraron o se liquidaron: la corrección solo
                cambia la base de las indexaciones siguientes.
              </p>
            )}
            {resumen.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-brand border border-line bg-bg px-3 py-2 text-sm text-ink">
                {resumen.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            )}
            <Campo
              label="Motivo"
              requerido
              hint="Queda en el historial del contrato, con el importe anterior y quién lo corrigió."
            >
              <textarea
                className={textareaClass}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Campo>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={corregir}
            disabled={
              enviando ||
              !datos ||
              nuevo == null ||
              !(nuevo > 0) ||
              nuevo === datos.importe ||
              !desde ||
              motivo.trim().length < 3
            }
          >
            {actualizando ? 'Actualizando…' : enviando ? 'Corrigiendo…' : 'Corregir el importe'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
