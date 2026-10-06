'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CandidatoDto, CobroDto, MedioCobro, MonedaAlquiler, PreparacionCobroDto } from '@vacker/types';
import { planificarCobro } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarRecibo, prepararCobro, registrarCobro, enviarReciboPorMail } from '../../lib/alquileres-api';
import { EnviarMailModal } from './enviar-mail-modal';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { Bloque, EncabezadoPagina } from './piezas';
import { SelectorPersona } from './selector-persona';
import { InputImporte } from '../input-importe';
import { escribirImporte, leerImporte } from '../../lib/importe';

const numero = (s: string) => leerImporte(s) ?? Number.NaN;
const recibo = (n: number) => String(n).padStart(6, '0');

/** Lo que se escribe del punitorio de cada alquiler: el importe y, si se condona algo, el motivo. */
interface Punitorio {
  importe: string;
  motivo: string;
}

/**
 * Registrar un cobro (reglas 15 a 17). La vista previa usa la MISMA función
 * que la API (`planificarCobro`), así que lo que se ve antes de confirmar es lo
 * que va a quedar imputado. Igual la API lo vuelve a calcular: el navegador no
 * decide cuánto va a cada concepto.
 */
export function CobroForm({
  inquilinos,
  propietarios,
  personaInicial,
  hoy,
}: {
  /** A quién se le cobra: los inquilinos, con lo que deben (punto 6 de Javier). */
  inquilinos: CandidatoDto[];
  /** A pedido, los propietarios: el dueño que paga algo que no se le pudo descontar. */
  propietarios: CandidatoDto[];
  personaInicial: string | null;
  hoy: string;
}) {
  const [personaId, setPersonaId] = useState(personaInicial ?? '');
  const [moneda, setMoneda] = useState<MonedaAlquiler>('ARS');
  const [fecha, setFecha] = useState(hoy);
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [importe, setImporte] = useState('');
  const [obs, setObs] = useState('');
  const [prep, setPrep] = useState<PreparacionCobroDto | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [punitorios, setPunitorios] = useState<Record<string, Punitorio>>({});
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandando, setMandando] = useState(false);
  const [hecho, setHecho] = useState<CobroDto | null>(null);

  // Cada vez que cambia a quién, en qué moneda o qué día, se vuelve a pedir lo
  // que debe: el punitorio depende de la fecha.
  useEffect(() => {
    if (!personaId) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const p = await prepararCobro(await getAccessToken(), personaId, moneda, fecha);
        if (!vigente) return;
        setPrep(p);
        setElegidos(new Set(p.deudas.map((d) => d.conceptoId)));
        setPunitorios(Object.fromEntries(p.deudas.filter((d) => d.punitorio).map((d) => [d.conceptoId, { importe: escribirImporte(d.punitorio!.importe), motivo: '' }])));
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo traer la cuenta de la persona.');
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [personaId, moneda, fecha]);

  const deudas = useMemo(() => (prep?.deudas ?? []).filter((d) => elegidos.has(d.conceptoId)), [prep, elegidos]);
  const punitorioDe = (id: string) => {
    const v = punitorios[id] ? numero(punitorios[id]!.importe) : 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const fila = deudas.flatMap((d) => [{ conceptoId: d.conceptoId, saldo: d.saldo }, ...(punitorioDe(d.conceptoId) > 0 ? [{ conceptoId: `p:${d.conceptoId}`, saldo: punitorioDe(d.conceptoId) }] : [])]);
  const totalDeuda = fila.reduce((s, x) => s + x.saldo, 0);
  const aFavor = (prep?.creditos ?? []).reduce((s, c) => s + c.disponible, 0) + (prep?.compensables ?? []).reduce((s, c) => s + c.saldo, 0);
  const sugerido = Math.max(0, Math.round((totalDeuda - aFavor) * 100) / 100);
  const monto = numero(importe);
  const plan =
    prep && monto > 0
      ? planificarCobro({
          importe: monto,
          creditos: prep.creditos,
          compensables: prep.compensables.map((c) => ({ conceptoId: c.conceptoId, saldo: c.saldo })),
          deudas: fila,
        })
      : null;
  const cubierto = (id: string) => (plan?.imputaciones ?? []).filter((i) => i.conceptoId === id).reduce((s, i) => s + i.importe, 0);

  async function confirmar() {
    if (!prep) return;
    setError(null);
    if (!(monto > 0)) return setError('Cargá el importe recibido.');
    for (const d of deudas) {
      if (d.punitorio && punitorioDe(d.conceptoId) < d.punitorio.importe && (punitorios[d.conceptoId]?.motivo.trim().length ?? 0) < 3) {
        return setError(`Para condonar el punitorio de «${d.descripcion}» hace falta el motivo.`);
      }
    }
    setEnviando(true);
    try {
      const r = await registrarCobro(await getAccessToken(), {
        personaId,
        fecha,
        moneda,
        importe: monto,
        medio,
        obs,
        conceptoIds: deudas.length === prep.deudas.length ? null : deudas.map((d) => d.conceptoId),
        punitorios: deudas.filter((d) => d.punitorio).map((d) => ({ conceptoId: d.conceptoId, importe: punitorioDe(d.conceptoId), motivo: punitorios[d.conceptoId]?.motivo })),
      });
      setHecho(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el cobro.');
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="flex flex-col gap-3 rounded-brand border border-success/30 bg-success/5 p-5 shadow-sm">
        <p role="status" className="text-lg font-extrabold text-ink">
          Recibo {recibo(hecho.numero)} · {fmtMoneda(hecho.importe, hecho.moneda)} de {hecho.persona.nombre}
        </p>
        {hecho.aFavor > 0 && <p className="text-sm text-muted">Quedan {fmtMoneda(hecho.aFavor, hecho.moneda)} a su favor para el próximo pago.</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), hecho.id), { titulo: `Recibo ${recibo(hecho.numero)}`, onError: setError })}
          >
            📄 Descargar el recibo
          </Button>
          <Button variant="secondary" onClick={() => setMandando(true)}>
            ✉️ Mandar por mail
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/alquileres/personas/${hecho.persona.id}`}>Ver la cuenta</Link>
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Otro cobro
          </Button>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-brand-red">{error}</p>}
        {mandando && (
          <EnviarMailModal
            titulo={`Mandar el recibo ${recibo(hecho.numero)}`}
            personaId={hecho.persona.id}
            enviar={async (para) => enviarReciboPorMail(await getAccessToken(), hecho.id, para)}
            onClose={() => setMandando(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nuevo cobro" volver={{ href: '/alquileres/cobros', texto: 'Cobros' }} />
      <section className="grid gap-3 rounded-brand border border-line bg-white p-4 shadow-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SelectorPersona
            etiqueta="Quién paga"
            opciones={inquilinos}
            otros={propietarios}
            textoOtros="Incluir propietarios (un dueño que paga algo que no se le pudo descontar)"
            pendienteRotulo="debe"
            value={personaId}
            onChange={setPersonaId}
          />
        </div>
        <Campo label="Fecha">
          <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo label="Moneda">
          <select className={inputClass} value={moneda} onChange={(e) => setMoneda(e.target.value as MonedaAlquiler)}>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        </Campo>
      </section>

      {cargando && <p className="text-sm text-muted">Buscando lo que debe…</p>}

      {prep && !cargando && (
        <>
          <Bloque icono="📋" titulo="Lo que debe" detalle={String(prep.deudas.length)}>
            {prep.deudas.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No tiene nada pendiente en {moneda === 'ARS' ? 'pesos' : 'dólares'}. Lo que pague queda a su favor.</p>
            ) : (
              <ul className="divide-y divide-line">
                {prep.deudas.map((d) => {
                  const elegido = elegidos.has(d.conceptoId);
                  const cub = cubierto(d.conceptoId);
                  const p = punitorios[d.conceptoId];
                  const condona = d.punitorio && elegido && punitorioDe(d.conceptoId) < d.punitorio.importe;
                  return (
                    <li key={d.conceptoId} className="flex flex-col gap-2 px-4 py-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-brand-red"
                          checked={elegido}
                          onChange={(e) => {
                            const s = new Set(elegidos);
                            if (e.target.checked) s.add(d.conceptoId);
                            else s.delete(d.conceptoId);
                            setElegidos(s);
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">
                            {d.contrato ? `${d.contrato.codigo} · ` : ''}
                            {d.descripcion}
                          </span>
                          <span className="block text-xs text-muted">
                            Venció el {fmtFecha(d.vencimiento)}
                            {d.saldo < d.importe ? ` · ya pagó ${fmtMoneda(d.importe - d.saldo, moneda)}` : ''}
                          </span>
                        </span>
                        <span className="text-right text-sm tabular-nums">
                          <span className="block font-bold text-ink">{fmtMoneda(d.saldo, moneda)}</span>
                          {elegido && plan && (
                            <span className={`block text-xs ${cub >= d.saldo ? 'text-success' : 'text-warning'}`}>
                              {cub >= d.saldo ? 'Se cancela' : cub > 0 ? `Queda debiendo ${fmtMoneda(d.saldo - cub, moneda)}` : 'No alcanza'}
                            </span>
                          )}
                        </span>
                      </label>
                      {d.punitorio && elegido && (
                        <div className="ml-7 grid gap-2 rounded-brand bg-surface p-3 sm:grid-cols-[auto_10rem_1fr] sm:items-end">
                          <p className="text-xs text-muted sm:pb-2.5">
                            Punitorio: {d.punitorio.dias} días de atraso, {fmtMoneda(d.punitorio.importe, moneda)}
                          </p>
                          <Campo label="Se cobra">
                            <InputImporte
                              aria-label={`Punitorio de ${d.descripcion}`}
                              moneda={moneda}
                              value={p?.importe ?? ''}
                              onChange={(importe) => setPunitorios({ ...punitorios, [d.conceptoId]: { importe, motivo: p?.motivo ?? '' } })}
                            />
                          </Campo>
                          {condona && (
                            <Campo label="Motivo de la condonación" requerido>
                              <input
                                className={inputClass}
                                value={p?.motivo ?? ''}
                                onChange={(e) => setPunitorios({ ...punitorios, [d.conceptoId]: { importe: p?.importe ?? '0', motivo: e.target.value } })}
                              />
                            </Campo>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {(prep.creditos.length > 0 || prep.compensables.length > 0) && (
              <div className="border-t border-line px-4 py-3 text-sm text-ink">
                {prep.creditos.map((c) => (
                  <p key={c.cobroId}>
                    A su favor del recibo {recibo(c.numero)}: <span className="font-semibold tabular-nums">{fmtMoneda(c.disponible, moneda)}</span>
                  </p>
                ))}
                {prep.compensables.map((c) => (
                  <p key={c.conceptoId}>
                    Reintegro a su favor, {c.descripcion}: <span className="font-semibold tabular-nums">{fmtMoneda(c.saldo, moneda)}</span>
                  </p>
                ))}
                <p className="text-xs text-muted">Se descuenta solo de lo que debe.</p>
              </div>
            )}
          </Bloque>

          <section className="grid gap-3 rounded-brand border border-line bg-white p-4 shadow-sm sm:grid-cols-3">
            <Campo label="Importe recibido" requerido hint={sugerido > 0 ? `Para cancelar lo elegido: ${fmtMoneda(sugerido, moneda)}` : undefined}>
              <div className="flex gap-2">
                <InputImporte className="min-w-0 flex-1" moneda={moneda} aria-label="Importe recibido" value={importe} onChange={setImporte} />
                {sugerido > 0 && (
                  <Button type="button" variant="secondary" onClick={() => setImporte(escribirImporte(sugerido))}>
                    Todo
                  </Button>
                )}
              </div>
            </Campo>
            <Campo label="Medio">
              <select className={inputClass} value={medio} onChange={(e) => setMedio(e.target.value as MedioCobro)}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>
            <Campo label="Observaciones">
              <input className={inputClass} value={obs} onChange={(e) => setObs(e.target.value)} />
            </Campo>
          </section>

          {plan && plan.sobrante > 0 && (
            <p role="status" className="text-sm text-ink">
              Sobran {fmtMoneda(plan.sobrante, moneda)}: quedan a su favor para el próximo pago.
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={confirmar} disabled={enviando || !(monto > 0)}>
              {enviando ? 'Registrando…' : monto > 0 ? `Registrar el cobro de ${fmtMoneda(monto, moneda)}` : 'Registrar el cobro'}
            </Button>
          </div>
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
