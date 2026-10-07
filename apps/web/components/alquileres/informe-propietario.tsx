'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nombreDelRango } from '@vacker/domain';
import {
  NOMBRE_CATEGORIA_PARTIDA,
  NOMBRE_ESTADO_RECLAMO,
  estadoDePartida,
  queSeDescuentaEnLaProxima,
  renglonesDeLaCadena,
  type CategoriaPartida,
  type InformePropietarioDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import {
  enviarInformePropietarioPorMail,
  generarInformePropietarioPdf,
  getInformePropietario,
} from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda, nroDocumento } from '../../lib/format';
import { NOMBRES_MES } from '../../lib/meses';
import {
  mesInformePorDefecto,
  parametrosDelInforme,
  rangoDelPeriodo,
  type PeriodoInforme,
} from '../../lib/periodo-tablero';
import { getAccessToken } from '../../lib/supabase/client';
import { EnviarMailModal } from './enviar-mail-modal';
import { NOMBRE_MEDIO } from './medios';
import { Bloque, CLASE_FOCO, Insignia, Vacio, VacioBloque } from './piezas';
import { FiltroAnio, FiltroPeriodo } from './selector-periodo';

const CATEGORIAS = Object.keys(NOMBRE_CATEGORIA_PARTIDA) as CategoriaPartida[];
const mesDe = (p: string) => `${NOMBRES_MES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const liq = (l: { numero: number; fecha: string }) =>
  `Liquidación ${nroDocumento(l.numero)} del ${fmtFecha(l.fecha)}`;

/** Un renglón de la lista: lo que es a la izquierda, el importe a la derecha. */
function Renglon({
  children,
  importe,
  fuerte = false,
  detalle,
}: {
  children: React.ReactNode;
  importe: string;
  fuerte?: boolean;
  detalle?: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-baseline justify-between gap-3 px-4 py-2.5 ${fuerte ? 'bg-surface/60 font-bold' : ''}`}
    >
      <span className="min-w-0">
        <span className="block text-ink">{children}</span>
        {detalle && <span className="block text-xs text-muted">{detalle}</span>}
      </span>
      <span className="shrink-0 tabular-nums text-ink">{importe}</span>
    </li>
  );
}

/**
 * La solapa «Informe» de la ficha de un propietario (reglas 83 a 95, Javier,
 * 7/10/2026): lo que cobró, lo que se le descontó, lo que se le liquidó y los
 * reclamos de sus propiedades en el período elegido, con el mismo selector del
 * Dashboard. Abre en el mes anterior, que ya cerró. Desde acá se descarga el
 * PDF y se le manda por mail —de a uno: no hay envío masivo—.
 *
 * Cambiar de período le pide el informe a la API: los números son de la
 * misma cuenta que la liquidación, no se rehacen acá.
 */
export function InformePropietario({
  personaId,
  hoy,
  inicial,
}: {
  personaId: string;
  hoy: string;
  inicial: PeriodoInforme;
}) {
  const pathname = usePathname();
  const [elegido, setElegido] = useState<PeriodoInforme>(inicial);
  const [informe, setInforme] = useState<InformePropietarioDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mandando, setMandando] = useState(false);
  const rango = rangoDelPeriodo(elegido.periodo, elegido.anio);
  const periodo = nombreDelRango(rango.desde, rango.hasta);

  useEffect(() => {
    let vigente = true;
    setError(null);
    (async () => {
      try {
        const i = await getInformePropietario(await getAccessToken(), personaId, rango);
        if (vigente) setInforme(i);
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'No se pudo armar el informe.');
      }
    })();
    return () => {
      vigente = false;
    };
    // El rango sale del período elegido: con eso alcanza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, rango.desde, rango.hasta]);

  const elegir = (nuevo: PeriodoInforme) => {
    setElegido(nuevo);
    // La dirección acompaña: recargar o compartir abre la misma solapa y el mismo período.
    const q = new URLSearchParams([['solapa', 'informe'], ...parametrosDelInforme(nuevo, hoy)]);
    window.history.replaceState(null, '', `${pathname}?${q}`);
  };

  const cargando = !informe || informe.desde !== rango.desde || informe.hasta !== rango.hasta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FiltroPeriodo
            periodo={elegido.periodo}
            porDefecto={mesInformePorDefecto(hoy, elegido.anio).mes}
            cambiar={(p) => elegir({ ...elegido, periodo: p })}
          />
          <FiltroAnio
            hoy={hoy}
            anio={elegido.anio}
            cambiar={(anio) => elegir({ ...elegido, anio })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={cargando}
            onClick={() =>
              abrirPdfEnPestana(
                async () => generarInformePropietarioPdf(await getAccessToken(), personaId, rango),
                { titulo: `Informe de ${periodo}`, onError: setError },
              )
            }
          >
            📄 Descargar PDF
          </Button>
          <Button variant="primary" size="sm" disabled={cargando} onClick={() => setMandando(true)}>
            ✉️ Mandar por mail
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {cargando ? (
        !error && (
          <p role="status" className="text-sm text-muted">
            Armando el informe de {periodo}…
          </p>
        )
      ) : (
        <InformeVista informe={informe} />
      )}

      {mandando && informe && (
        <EnviarMailModal
          titulo={`Mandar el informe de ${periodo}`}
          personaId={personaId}
          enviar={async (para) =>
            enviarInformePropietarioPorMail(await getAccessToken(), personaId, rango, para)
          }
          onClose={() => setMandando(false)}
        />
      )}
    </div>
  );
}

