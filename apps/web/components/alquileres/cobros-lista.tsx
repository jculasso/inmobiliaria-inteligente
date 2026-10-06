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
import { NOMBRE_MEDIO } from './medios';
import {
  AccionesFila,
  AccionFila,
  BarraLista,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_FOCO,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TD_FIJA,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  Insignia,
  LinkFila,
  Vacio,
} from './piezas';

const recibo = (n: number) => String(n).padStart(6, '0');

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
    return visibles.filter((c) => [recibo(c.numero), c.persona.nombre, NOMBRE_MEDIO[c.medio]].some((t) => paraBuscar(t).includes(q)));
  }, [visibles, busqueda]);

  const descargar = (c: CobroResumenDto) =>
    abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), c.id), { titulo: `Recibo ${recibo(c.numero)}`, onError: setError });
  const abrir = (c: CobroResumenDto) => router.push(`/alquileres/personas/${c.persona.id}`);
  const estado = (c: CobroResumenDto) => (c.anulado ? <Insignia tono="neutro">Anulado</Insignia> : <Insignia tono="exito">Cobrado</Insignia>);
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
        <p role="alert" className="text-sm font-medium text-danger">
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
                  <button type="button" onClick={() => abrir(c)} className={`block w-full rounded text-left ${CLASE_FOCO}`} title={`Abrir la cuenta de ${c.persona.nombre}`}>
                    <CabezaTarjeta titulo={c.persona.nombre} detalle={`Recibo ${recibo(c.numero)} · ${fmtFecha(c.fecha)}`} insignia={estado(c)} />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Importe">{importe(c)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Medio">{NOMBRE_MEDIO[c.medio]}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Registró">{c.registradoPor ?? '—'}</CampoTarjeta>
                    </CamposTarjeta>
                  </button>
                  <AccionesFila
                    tarjeta
                    nombre={`el recibo ${recibo(c.numero)}`}
                    extra={<AccionFila tarjeta icono="📄" texto="PDF" etiqueta={`PDF del recibo ${recibo(c.numero)}`} onClick={() => descargar(c)} />}
                    onBorrar={c.anulado ? undefined : () => setAAnular(c)}
                    anula
                  />
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
                  <th className={CLASE_TH_ACCIONES} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => abrir(c)} className={CLASE_TR_ABRIBLE}>
                    <td className={CLASE_TD_FIJA}>
                      <LinkFila href={`/alquileres/personas/${c.persona.id}`} etiqueta={`Recibo ${recibo(c.numero)}: abrir la cuenta de ${c.persona.nombre}`}>
                        {recibo(c.numero)}
                      </LinkFila>
                    </td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(c.fecha)}</td>
                    <td className={`${CLASE_TD} text-ink`}>{c.persona.nombre}</td>
                    <td className={`${CLASE_TD} text-muted`}>{NOMBRE_MEDIO[c.medio]}</td>
                    <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{importe(c)}</td>
                    <td className={CLASE_TD}>{estado(c)}</td>
                    <td className={`${CLASE_TD} text-muted`}>{c.registradoPor ?? '—'}</td>
                    <td className={CLASE_TD_ACCIONES}>
                      <AccionesFila
                        nombre={`el recibo ${recibo(c.numero)}`}
                        extra={<AccionFila icono="📄" texto="PDF" etiqueta={`PDF del recibo ${recibo(c.numero)}`} title="Abrir el recibo" onClick={() => descargar(c)} />}
                        onBorrar={c.anulado ? undefined : () => setAAnular(c)}
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
