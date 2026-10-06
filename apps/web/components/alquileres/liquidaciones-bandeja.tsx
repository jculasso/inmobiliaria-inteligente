'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContratoDeLiquidacion, LiquidacionResumenDto, PendienteLiquidarDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularLiquidacion, generarLiquidacionPdf } from '../../lib/alquileres-api';
import { AnularModal } from './anular-modal';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import {
  AccionesFila,
  AccionFila,
  Bloque,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_FOCO,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TD_FIJA,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  Insignia,
  LinkFila,
  VacioBloque,
} from './piezas';

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
  const [aAnular, setAAnular] = useState<LiquidacionResumenDto | null>(null);
  const listos = pendientes.filter((p) => p.neto > 0);
  const soloEspera = pendientes.filter((p) => p.neto <= 0);
  const pdf = (l: LiquidacionResumenDto) =>
    abrirPdfEnPestana(async () => generarLiquidacionPdf(await getAccessToken(), l.id), { titulo: `Liquidación ${numero(l.numero)}`, onError: setError });
  const abrir = (l: LiquidacionResumenDto) => router.push(`/alquileres/personas/${l.persona.id}`);
  const estado = (l: LiquidacionResumenDto) => (l.anulado ? <Insignia tono="neutro">Anulada</Insignia> : <Insignia tono="exito">Pagada</Insignia>);
  const neto = (l: LiquidacionResumenDto) => <span className={l.anulado ? 'text-muted line-through' : ''}>{fmtMoneda(l.neto, l.moneda)}</span>;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Liquidaciones">
        <BotonNuevo href="/alquileres/liquidaciones/nueva" icono="🧾">
          Liquidar
        </BotonNuevo>
      </EncabezadoPagina>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <Bloque icono="🧾" titulo="Para liquidar" detalle={`${listos.length} ${listos.length === 1 ? 'propietario' : 'propietarios'}`}>
        {listos.length === 0 ? (
          <VacioBloque>Ningún propietario tiene alquileres cobrados sin liquidar.</VacioBloque>
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
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/alquileres/liquidaciones/nueva?persona=${p.persona.id}`} aria-label={`Liquidar a ${p.persona.nombre}`}>
                      🧾 Liquidar
                    </Link>
                  </Button>
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
          <VacioBloque>Todavía no se liquidó a nadie.</VacioBloque>
        ) : (
          <>
            <div className="sm:hidden">
              <ListaTarjetas etiqueta="Liquidaciones">
                {liquidaciones.map((l) => (
                  <Tarjeta key={l.id}>
                    <button type="button" onClick={() => abrir(l)} className={`block w-full rounded text-left ${CLASE_FOCO}`} title={`Abrir la cuenta de ${l.persona.nombre}`}>
                      <CabezaTarjeta titulo={l.persona.nombre} detalle={`N.º ${numero(l.numero)} · ${fmtFecha(l.fecha)}`} insignia={estado(l)} />
                      <Propiedades contratos={l.contratos} />
                      <CamposTarjeta>
                        <CampoTarjeta etiqueta="Neto">{neto(l)}</CampoTarjeta>
                        <CampoTarjeta etiqueta="Registró">{l.registradoPor ?? '—'}</CampoTarjeta>
                      </CamposTarjeta>
                    </button>
                    <AccionesFila
                      tarjeta
                      nombre={`la liquidación ${numero(l.numero)}`}
                      extra={<AccionFila tarjeta icono="📄" texto="PDF" etiqueta={`PDF de la liquidación ${numero(l.numero)}`} onClick={() => pdf(l)} />}
                      onBorrar={l.anulado ? undefined : () => setAAnular(l)}
                      anula
                    />
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
                    <th className={CLASE_TH}>Registró</th>
                    <th className={CLASE_TH_ACCIONES} />
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map((l) => (
                    <tr key={l.id} onClick={() => abrir(l)} className={CLASE_TR_ABRIBLE}>
                      <td className={CLASE_TD_FIJA}>
                        <LinkFila href={`/alquileres/personas/${l.persona.id}`} etiqueta={`Liquidación ${numero(l.numero)}: abrir la cuenta de ${l.persona.nombre}`}>
                          {numero(l.numero)}
                        </LinkFila>
                      </td>
                      <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(l.fecha)}</td>
                      <td className={`${CLASE_TD} text-ink`}>{l.persona.nombre}</td>
                      <td className="px-3 py-1">
                        {l.contratos.length === 0 ? <span className="text-muted">—</span> : <Propiedades contratos={l.contratos} />}
                      </td>
                      <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{neto(l)}</td>
                      <td className={CLASE_TD}>{estado(l)}</td>
                      <td className={`${CLASE_TD} text-muted`}>{l.registradoPor ?? '—'}</td>
                      <td className={CLASE_TD_ACCIONES}>
                        <AccionesFila
                          nombre={`la liquidación ${numero(l.numero)}`}
                          extra={<AccionFila icono="📄" texto="PDF" etiqueta={`PDF de la liquidación ${numero(l.numero)}`} title="Abrir el PDF" onClick={() => pdf(l)} />}
                          onBorrar={l.anulado ? undefined : () => setAAnular(l)}
                          anula
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Bloque>
      {aAnular && (
        <AnularModal
          titulo={`Anular la liquidación ${numero(aAnular.numero)}`}
          detalle={`${aAnular.persona.nombre} · ${fmtMoneda(aAnular.neto, aAnular.moneda)}. Lo que incluía vuelve a quedar por liquidar. La liquidación no se borra: queda tachada, con el motivo y quién la anuló.`}
          anular={async (motivo) => anularLiquidacion(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={() => {
            setAAnular(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
