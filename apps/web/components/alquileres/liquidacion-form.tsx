'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  agruparPorContrato,
  type ContratoDeLiquidacion,
  type LineaLiquidacion,
  type LiquidacionDto,
  type MedioCobro,
  type MonedaAlquiler,
  type CandidatoDto,
  type PreparacionLiquidacionDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarLiquidacionPdf, liquidar, prepararLiquidacion, enviarLiquidacionPorMail } from '../../lib/alquileres-api';
import { EnviarMailModal } from './enviar-mail-modal';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { EncabezadoPagina } from './piezas';
import { SelectorPersona } from './selector-persona';

const numero = (n: number) => String(n).padStart(6, '0');

/** «Inquilino: Ana» o «Inquilinos: Ana, Pedro». */
export function inquilinosDe(c: ContratoDeLiquidacion | null): { rotulo: string; nombres: string } {
  const xs = c?.inquilinos ?? [];
  return { rotulo: xs.length > 1 ? 'Inquilinos' : 'Inquilino', nombres: xs.join(', ') || '—' };
}

/**
 * La cabecera de cada propiedad: qué es, quién la alquila y de quién es
 * (pedido de Javier del 6/10/2026: «Inquilino, Propiedad, Propietario, todo
 * bien organizado»). La misma forma que en el PDF.
 */
