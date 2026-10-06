'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  CobroResumenDto,
  CuentaCorrienteDto,
  EventoDto,
  LiquidacionResumenDto,
  PersonaDto,
  PersonaFichaDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  anularCobro,
  anularLiquidacion,
  enviarLiquidacionPorMail,
  enviarReciboPorMail,
  generarLiquidacionPdf,
  generarRecibo,
} from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { documentoLegible } from './personas-lista';
import { PersonaFormModal } from './persona-form-modal';
import { Bloque, CLASE_FOCO, CLASE_TH, EncabezadoPagina, Vacio, VacioBloque } from './piezas';
import { AnularModal } from './anular-modal';
import { Historial } from './historial';
import { EnviarMailModal } from './enviar-mail-modal';
import { CuentasBancarias } from './cuentas-bancarias';
import { Contactos } from './contactos';
import {
  DatosPersonales,
  InformacionBasica,
  ResumenPersona,
  Solapas,
  type Solapa,
} from './ficha-persona';

const recibo = (n: number) => String(n).padStart(6, '0');
// Los botones de cada recibo y liquidación, con el mismo aspecto que los de las tarjetas (`AccionFila`).
const BOTON = `rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface ${CLASE_FOCO}`;
const BOTON_ANULAR = `rounded px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5 ${CLASE_FOCO}`;

