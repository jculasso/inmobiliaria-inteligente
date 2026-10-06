'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, recortarAlLimite, type CobroResumenDto } from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { anularCobro, generarRecibo } from '../../lib/alquileres-api';
import { AnularModal } from './anular-modal';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { paraBuscar } from './buscador';
import {
  BarraLista,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TD,
  CLASE_TD_FIJA,
  CLASE_TH,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  Insignia,
  Vacio,
} from './piezas';

const recibo = (n: number) => String(n).padStart(6, '0');
const MEDIO = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro' } as const;

/** Los últimos cobros, con su recibo. Cada uno lleva a la cuenta de quien pagó. */
export function CobrosLista({ cobros }: { cobros: CobroResumenDto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<CobroResumenDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(cobros);

  const filtrados = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((c) => [recibo(c.numero), c.persona.nombre, MEDIO[c.medio]].some((t) => paraBuscar(t).includes(q)));
  }, [visibles, busqueda]);

  const descargar = (c: CobroResumenDto) =>
    abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), c.id), { titulo: `Recibo ${recibo(c.numero)}`, onError: setError });
  const abrir = (c: CobroResumenDto) => router.push(`/alquileres/personas/${c.persona.id}`);
  const estado = (c: CobroResumenDto) => (c.anulado ? <Insignia tono="marca">Anulado</Insignia> : <Insignia tono="exito">Cobrado</Insignia>);
  const importe = (c: CobroResumenDto) => <span className={c.anulado ? 'text-muted line-through' : ''}>{fmtMoneda(c.importe, c.moneda)}</span>;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Cobros" />

      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por recibo o inquilino…"
        visibles={filtrados.length}
        total={visibles.length}
        nombre="cobros"
      >
        <BotonNuevo href="/alquileres/cobros/nuevo">Nuevo cobro</BotonNuevo>
      </BarraLista>

      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}
      {hayMas && <p className="text-sm text-muted">Se muestran los últimos {LIMITE_LISTA} cobros.</p>}

      {cobros.length === 0 ? (
        <Vacio>Todavía no se registró ningún cobro.</Vacio>
      ) : filtrados.length === 0 ? (
        <Vacio>Ningún cobro coincide con «{busqueda}».</Vacio>
      ) : (
        <>
          <div className={CLASE_LISTA_MOVIL}>
            <ListaTarjetas etiqueta="Cobros">
              {filtrados.map((c) => (
                <Tarjeta key={c.id}>
                  <button type="button" onClick={() => abrir(c)} className="block w-full text-left" title={`Abrir la cuenta de ${c.persona.nombre}`}>
                    <CabezaTarjeta titulo={c.persona.nombre} detalle={`Recibo ${recibo(c.numero)} · ${fmtFecha(c.fecha)}`} insignia={estado(c)} />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Importe">{importe(c)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Medio">{MEDIO[c.medio]}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Registró">{c.registradoPor ?? '—'}</CampoTarjeta>
                    </CamposTarjeta>
                  </button>
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-line pt-2">
                    <button type="button" onClick={() => descargar(c)} className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">
                      📄 Recibo
                    </button>
                    {!c.anulado && (
                      <button type="button" onClick={() => setAAnular(c)} className="rounded px-2 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/5">
                        🚫 Anular
                      </button>
                    )}
                  </div>
                </Tarjeta>
              ))}
            </ListaTarjetas>
          </div>
          <div className={CLASE_TABLA_ANCHA}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${CLASE_TH} left-0 z-30 border-r`}>Recibo</th>
                  <th className={CLASE_TH}>Fecha</th>
                  <th className={CLASE_TH}>Pagó</th>
                  <th className={CLASE_TH}>Medio</th>
                  <th className={`${CLASE_TH} text-right`}>Importe</th>
                  <th className={CLASE_TH}>Estado</th>
                  <th className={CLASE_TH}>Registró</th>
                  <th className={`${CLASE_TH} right-0 z-30 border-l`} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => abrir(c)} className={CLASE_TR_ABRIBLE}>
                    <td className={CLASE_TD_FIJA}>{recibo(c.numero)}</td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(c.fecha)}</td>
                    <td className={`${CLASE_TD} text-ink`}>{c.persona.nombre}</td>
                    <td className={`${CLASE_TD} text-muted`}>{MEDIO[c.medio]}</td>
                    <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{importe(c)}</td>
                    <td className={CLASE_TD}>{estado(c)}</td>
                    <td className={`${CLASE_TD} text-muted`}>{c.registradoPor ?? '—'}</td>
                    <td className="sticky right-0 border-l border-line bg-white px-2 py-2">
                      <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          descargar(c);
                        }}
                        aria-label={`Recibo ${recibo(c.numero)}`}
                        title="Abrir el recibo"
                        className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                      >
                        📄
                      </button>
                      {!c.anulado && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAAnular(c);
                          }}
                          aria-label={`Anular el recibo ${recibo(c.numero)}`}
                          title="Anular, con un motivo"
                          className="rounded px-1.5 py-0.5 text-base hover:bg-brand-red/5"
                        >
                          🚫
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {aAnular && (
        <AnularModal
          titulo={`Anular el recibo ${recibo(aAnular.numero)}`}
          detalle={`${aAnular.persona.nombre} · ${fmtMoneda(aAnular.importe, aAnular.moneda)}. Lo que este cobro canceló vuelve a quedar pendiente, y el punitorio que se cobró con él se anula. El recibo no se borra: queda tachado, con el motivo y quién lo anuló.`}
          anular={async (motivo) => anularCobro(await getAccessToken(), aAnular.id, motivo)}
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