/**
 * Lo que se lee del informe, sin el selector ni los botones. Sin movimientos
 * en el período (regla 94) dice eso en vez de una cadena en cero, y sigue
 * mostrando sus contratos.
 */
export function InformeVista({ informe }: { informe: InformePropietarioDto }) {
  const periodo = nombreDelRango(informe.desde, informe.hasta);
  const vacio = informe.resumen.length === 0 && informe.reclamos.length === 0;
  return (
    <>
      <p className="text-xs text-muted">
        Informe de <strong className="text-ink">{periodo}</strong>. Lo cobrado y lo liquidado se
        cuentan hasta hoy, {fmtFecha(informe.hoy)}.
      </p>
      {vacio ? <Vacio>Sin movimientos en {periodo}.</Vacio> : <Resumen informe={informe} />}
      <Propiedades informe={informe} />
      {!vacio && (
        <>
          <Descuentos informe={informe} />
          <Mantenimiento informe={informe} />
          <Liquidaciones informe={informe} />
        </>
      )}
    </>
  );
}

/** Regla 87: la cadena de cada moneda, y lo que deben hoy sus inquilinos (regla 89). */
function Resumen({ informe }: { informe: InformePropietarioDto }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {informe.resumen.map((c) => (
          <Bloque
            key={c.moneda}
            icono="📊"
            titulo={`Resumen${informe.resumen.length > 1 ? ` en ${c.moneda === 'ARS' ? 'pesos' : 'dólares'}` : ''}`}
          >
            <ul aria-label={`Resumen en ${c.moneda}`} className="divide-y divide-line text-sm">
              {renglonesDeLaCadena(c, queSeDescuentaEnLaProxima(informe.partidas, c.moneda)).map(
                (r) => (
                  <Renglon
                    key={r.nombre}
                    importe={fmtMoneda(r.importe, c.moneda)}
                    fuerte={r.fuerte}
                    detalle={r.detalle}
                  >
                    {r.nombre}
                  </Renglon>
                ),
              )}
            </ul>
          </Bloque>
        ))}
      </div>
      {informe.deuda.map((d) => (
        <p
          key={d.moneda}
          role="note"
          className="rounded-brand border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-ink"
        >
          <strong className="text-danger">
            El inquilino debe hoy {fmtMoneda(d.total, d.moneda)}
          </strong>
          , ya vencido:{' '}
          {d.contratos
            .map((x) => `${x.inquilino} (${x.codigo}) ${fmtMoneda(x.importe, d.moneda)}`)
            .join(' · ')}
          .
        </p>
      ))}
    </>
  );
}