/** «Debe $ X», «A favor $ X» o «Al día»: el saldo dicho como lo diría una persona. */
function Saldo({ saldo, moneda }: { saldo: number; moneda: 'ARS' | 'USD' }) {
  if (Math.abs(saldo) < 0.005) return <span className="text-success">Al día</span>;
  return saldo > 0 ? (
    <span className="text-danger">Debe {fmtMoneda(saldo, moneda)}</span>
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
  historial,
  ficha,
}: {
  cuenta: CuentaCorrienteDto;
  persona: PersonaDto | null;
  cobros: CobroResumenDto[];
  liquidaciones?: LiquidacionResumenDto[];
  historial?: EventoDto[];
  /** Con la ficha, la pantalla se arma con las solapas de «Clientes» de Gexion (punto 14). */
  ficha?: PersonaFichaDto;
}) {
  const router = useRouter();
  const [solapa, setSolapa] = useState<Solapa>('resumen');
  const [aEnviar, setAEnviar] = useState<{
    titulo: string;
    enviar: (para: string[]) => Promise<unknown>;
  } | null>(null);
  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState<{
    titulo: string;
    detalle: string;
    anular: (motivo: string) => Promise<unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargar = (c: { id: string; numero: number }) =>
    abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), c.id), {
      titulo: `Recibo ${recibo(c.numero)}`,
      onError: setError,
    });
  const descargarLiquidacion = (l: { id: string; numero: number }) =>
    abrirPdfEnPestana(async () => generarLiquidacionPdf(await getAccessToken(), l.id), {
      titulo: `Liquidación ${recibo(l.numero)}`,
      onError: setError,
    });

  // La cuenta corriente propiamente dicha: saldo, pendiente, movimientos,
  // recibos y liquidaciones. Con la ficha, es una de sus solapas.
  const cuentaCorriente = (
    <>
      {cuenta.monedas.length === 0 ? (
        <Vacio>Todavía no tiene movimientos.</Vacio>
      ) : (
        cuenta.monedas.map((m) => (
          <div key={m.moneda} className="flex flex-col gap-4">
            {/* El saldo, con la forma de las tarjetas del Tablero (`KpiCard`). */}
            <div
              className={`rounded-brand border border-line p-4 shadow-sm ${m.saldo > 0 ? 'bg-warning/5' : m.saldo < 0 ? 'bg-success/5' : 'bg-white'}`}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="text-base leading-none">
                  💰
                </span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Saldo en {m.moneda === 'ARS' ? 'pesos' : 'dólares'}
                </p>
              </div>
              <p className="mt-1.5 text-2xl font-extrabold tabular-nums">
                <Saldo saldo={m.saldo} moneda={m.moneda} />
              </p>
            </div>

            <Bloque icono="📋" titulo="Pendiente · estado de cuenta">
              {m.pendientes.length === 0 && m.aFavor.length === 0 ? (
                <VacioBloque>Nada pendiente.</VacioBloque>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {m.pendientes.map((p) => (
                    <li
                      key={p.conceptoId}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-ink">
                          {p.contrato ? `${p.contrato.codigo} · ` : ''}
                          {p.descripcion}
                        </span>
                        <span className="block text-xs text-muted">
                          {p.sentido === 'a_pagar'
                            ? 'A su favor'
                            : `Vence el ${fmtFecha(p.vencimiento)}`}
                          {p.saldo < p.importe ? ` · de ${fmtMoneda(p.importe, m.moneda)}` : ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${p.sentido === 'a_pagar' ? 'text-success' : 'text-ink'}`}
                      >
                        {p.sentido === 'a_pagar' ? '− ' : ''}
                        {fmtMoneda(p.saldo, m.moneda)}
                      </span>
                    </li>
                  ))}
                  {m.aFavor.map((c) => (
                    <li
                      key={c.cobroId}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="text-ink">Sobrante del recibo {recibo(c.numero)}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-success">
                        − {fmtMoneda(c.disponible, m.moneda)}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-3 bg-surface/60 px-4 py-2.5 font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{fmtMoneda(m.saldo, m.moneda)}</span>
                  </li>
                </ul>
              )}
            </Bloque>

            <Bloque icono="📒" titulo="Movimientos" detalle={`${m.movimientos.length}`}>
              <div className="max-h-[clamp(20rem,60vh,48rem)] overflow-y-auto overscroll-contain sm:overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="hidden sm:table-header-group">
                    <tr>
                      <th className={CLASE_TH}>Fecha</th>
                      <th className={CLASE_TH}>Detalle</th>
                      <th className={`${CLASE_TH} text-right`}>Debe</th>
                      <th className={`${CLASE_TH} text-right`}>Haber</th>
                      <th className={`${CLASE_TH} text-right`}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.movimientos.map((x) => (
                      <tr key={x.id} className="border-b border-line align-top last:border-0">
                        <td className="hidden whitespace-nowrap px-4 py-2 tabular-nums text-muted sm:table-cell">
                          {fmtFecha(x.fecha)}
                        </td>
                        <td
                          className={`px-3 py-2 sm:px-4 ${x.anulado ? 'text-muted line-through' : 'text-ink'}`}
                        >
                          {x.contrato ? `${x.contrato.codigo} · ` : ''}
                          {x.descripcion}
                          <span className="block text-xs tabular-nums text-muted no-underline sm:hidden">
                            {fmtFecha(x.fecha)} · {x.debe ? 'debe' : 'haber'}{' '}
                            <span className="whitespace-nowrap">
                              {fmtMoneda(x.debe || x.haber, m.moneda)}
                            </span>
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-2 text-right tabular-nums sm:table-cell">
                          {x.debe ? fmtMoneda(x.debe, m.moneda) : ''}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-2 text-right tabular-nums sm:table-cell">
                          {x.haber ? fmtMoneda(x.haber, m.moneda) : ''}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums sm:px-4">
                          {fmtMoneda(x.saldo, m.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Bloque>
          </div>
        ))
      )}

      {cobros.length > 0 && (
        <Bloque icono="🧾" titulo="Recibos">
          <ul className="divide-y divide-line text-sm">
            {cobros.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="min-w-0">
                  <span className={`block ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}>
                    Recibo {recibo(c.numero)} · {fmtFecha(c.fecha)} ·{' '}
                    <span className="tabular-nums">{fmtMoneda(c.importe, c.moneda)}</span>
                  </span>
                  {c.registradoPor && (
                    <span className="block text-xs text-muted">Registró {c.registradoPor}</span>
                  )}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => descargar(c)}
                    aria-label={`PDF del recibo ${recibo(c.numero)}`}
                    className={BOTON}
                  >
                    📄 PDF
                  </button>
                  {!c.anulado && (
                    <button
                      type="button"
                      onClick={() =>
                        setAEnviar({
                          titulo: `Enviar el recibo ${recibo(c.numero)} por mail`,
                          enviar: async (para) =>
                            enviarReciboPorMail(await getAccessToken(), c.id, para),
                        })
                      }
                      className={BOTON}
                    >
                      ✉️ Enviar por mail
                    </button>
                  )}
                  {!c.anulado && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnulando({
                          titulo: `Anular el recibo ${recibo(c.numero)}`,
                          detalle:
                            'Lo que este cobro canceló vuelve a quedar pendiente, y el punitorio que se cobró con él se anula. El recibo no se borra: queda tachado, con el motivo.',
                          anular: async (motivo) =>
                            anularCobro(await getAccessToken(), c.id, motivo),
                        })
                      }
                      className={BOTON_ANULAR}
                    >
                      🚫 Anular
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {liquidaciones.length > 0 && (
        <Bloque icono="📚" titulo="Liquidaciones">
          <ul className="divide-y divide-line text-sm">
            {liquidaciones.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="min-w-0">
                  <span className={`block ${l.anulado ? 'text-muted line-through' : 'text-ink'}`}>
                    Liquidación {recibo(l.numero)} · {fmtFecha(l.fecha)} ·{' '}
                    <span className="tabular-nums">{fmtMoneda(l.neto, l.moneda)}</span>
                  </span>
                  {l.registradoPor && (
                    <span className="block text-xs text-muted">Registró {l.registradoPor}</span>
                  )}
                  {l.contratos.length > 0 && (
                    <span className="block text-xs text-muted">
                      {l.contratos
                        .map(
                          (c) =>
                            `🏠 ${c.propiedad || c.codigo}${c.inquilinos.length ? ` (${c.inquilinos.join(', ')})` : ''}`,
                        )
                        .join(' · ')}
                    </span>
                  )}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => descargarLiquidacion(l)}
                    aria-label={`PDF de la liquidación ${recibo(l.numero)}`}
                    className={BOTON}
                  >
                    📄 PDF
                  </button>
                  {!l.anulado && (
                    <button
                      type="button"
                      onClick={() =>
                        setAEnviar({
                          titulo: `Enviar la liquidación ${recibo(l.numero)} por mail`,
                          enviar: async (para) =>
                            enviarLiquidacionPorMail(await getAccessToken(), l.id, para),
                        })
                      }
                      className={BOTON}
                    >
                      ✉️ Enviar por mail
                    </button>
                  )}
                  {!l.anulado && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnulando({
                          titulo: `Anular la liquidación ${recibo(l.numero)}`,
                          detalle:
                            'Lo que incluía vuelve a quedar por liquidar. La liquidación no se borra: queda tachada, con el motivo.',
                          anular: async (motivo) =>
                            anularLiquidacion(await getAccessToken(), l.id, motivo),
                        })
                      }
                      className={BOTON_ANULAR}
                    >
                      🚫 Anular
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Bloque>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo={cuenta.persona.nombre}
        volver={{ href: '/alquileres/personas', texto: 'Personas' }}
        detalle={
          persona && (
            <p className="text-sm text-muted">
              {[documentoLegible(persona.documento), persona.telefono, persona.email]
                .filter((x) => x && x !== '—')
                .join(' · ') || 'Sin datos de contacto'}
            </p>
          )
        }
      >
        {persona && (
          <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
            ✏️ Editar datos
          </Button>
        )}
        <Button asChild variant="secondary" size="sm">
          <Link href={`/alquileres/liquidaciones/nueva?persona=${cuenta.persona.id}`}>
            🧾 Liquidar
          </Link>
        </Button>
        <Button asChild variant="primary" size="sm">
          <Link href={`/alquileres/cobros/nuevo?persona=${cuenta.persona.id}`}>＋ Nuevo cobro</Link>
        </Button>
      </EncabezadoPagina>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {ficha ? (
        <>
          <Solapas actual={solapa} onCambiar={setSolapa} />
          {solapa === 'resumen' && (
            <ResumenPersona cuenta={cuenta} ficha={ficha} historial={historial ?? []} />
          )}
          {solapa === 'basica' && (
            <InformacionBasica persona={ficha.persona} onEditar={() => setEditando(true)} />
          )}
          {solapa === 'administrativa' && (
            <CuentasBancarias personaId={ficha.persona.id} cuentas={ficha.cuentas} />
          )}
          {solapa === 'complementarios' && (
            <>
              <DatosPersonales persona={ficha.persona} onEditar={() => setEditando(true)} />
              <Contactos personaId={ficha.persona.id} contactos={ficha.contactos} />
            </>
          )}
          {solapa === 'cuenta' && cuentaCorriente}
        </>
      ) : (
        <>
          {cuentaCorriente}
          {historial && <Historial eventos={historial} />}
        </>
      )}

      {/* Fuera de las solapas: «Editar» se toca desde cualquiera, no solo desde la cuenta. */}
      {editando && (ficha?.persona ?? persona) && (
        <PersonaFormModal
          persona={ficha?.persona ?? persona ?? undefined}
          onClose={() => setEditando(false)}
          onSaved={() => {
            setEditando(false);
            router.refresh();
          }}
        />
      )}

      {aEnviar && (
        <EnviarMailModal
          titulo={aEnviar.titulo}
          personaId={cuenta.persona.id}
          enviar={aEnviar.enviar}
          onClose={() => setAEnviar(null)}
          onEnviado={() => router.refresh()}
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
