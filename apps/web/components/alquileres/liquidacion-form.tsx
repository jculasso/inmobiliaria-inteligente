'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LineaLiquidacion, LiquidacionDto, MedioCobro, MonedaAlquiler, PersonaDto, PreparacionLiquidacionDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarLiquidacionPdf, liquidar, prepararLiquidacion } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';

const numero = (n: number) => String(n).padStart(6, '0');

/**
 * Liquidar a un propietario (reglas 20 a 22). Lo que entra lo decide la API:
 * cada vez que se deja algo para después, se le vuelve a preguntar, porque
 * dejar un alquiler arrastra sus honorarios y eso lo sabe ella.
 */
export function LiquidacionForm({ personas, personaInicial, hoy }: { personas: PersonaDto[]; personaInicial: string | null; hoy: string }) {
  const [personaId, setPersonaId] = useState(personaInicial ?? '');
  const [moneda, setMoneda] = useState<MonedaAlquiler>('ARS');
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [prep, setPrep] = useState<PreparacionLiquidacionDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          <Link href={`/alquileres/personas/${hecha.persona.id}`}>
            <Button variant="secondary">Ver la cuenta</Button>
          </Link>
          <Link href="/alquileres/liquidaciones">
            <Button variant="secondary">Volver a la bandeja</Button>
          </Link>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-brand-red">{error}</p>}
      </div>
    );
  }

  const Lista = ({ titulo, lineas, signo, enEspera = false }: { titulo: string; lineas: LineaLiquidacion[]; signo: string; enEspera?: boolean }) => (
    <section className="rounded-brand border border-line bg-white">
      <h2 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
        {titulo} · {lineas.length}
      </h2>
      {lineas.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Nada.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {lineas.map((x) => (
            <li key={x.conceptoId} className="flex items-start gap-3 px-4 py-2.5">
              {!enEspera && (
                <input
                  type="checkbox"
                  aria-label={`Liquidar ${x.descripcion}`}
                  className="mt-0.5 h-4 w-4 accent-brand-red"
                  checked={!excluidos.includes(x.conceptoId)}
                  onChange={() => alternar(x.conceptoId)}
                />
              )}
              <span className={`min-w-0 flex-1 ${enEspera ? 'text-muted' : 'text-ink'}`}>
                {x.contrato ? `${x.contrato.codigo} · ` : ''}
                {x.descripcion}
              </span>
              <span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${enEspera ? 'text-muted' : 'text-ink'}`}>
                {signo}
                {fmtMoneda(x.importe, moneda)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  // Lo que se destildó sigue a la vista, para poder volver a tildarlo.
  const dejados = excluidos.length;

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 rounded-brand border border-line bg-white p-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Campo label="Propietario" requerido>
          <select
            className={inputClass}
            value={personaId}
            onChange={(e) => {
              setPersonaId(e.target.value);
              setExcluidos([]);
            }}
          >
            <option value="">Elegí una persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
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

      {prep && (
        <>
          <Lista titulo="Cobrado a su favor" lineas={prep.aPagar} signo="" />
          <Lista titulo="Descuentos" lineas={prep.aDescontar} signo="− " />
          {prep.enEspera.length > 0 && (
            <>
              <Lista titulo="En espera: el inquilino todavía no pagó" lineas={prep.enEspera} signo="" enEspera />
            </>
          )}
          {dejados > 0 && (
            <p className="text-sm text-muted">
              {dejados === 1 ? 'Un concepto queda' : `${dejados} conceptos quedan`} para la próxima liquidación.{' '}
              <button type="button" className="font-semibold text-brand-red hover:underline" onClick={() => setExcluidos([])}>
                Volver a incluir todo
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-brand border border-line bg-white px-4 py-3">
            <span>
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted">Neto a pagar</span>
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