/** Regla 90: cada contrato, con lo que lo identifica y su mes a mes. */
function Propiedades({ informe }: { informe: InformePropietarioDto }) {
  return (
    <section className="flex flex-col gap-3">
      {informe.contratos.map((c) => (
        <Bloque key={c.id} icono="🏠" titulo={c.propiedad} detalle={`Contrato ${c.codigo}`}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm sm:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                {c.inquilinos.length > 1 ? 'Inquilinos' : 'Inquilino'}
              </dt>
              <dd className="break-words text-ink">{c.inquilinos.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                Alquiler vigente
              </dt>
              <dd className="tabular-nums text-ink">
                {c.alquilerVigente != null ? fmtMoneda(c.alquilerVigente, c.moneda) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                Próxima indexación
              </dt>
              <dd className="tabular-nums text-ink">
                {c.proximaIndexacion ? fmtFecha(c.proximaIndexacion) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                Vence
              </dt>
              <dd className="tabular-nums text-ink">{fmtFecha(c.vence)}</dd>
            </div>
            {c.porcentaje != null && (
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                  Su parte
                </dt>
                <dd className="tabular-nums text-ink">{c.porcentaje}%</dd>
              </div>
            )}
          </dl>
          {c.meses.length === 0 ? (
            <VacioBloque>Sin alquileres generados en el período.</VacioBloque>
          ) : (
            <ul aria-label={`Meses de ${c.codigo}`} className="divide-y divide-line text-sm">
              {c.meses.map((m) => (
                <Renglon
                  key={m.periodo}
                  importe={fmtMoneda(m.alquiler, c.moneda)}
                  detalle={[
                    m.cobradoEl.length
                      ? `Cobrado ${fmtMoneda(m.cobrado, c.moneda)} el ${m.cobradoEl.map(fmtFecha).join(', ')}`
                      : null,
                    m.enEspera
                      ? `El inquilino todavía debe ${fmtMoneda(m.enEspera, c.moneda)}`
                      : null,
                    m.liquidaciones.length
                      ? `Liquidado en la ${m.liquidaciones.map(liq).join(', ')}`
                      : m.cobrado
                        ? 'Va en la próxima liquidación'
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  Alquiler de {mesDe(m.periodo).toLowerCase()}
                </Renglon>
              ))}
            </ul>
          )}
        </Bloque>
      ))}
    </section>
  );
}

/** Regla 91: cada descuento con su nombre, agrupado, y si ya se descontó. */
function Descuentos({ informe }: { informe: InformePropietarioDto }) {
  const grupos = CATEGORIAS.filter((cat) => informe.partidas.some((p) => p.categoria === cat));
  return (
    <Bloque icono="🧾" titulo="Descuentos detallados">
      {grupos.length === 0 ? (
        <VacioBloque>No se le descontó nada en el período.</VacioBloque>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {grupos.map((cat) => (
            <li key={cat}>
              <p className="bg-surface/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                {NOMBRE_CATEGORIA_PARTIDA[cat]}
              </p>
              <ul aria-label={NOMBRE_CATEGORIA_PARTIDA[cat]} className="divide-y divide-line">
                {informe.partidas
                  .filter((p) => p.categoria === cat)
                  .map((p) => (
                    <Renglon
                      key={p.conceptoId}
                      importe={fmtMoneda(p.importe, p.moneda)}
                      detalle={`${p.detalle !== p.nombre ? `${p.detalle} · ` : ''}${p.contrato.codigo} · ${estadoDePartida(p)}`}
                    >
                      {p.nombre}
                    </Renglon>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

const TONO_RECLAMO = { abierto: 'peligro', en_curso: 'aviso', resuelto: 'exito' } as const;

/** Regla 92: los reclamos, sin notas internas; el importe, solo si fue a cargo del propietario. */
function Mantenimiento({ informe }: { informe: InformePropietarioDto }) {
  return (
    <Bloque icono="🛠️" titulo="Mantenimiento" detalle={`${informe.reclamos.length}`}>
      {informe.reclamos.length === 0 ? (
        <VacioBloque>Sin reclamos en el período.</VacioBloque>
      ) : (
        <ul aria-label="Reclamos" className="divide-y divide-line text-sm">
          {informe.reclamos.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <Link
                  href={`/alquileres/reclamos/${r.id}`}
                  className={`block rounded font-semibold text-ink hover:underline ${CLASE_FOCO}`}
                >
                  Reclamo {r.numero} · {r.asunto}
                </Link>
                <span className="block text-xs text-muted">
                  {[fmtFecha(r.fecha), r.propiedad, r.proveedor ?? 'Sin proveedor']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Insignia tono={TONO_RECLAMO[r.estado]}>{NOMBRE_ESTADO_RECLAMO[r.estado]}</Insignia>
                {r.aCargoDelPropietario.length > 0 && (
                  <span className="tabular-nums text-ink">
                    {r.aCargoDelPropietario.map((x) => fmtMoneda(x.importe, x.moneda)).join(' + ')}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

/** Regla 93: las liquidaciones que le pagaron algo del período. */
function Liquidaciones({ informe }: { informe: InformePropietarioDto }) {
  return (
    <Bloque icono="💸" titulo="Liquidaciones">
      {informe.liquidaciones.length === 0 ? (
        <VacioBloque>Todavía no se le liquidó nada de este período.</VacioBloque>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {informe.liquidaciones.map((l) => (
            <Renglon
              key={l.id}
              importe={fmtMoneda(l.delPeriodo, l.moneda)}
              detalle={`${NOMBRE_MEDIO[l.medio]} · neto de la liquidación ${fmtMoneda(l.neto, l.moneda)}`}
            >
              {liq(l)}
            </Renglon>
          ))}
        </ul>
      )}
    </Bloque>
  );
}