export function FichaPropiedad({ contrato, propietario }: { contrato: ContratoDeLiquidacion | null; propietario: string }) {
  const inq = inquilinosDe(contrato);
  return (
    <div className="border-b border-line bg-surface/40 px-4 py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-bold text-ink">
          <span aria-hidden>🏠 </span>
          {contrato?.propiedad || 'Sin propiedad'}
        </span>
        {contrato && (
          <Link href={`/alquileres/contratos/${contrato.id}`} className="text-xs font-semibold text-muted hover:text-brand-red hover:underline">
            Contrato {contrato.codigo}
          </Link>
        )}
      </p>
      <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-muted">{inq.rotulo}:</dt>
          <dd className="min-w-0 font-semibold text-ink">{inq.nombres}</dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-muted">Propietario:</dt>
          <dd className="min-w-0 font-semibold text-ink">{propietario}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Arriba de todo: a quién se le liquida y de cuántas propiedades. El neto va abajo, junto al botón. */
function PanelResumen({ prep, grupos }: { prep: PreparacionLiquidacionDto; grupos: number }) {
  return (
    <dl className="grid grid-cols-[2fr_1fr] gap-3">
      <div className="min-w-0 rounded-brand border border-line bg-white p-4 shadow-sm">
        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">🧑‍💼 Propietario</dt>
        <dd className="mt-1 text-lg font-extrabold text-ink">{prep.persona.nombre}</dd>
      </div>
      <div className="rounded-brand border border-line bg-white p-4 shadow-sm">
        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">🏠 Propiedades</dt>
        <dd className="mt-1 text-lg font-extrabold tabular-nums text-ink">{grupos}</dd>
      </div>
    </dl>
  );
}

/**
 * Liquidar a un propietario (reglas 20 a 22). Lo que entra lo decide la API:
 * cada vez que se deja algo para después, se le vuelve a preguntar, porque
 * dejar un alquiler arrastra sus honorarios y eso lo sabe ella.
 */
export function LiquidacionForm({
  propietarios,
  personaInicial,
  hoy,
}: {
  /** A quién se le liquida: los propietarios, con lo que hay para liquidarles (punto 6 de Javier). */
  propietarios: CandidatoDto[];
  personaInicial: string | null;
  hoy: string;
}) {
  const [personaId, setPersonaId] = useState(personaInicial ?? '');
  const [moneda, setMoneda] = useState<MonedaAlquiler>('ARS');
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [prep, setPrep] = useState<PreparacionLiquidacionDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandando, setMandando] = useState(false);
  const [hecha, setHecha] = useState<LiquidacionDto | null>(null);

  useEffect(() => {
    if (!personaId) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const p = await prepararLiquidacion(await getAccessToken(), personaId, moneda, hoy, excluidos);
        if (vigente) setPrep(p);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo armar la liquidación.');
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [personaId, moneda, hoy, excluidos]);

  const alternar = (id: string) => setExcluidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  async function confirmar() {
    setError(null);
    setEnviando(true);
    try {
      setHecha(await liquidar(await getAccessToken(), { personaId, moneda, fecha: hoy, medio, excluidos }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo liquidar.');
    } finally {
      setEnviando(false);
    }
  }

  if (hecha) {
    return (
      <div className="flex flex-col gap-3 rounded-brand border border-success/30 bg-white p-5">
        <p role="status" className="text-lg font-extrabold text-ink">
          Liquidación {numero(hecha.numero)} · {fmtMoneda(hecha.neto, hecha.moneda)} a {hecha.persona.nombre}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => abrirPdfEnPestana(async () => generarLiquidacionPdf(await getAccessToken(), hecha.id), { titulo: `Liquidación ${numero(hecha.numero)}`, onError: setError })}
          >
            Descargar la liquidación
          </Button>
          <Button variant="secondary" onClick={() => setMandando(true)}>
            ✉️ Mandar por mail
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/alquileres/personas/${hecha.persona.id}`}>Ver la cuenta</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/alquileres/liquidaciones">Volver a la bandeja</Link>
          </Button>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-brand-red">{error}</p>}
        {mandando && (
          <EnviarMailModal
            titulo={`Mandar la liquidación ${numero(hecha.numero)}`}
            personaId={hecha.persona.id}
            enviar={async (para) => enviarLiquidacionPorMail(await getAccessToken(), hecha.id, para)}
            onClose={() => setMandando(false)}
          />
        )}
      </div>
    );
  }

  const Linea = ({ x, signo, enEspera = false }: { x: LineaLiquidacion; signo: string; enEspera?: boolean }) => (
    <li className="flex items-start gap-3 px-4 py-2">
      {enEspera ? (
        <span aria-hidden className="w-4 shrink-0" />
      ) : (
        <input
          type="checkbox"
          aria-label={`Liquidar ${x.descripcion}`}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
          checked={!excluidos.includes(x.conceptoId)}
          onChange={() => alternar(x.conceptoId)}
        />
      )}
      <span className={`min-w-0 flex-1 ${enEspera ? 'text-muted' : 'text-ink'}`}>{x.descripcion}</span>
      <span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${enEspera ? 'text-muted' : 'text-ink'}`}>
        {signo}
        {fmtMoneda(x.importe, moneda)}
      </span>
    </li>
  );
  const Rotulo = ({ children }: { children: React.ReactNode }) => (
    <li className="bg-surface/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{children}</li>
  );

  // Lo que se destildó sigue a la vista, para poder volver a tildarlo.
  const dejados = excluidos.length;
  const grupos = prep ? agruparPorContrato(prep) : [];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nueva liquidación" volver={{ href: '/alquileres/liquidaciones', texto: 'Liquidaciones' }} />
      <section className="grid gap-3 rounded-brand border border-line bg-white p-4 shadow-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SelectorPersona
            etiqueta="Propietario"
            opciones={propietarios}
            pendienteRotulo="para liquidar"
            value={personaId}
            onChange={(id) => {
              setPersonaId(id);
              setExcluidos([]);
            }}
          />
        </div>
        <Campo label="Moneda">
          <select className={inputClass} value={moneda} onChange={(e) => setMoneda(e.target.value as MonedaAlquiler)}>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        </Campo>
        <Campo label="Se le paga por">
          <select className={inputClass} value={medio} onChange={(e) => setMedio(e.target.value as MedioCobro)}>
            <option value="transferencia">Transferencia</option>
            <option value="cheque">Cheque</option>
            <option value="efectivo">Efectivo</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>
      </section>

      {cargando && <p className="text-sm text-muted">Armando la liquidación…</p>}

      {/* Mientras carga, nada: lo anterior estaba en la otra moneda. */}
      {prep && !cargando && (
        <>
          <PanelResumen prep={prep} grupos={grupos.length} />
          {grupos.length === 0 && <p className="text-sm text-muted">No tiene nada pendiente en {moneda === 'ARS' ? 'pesos' : 'dólares'}.</p>}
          {grupos.map((g) => (
            <section key={g.contrato?.id ?? 'otros'} className="overflow-hidden rounded-brand border border-line bg-white shadow-sm" aria-label={`Propiedad ${g.contrato?.propiedad ?? ''}`}>
              <FichaPropiedad contrato={g.contrato} propietario={prep.persona.nombre} />
              <ul className="divide-y divide-line text-sm">
                {g.aPagar.length > 0 && <Rotulo>💵 Cobrado a su favor</Rotulo>}
                {g.aPagar.map((x) => (
                  <Linea key={x.conceptoId} x={x} signo="" />
                ))}
                {g.aDescontar.length > 0 && <Rotulo>➖ Descuentos</Rotulo>}
                {g.aDescontar.map((x) => (
                  <Linea key={x.conceptoId} x={x} signo="− " />
                ))}
                {(g.aPagar.length > 0 || g.aDescontar.length > 0) && (
                  <li className="flex items-baseline justify-between gap-3 bg-surface/60 px-4 py-2.5 font-bold">
                    <span>Subtotal de la propiedad</span>
                    <span className="whitespace-nowrap tabular-nums">{fmtMoneda(g.subtotal, moneda)}</span>
                  </li>
                )}
                {/* Después del subtotal: lo que espera no suma. */}
                {g.enEspera.length > 0 && <Rotulo>⏳ En espera: el inquilino todavía no pagó</Rotulo>}
                {g.enEspera.map((x) => (
                  <Linea key={x.conceptoId} x={x} signo="" enEspera />
                ))}
              </ul>
            </section>
          ))}
          {dejados > 0 && (
            <p className="text-sm text-muted">
              {dejados === 1 ? 'Un concepto queda' : `${dejados} conceptos quedan`} para la próxima liquidación.{' '}
              <button type="button" className="font-semibold text-brand-red hover:underline" onClick={() => setExcluidos([])}>
                Volver a incluir todo
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-brand border border-line bg-white px-4 py-3 shadow-sm">
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">💰 Neto a pagar</span>
              <span className={`text-2xl font-extrabold tabular-nums ${prep.neto < 0 ? 'text-brand-red' : 'text-ink'}`}>{fmtMoneda(prep.neto, moneda)}</span>
            </span>
            <Button variant="primary" onClick={confirmar} disabled={enviando || prep.aPagar.length === 0 || prep.neto < 0}>
              {enviando ? 'Liquidando…' : 'Liquidar'}
            </Button>
          </div>
          {prep.neto < 0 && <p className="text-sm text-brand-red">Lo que se descuenta supera lo que se le paga: destildá algún descuento para la próxima.</p>}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}
