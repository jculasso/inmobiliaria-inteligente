'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContratoDeLiquidacion, LiquidacionResumenDto, PendienteLiquidarDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarLiquidacionPdf } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { Bloque, BotonNuevo, CabezaTarjeta, CLASE_TD, CLASE_TD_FIJA, CLASE_TH, CLASE_TR_ABRIBLE, EncabezadoPagina, Insignia } from './piezas';

const numero = (n: number) => String(n).padStart(6, '0');

/** Cada propiedad en su renglón: «🏠 Córdoba 1452 3° B · Inquilino: Ana». */
function Propiedades({ contratos }: { contratos: ContratoDeLiquidacion[] }) {
  if (contratos.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
      {contratos.map((c) => (
        <li key={c.id} className="min-w-0">
          <span aria-hidden>🏠 </span>
          <span className="font-semibold text-ink">{c.propiedad || c.codigo}</span>
          {c.inquilinos.length > 0 && (
            <>
              {' · '}
              {c.inquilinos.length > 1 ? 'Inquilinos' : 'Inquilino'}: {c.inquilinos.join(', ')}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A quién hay que liquidar hoy, y las últimas liquidaciones (reglas 20 a 23).
 * Lo que espera a que pague el inquilino se muestra aparte: no es una deuda de
 * la inmobiliaria todavía.
 */
export function LiquidacionesBandeja({ pendientes, liquidaciones }: { pendientes: PendienteLiquidarDto[]; liquidaciones: LiquidacionResumenDto[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const listos = pendientes.filter((p) => p.neto > 0);
  const soloEspera = pendientes.filter((p) => p.neto <= 0);
  const pdf = (l: LiquidacionResumenDto) =>
    abrirPdfEnPestana(async () => generarLiquidacionPdf(await getAccessToken(), l.id), { titulo: `Liquidación ${numero(l.numero)}`, onError: setError });
  const abrir = (l: LiquidacionResumenDto) => router.push(`/alquileres/personas/${l.persona.id}`);
  const estado = (l: LiquidacionResumenDto) => (l.anulado ? <Insignia tono="marca">Anulada</Insignia> : <Insignia tono="exito">Pagada</Insignia>);
  const neto = (l: LiquidacionResumenDto) => <span className={l.anulado ? 'text-muted line-through' : ''}>{fmtMoneda(l.neto, l.moneda)}</span>;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Liquidaciones">
        <BotonNuevo href="/alquileres/liquidaciones/nueva">Liquidar</BotonNuevo>
      </EncabezadoPagina>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}

      <Bloque icono="🧾" titulo="Para liquidar" detalle={`${listos.length} ${listos.length === 1 ? 'propietario' : 'propietarios'}`}>
        {listos.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Ningún propietario tiene alquileres cobrados sin liquidar.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {listos.map((p) => (
              <li key={`${p.persona.id}-${p.moneda}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    <span className="font-normal text-muted">Propietario: </span>
                    {p.persona.nombre}
                  </span>
                  <Propiedades contratos={p.contratos} />
                  {p.enEspera > 0 && <span className="mt-1 block text-xs text-muted">⏳ Además espera {fmtMoneda(p.enEspera, p.moneda)} de inquilinos que no pagaron</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="whitespace-nowrap font-bold tabular-nums text-ink">{fmtMoneda(p.neto, p.moneda)}</span>
                  <Link href={`/alquileres/liquidaciones/nueva?persona=${p.persona.id}`}>
                    <Button variant="secondary" size="sm">
                      Liquidar
                    </Button>
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        {soloEspera.length > 0 && (
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
            ⏳ En espera, sin nada cobrado todavía: {soloEspera.map((p) => `${p.persona.nombre} (${fmtMoneda(p.enEspera, p.moneda)})`).join(', ')}.
          </p>
        )}
      </Bloque>

      <Bloque icono="📚" titulo="Últimas liquidaciones">
        {liquidaciones.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Todavía no se liquidó a nadie.</p>
        ) : (
          <>
            <div className="sm:hidden">
              <ListaTarjetas etiqueta="Liquidaciones">
                {liquidaciones.map((l) => (
                  <Tarjeta key={l.id}>
                    <button type="button" onClick={() => abrir(l)} className="block w-full text-left" title={`Abrir la cuenta de ${l.persona.nombre}`}>
                      <CabezaTarjeta titulo={l.persona.nombre} detalle={`N.º ${numero(l.numero)} · ${fmtFecha(l.fecha)}`} insignia={estado(l)} />
                      <Propiedades contratos={l.contratos} />
                      <CamposTarjeta>
                        <CampoTarjeta etiqueta="Neto">{neto(l)}</CampoTarjeta>
                      </CamposTarjeta>
                    </button>
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-line pt-2">
                      <button type="button" onClick={() => pdf(l)} className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">
                        📄 PDF
                      </button>
                    </div>
                  </Tarjeta>
                ))}
              </ListaTarjetas>
            </div>
            <div className="hidden max-h-[clamp(20rem,60vh,48rem)] overflow-auto overscroll-contain sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={`${CLASE_TH} left-0 z-30 border-r`}>Número</th>
                    <th className={CLASE_TH}>Fecha</th>
                    <th className={CLASE_TH}>Propietario</th>
                    <th className={CLASE_TH}>Propiedades e inquilinos</th>
                    <th className={`${CLASE_TH} text-right`}>Neto</th>
                    <th className={CLASE_TH}>Estado</th>
                    <th className={`${CLASE_TH} right-0 z-30 border-l`} />
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map((l) => (
                    <tr key={l.id} onClick={() => abrir(l)} className={CLASE_TR_ABRIBLE}>
                      <td className={CLASE_TD_FIJA}>{numero(l.numero)}</td>
                      <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(l.fecha)}</td>
                      <td className={`${CLASE_TD} text-ink`}>{l.persona.nombre}</td>
                      <td className="px-3 py-1">
                        {l.contratos.length === 0 ? <span className="text-muted">—</span> : <Propiedades contratos={l.contratos} />}
                      </td>
                      <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{neto(l)}</td>
                      <td className={CLASE_TD}>{estado(l)}</td>
                      <td className="sticky right-0 border-l border-line bg-white px-2 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pdf(l);
                          }}
                          aria-label={`PDF de la liquidación ${numero(l.numero)}`}
                          title="Abrir el PDF"
                          className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                        >
                          📄
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Bloque>
    </div>
  );
}
