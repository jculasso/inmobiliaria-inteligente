'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CobroResumenDto, CuentaCorrienteDto, LiquidacionResumenDto, PersonaDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularCobro, anularLiquidacion, generarLiquidacionPdf, generarRecibo } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { documentoLegible } from './personas-lista';
import { PersonaFormModal } from './persona-form-modal';

const recibo = (n: number) => String(n).padStart(6, '0');

/** «Debe $ X», «A favor $ X» o «Al día»: el saldo dicho como lo diría una persona. */
function Saldo({ saldo, moneda }: { saldo: number; moneda: 'ARS' | 'USD' }) {
  if (Math.abs(saldo) < 0.005) return <span className="text-success">Al día</span>;
  return saldo > 0 ? (
    <span className="text-brand-red">Debe {fmtMoneda(saldo, moneda)}</span>
  ) : (
    <span className="text-success">A favor {fmtMoneda(-saldo, moneda)}</span>
  );
}

/**
 * La cuenta corriente de una persona, por moneda (regla 18), con su estado de
 * cuenta: lo pendiente suma el saldo (regla 24). Los cobros traen su recibo y
 * se pueden anular (regla 19); lo anulado queda a la vista, tachado.
 */
export function CuentaCorriente({
  cuenta,
  persona,
  cobros,
  liquidaciones = [],
}: {
  cuenta: CuentaCorrienteDto;
  persona: PersonaDto | null;
  cobros: CobroResumenDto[];
  liquidaciones?: LiquidacionResumenDto[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState<{ titulo: string; detalle: string; anular: (motivo: string) => Promise<unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargar = (c: { id: string; numero: number }) =>
    abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), c.id), { titulo: `Recibo ${recibo(c.numero)}`, onError: setError });
  const descargarLiquidacion = (l: { id: string; numero: number }) =>
    abrirPdfEnPestana(async () => generarLiquidacionPdf(await getAccessToken(), l.id), { titulo: `Liquidación ${recibo(l.numero)}`, onError: setError });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            <Link href="/alquileres/personas" className="hover:underline">
              Personas
            </Link>{' '}
            /
          </p>
          <h2 className="mt-0.5 text-xl font-extrabold text-ink">{cuenta.persona.nombre}</h2>
          {persona && (
            <p className="text-sm text-muted">
              {[documentoLegible(persona.documento), persona.telefono, persona.email].filter((x) => x && x !== '—').join(' · ') || 'Sin datos de contacto'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {persona && (
            <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
              Editar datos
            </Button>
          )}
          <Link href={`/alquileres/liquidaciones/nueva?persona=${cuenta.persona.id}`}>
            <Button variant="secondary" size="sm">
              Liquidar
            </Button>
          </Link>
          <Link href={`/alquileres/cobros/nuevo?persona=${cuenta.persona.id}`}>
            <Button variant="primary" size="sm">
              Registrar cobro
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}

      {cuenta.monedas.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">Todavía no tiene movimientos.</p>
      ) : (
        cuenta.monedas.map((m) => (
          <section key={m.moneda} className="flex flex-col gap-3">
            <div className="rounded-brand border border-line bg-white px-4 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Saldo en {m.moneda === 'ARS' ? 'pesos' : 'dólares'}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">
                <Saldo saldo={m.saldo} moneda={m.moneda} />
              </p>
            </div>

            <div className="rounded-brand border border-line bg-white">
              <h3 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Pendiente · estado de cuenta</h3>
              {m.pendientes.length === 0 && m.aFavor.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted">Nada pendiente.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {m.pendientes.map((p) => (
                    <li key={p.conceptoId} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-ink">
                          {p.contrato ? `${p.contrato.codigo} · ` : ''}
                          {p.descripcion}
                        </span>
                        <span className="block text-xs text-muted">
                          {p.sentido === 'a_pagar' ? 'A su favor' : `Vence el ${fmtFecha(p.vencimiento)}`}
                          {p.saldo < p.importe ? ` · de ${fmtMoneda(p.importe, m.moneda)}` : ''}
                        </span>
                      </span>
                      <span className={`shrink-0 font-semibold tabular-nums ${p.sentido === 'a_pagar' ? 'text-success' : 'text-ink'}`}>
                        {p.sentido === 'a_pagar' ? '− ' : ''}
                        {fmtMoneda(p.saldo, m.moneda)}
                      </span>
                    </li>
                  ))}
                  {m.aFavor.map((c) => (
                    <li key={c.cobroId} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span className="text-ink">Sobrante del recibo {recibo(c.numero)}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-success">− {fmtMoneda(c.disponible, m.moneda)}</span>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-3 bg-surface/60 px-4 py-2.5 font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{fmtMoneda(m.saldo, m.moneda)}</span>
                  </li>
                </ul>
              )}
            </div>

            <div className="rounded-brand border border-line bg-white sm:overflow-x-auto">
              <h3 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Movimientos</h3>
              <table className="w-full text-sm">
                <thead className="hidden sm:table-header-group">
                  <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Detalle</th>
                    <th className="px-4 py-2 text-right">Debe</th>
                    <th className="px-4 py-2 text-right">Haber</th>
                    <th className="px-4 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {m.movimientos.map((x) => (
                    <tr key={x.id} className="border-b border-line align-top last:border-0">
                      <td className="hidden whitespace-nowrap px-4 py-2 tabular-nums text-muted sm:table-cell">{fmtFecha(x.fecha)}</td>
                      <td className={`px-3 py-2 sm:px-4 ${x.anulado ? 'text-muted line-through' : 'text-ink'}`}>
                        {x.contrato ? `${x.contrato.codigo} · ` : ''}
                        {x.descripcion}
                        <span className="block text-xs tabular-nums text-muted no-underline sm:hidden">
                          {fmtFecha(x.fecha)} · {x.debe ? 'debe' : 'haber'}{' '}
                          <span className="whitespace-nowrap">{fmtMoneda(x.debe || x.haber, m.moneda)}</span>
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2 text-right tabular-nums sm:table-cell">{x.debe ? fmtMoneda(x.debe, m.moneda) : ''}</td>
                      <td className="hidden whitespace-nowrap px-4 py-2 text-right tabular-nums sm:table-cell">{x.haber ? fmtMoneda(x.haber, m.moneda) : ''}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums sm:px-4">{fmtMoneda(x.saldo, m.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {cobros.length > 0 && (
        <section className="rounded-brand border border-line bg-white">
          <h3 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Recibos</h3>
          <ul className="divide-y divide-line text-sm">
            {cobros.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className={c.anulado ? 'text-muted line-through' : 'text-ink'}>
                  Recibo {recibo(c.numero)} · {fmtFecha(c.fecha)} · <span className="tabular-nums">{fmtMoneda(c.importe, c.moneda)}</span>
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => descargar(c)} className="text-xs font-semibold text-brand-red hover:underline">
                    Recibo
                  </button>
                  {!c.anulado && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnulando({
                          titulo: `Anular el recibo ${recibo(c.numero)}`,
                          detalle:
                            'Lo que este cobro canceló vuelve a quedar pendiente, y el punitorio que se cobró con él se anula. El recibo no se borra: queda tachado, con el motivo.',
                          anular: async (motivo) => anularCobro(await getAccessToken(), c.id, motivo),
                        })
                      }
                      className="text-xs font-semibold text-muted hover:text-brand-red"
                    >
                      Anular
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {liquidaciones.length > 0 && (
        <section className="rounded-brand border border-line bg-white">
          <h3 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Liquidaciones</h3>
          <ul className="divide-y divide-line text-sm">
            {liquidaciones.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className={l.anulado ? 'text-muted line-through' : 'text-ink'}>
                  Liquidación {recibo(l.numero)} · {fmtFecha(l.fecha)} · <span className="tabular-nums">{fmtMoneda(l.neto, l.moneda)}</span>
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => descargarLiquidacion(l)} className="text-xs font-semibold text-brand-red hover:underline">
                    PDF
                  </button>
                  {!l.anulado && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnulando({
                          titulo: `Anular la liquidación ${recibo(l.numero)}`,
                          detalle: 'Lo que incluía vuelve a quedar por liquidar. La liquidación no se borra: queda tachada, con el motivo.',
                          anular: async (motivo) => anularLiquidacion(await getAccessToken(), l.id, motivo),
                        })
                      }
                      className="text-xs font-semibold text-muted hover:text-brand-red"
                    >
                      Anular
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editando && persona && (
        <PersonaFormModal
          persona={persona}
          onClose={() => setEditando(false)}
          onSaved={() => {
            setEditando(false);
            router.refresh();
          }}
        />
      )}
      {anulando && (
        <AnularModal
          {...anulando}
          onClose={() => setAnulando(null)}
          onDone={() => {
            setAnulando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Regla 19: anular revierte el efecto y deja el documento tachado, con el motivo. */
function AnularModal({
  titulo,
  detalle,
  anular: ejecutar,
  onClose,
  onDone,
}: {
  titulo: string;
  detalle: string;
  anular: (motivo: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    setError(null);
    setEnviando(true);
    try {
      await ejecutar(motivo);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{detalle}</p>
        <Campo label="Motivo" requerido>
          <input className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
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
          <Button variant="primary" onClick={anular} disabled={enviando || motivo.trim().length < 3}>
            {enviando ? 'Anulando…' : 'Anular'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
