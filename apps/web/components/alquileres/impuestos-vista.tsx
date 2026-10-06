'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mesLargo, sumarMesesIso } from '@vacker/domain';
import {
  CATALOGO_SUGERIDO,
  CuentaServicioInputSchema,
  NOMBRE_CLASE_SERVICIO,
  NOMBRE_QUIEN_PAGA,
  ServicioInputSchema,
  type BoletaDto,
  type ClaseServicio,
  type ContratoResumenDto,
  type CuentaServicioDto,
  type MedioCobro,
  type PlanillaBoletasDto,
  type PolizaDto,
  type PropiedadAlquilerDto,
  type QuienPaga,
  type ServicioDto,
} from '@vacker/types';
import { Button, KpiCard, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularBoleta, borrarCuentaServicio, borrarServicio, cargarServiciosSugeridos, guardarCuentaServicio, guardarServicio, pagarBoleta } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AnularModal } from './anular-modal';
import { PlanillaBoletas } from './boletas-planilla';
import { Polizas } from './polizas';
import { AccionesFila, Bloque, CabezaTarjeta, CLASE_TD, CLASE_TD_ACCIONES, CLASE_TH, CLASE_TH_ACCIONES, EncabezadoPagina, Insignia } from './piezas';

const ICONO_CLASE: Record<ClaseServicio | 'poliza', string> = { impuesto: '🏛️', servicio: '💡', expensa: '🏢', poliza: '🛡️' };
const MEDIOS: [MedioCobro, string][] = [
  ['transferencia', 'Transferencia'],
  ['efectivo', 'Efectivo'],
  ['cheque', 'Cheque'],
  ['otro', 'Otro'],
];
const hoy = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const correr = (periodo: string, n: number) => sumarMesesIso(`${periodo}-01`, n).slice(0, 7);
const quienPaga = (p: QuienPaga) => NOMBRE_QUIEN_PAGA[p].toLowerCase();

function EstadoBoleta({ b }: { b: BoletaDto }) {
  if (b.estado === 'anulada') return <Insignia tono="neutro">Anulada</Insignia>;
  if (b.estado === 'pagada') return <Insignia tono="exito">{b.paga === 'inmobiliaria' ? 'Pagada' : 'Comprobante'} {b.pagadaEl ? fmtFecha(b.pagadaEl) : ''}</Insignia>;
  if (b.vencimiento < hoy()) return <Insignia tono="marca">Vencida</Insignia>;
  return <Insignia tono="aviso">{b.paga === 'inmobiliaria' ? 'A pagar' : 'Falta comprobante'}</Insignia>;
}

/** «Pagar» si la paga la inmobiliaria; si la paga una parte, que presentó el comprobante. */
const accion = (b: BoletaDto) => (b.paga === 'inmobiliaria' ? '💸 Pagar' : '✅ Comprobante');

/**
 * Impuestos, servicios y pólizas (entrega 19): las boletas del mes y lo que
 * hay que controlar, la planilla para cargarlas de a muchas, qué tiene cada
 * propiedad y el catálogo de la inmobiliaria.
 */
export function ImpuestosVista({
  periodo,
  ver,
  planilla,
  boletas,
  control,
  servicios,
  cuentas,
  propiedades,
  polizas,
  contratos,
}: {
  periodo: string;
  ver: 'mes' | 'control';
  planilla: PlanillaBoletasDto;
  boletas: BoletaDto[];
  control: BoletaDto[];
  servicios: ServicioDto[];
  cuentas: CuentaServicioDto[];
  propiedades: PropiedadAlquilerDto[];
  polizas: PolizaDto[];
  contratos: ContratoResumenDto[];
}) {
  const router = useRouter();
  const mes = mesLargo(`${periodo}-01`);
  const [cargando, setCargando] = useState(false);
  const [aPagar, setAPagar] = useState<BoletaDto | null>(null);
  const [aAnular, setAAnular] = useState<BoletaDto | null>(null);
  const lista = ver === 'control' ? control : boletas;
  const vivas = boletas.filter((b) => b.estado !== 'anulada');
  const aPagarInmo = control.filter((b) => b.paga === 'inmobiliaria');
  const vencidas = control.filter((b) => b.vencimiento < hoy());
  const sinComprobante = vivas.filter((b) => b.estado === 'pendiente' && b.paga !== 'inmobiliaria');
  const listo = () => {
    setAPagar(null);
    setAAnular(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Impuestos y servicios">
        <div className="flex items-center gap-1 rounded-brand border border-line bg-white">
          <Link href={`?periodo=${correr(periodo, -1)}`} aria-label="Mes anterior" className="px-2.5 py-1 text-lg text-muted hover:text-ink">
            ‹
          </Link>
          <span className="min-w-[9.5rem] text-center text-sm font-bold text-ink">{mes.replace(/^./, (l) => l.toUpperCase())}</span>
          <Link href={`?periodo=${correr(periodo, 1)}`} aria-label="Mes siguiente" className="px-2.5 py-1 text-lg text-muted hover:text-ink">
            ›
          </Link>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCargando((v) => !v)} aria-expanded={cargando}>
          {cargando ? 'Cerrar la planilla' : '📝 Cargar boletas'}
        </Button>
      </EncabezadoPagina>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Paga la inmobiliaria, a 7 días"
          value={fmtMoneda(aPagarInmo.reduce((s, b) => s + (b.moneda === 'ARS' ? b.importe : 0), 0), 'ARS')}
          sub={`${aPagarInmo.length} ${aPagarInmo.length === 1 ? 'boleta' : 'boletas'}`}
          icon="💸"
          tone={aPagarInmo.length ? 'warning' : 'success'}
        />
        <KpiCard label="Vencidas sin pagar" value={String(vencidas.length)} sub="de cualquier mes" icon="⏰" tone={vencidas.length ? 'brand' : 'success'} />
        <KpiCard label={`Cargadas de ${mes.split(' ')[0]}`} value={fmtMoneda(vivas.reduce((s, b) => s + (b.moneda === 'ARS' ? b.importe : 0), 0), 'ARS')} sub={`${vivas.length} boletas`} icon="🧾" />
        <KpiCard label="Falta el comprobante" value={String(sinComprobante.length)} sub="las pagan las partes" icon="📎" tone={sinComprobante.length ? 'warning' : 'success'} />
      </div>

      {cargando && <PlanillaBoletas planilla={planilla} mes={mes} />}

      <Bloque
        icono="🧾"
        titulo="Boletas"
        detalle={`${lista.length}`}
        acciones={
          <div role="group" aria-label="Qué boletas" className="flex gap-1 rounded-brand border border-line bg-white p-1">
            {(['mes', 'control'] as const).map((v) => (
              <Link
                key={v}
                href={`?periodo=${periodo}${v === 'control' ? '&ver=control' : ''}`}
                aria-current={ver === v ? 'page' : undefined}
                className={`rounded-brand px-3 py-1 text-xs font-semibold ${ver === v ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`}
              >
                {v === 'mes' ? `De ${mes.split(' ')[0]}` : 'Para controlar'}
              </Link>
            ))}
          </div>
        }
      >
        {lista.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">{ver === 'control' ? 'Nada vencido ni por vencer en los próximos 7 días.' : `Todavía no hay boletas de ${mes}: «📝 Cargar boletas».`}</p>
        ) : (
          <>
            <div className="sm:hidden">
              <ListaTarjetas etiqueta="Boletas">
                {lista.map((b) => (
                  <Tarjeta key={b.id}>
                    <CabezaTarjeta titulo={`${ICONO_CLASE[b.clase]} ${b.nombre}${b.cuota ? ` ${b.cuota}` : ''}`} detalle={b.propiedad} insignia={<EstadoBoleta b={b} />} />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Importe">{fmtMoneda(b.importe, b.moneda)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Vence">{fmtFecha(b.vencimiento)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="La debe / paga">
                        {b.aCargoDe} / {quienPaga(b.paga)}
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta="Contrato">{b.contrato?.codigo ?? 'sin contrato'}</CampoTarjeta>
                    </CamposTarjeta>
                    {b.estado === 'pendiente' && (
                      <div className="mt-2 flex justify-end gap-1 border-t border-line pt-2">
                        <button type="button" onClick={() => setAPagar(b)} className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">
                          {accion(b)}
                        </button>
                        {!b.aplicada && (
                          <button type="button" onClick={() => setAAnular(b)} className="rounded px-2 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/5">
                            🚫 Anular
                          </button>
                        )}
                      </div>
                    )}
                  </Tarjeta>
                ))}
              </ListaTarjetas>
            </div>
            <div className="hidden max-h-[clamp(20rem,60vh,40rem)] overflow-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={CLASE_TH}>Vence</th>
                    <th className={CLASE_TH}>Qué</th>
                    <th className={CLASE_TH}>Propiedad</th>
                    <th className={CLASE_TH}>La debe · paga</th>
                    <th className={`${CLASE_TH} text-right`}>Importe</th>
                    <th className={CLASE_TH}>Estado</th>
                    <th className={CLASE_TH_ACCIONES} />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((b) => (
                    <tr key={b.id} className={`border-b border-line last:border-0 ${b.estado === 'anulada' ? 'opacity-60' : ''}`}>
                      <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(b.vencimiento)}</td>
                      <td className="px-3 py-2 text-ink">
                        <span aria-hidden>{ICONO_CLASE[b.clase]} </span>
                        {b.nombre}
                        {b.cuota ? <span className="text-muted"> {b.cuota}</span> : null}
                        {(b.numeroCuenta || b.registradoPor) && (
                          <span className="block text-xs text-muted">
                            {b.numeroCuenta ? `Cuenta ${b.numeroCuenta}` : ''}
                            {b.numeroCuenta && b.registradoPor ? ' · ' : ''}
                            {b.registradoPor ? `cargó ${b.registradoPor}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {b.propiedad}
                        {b.contrato && (
                          <Link href={`/alquileres/contratos/${b.contrato.id}`} className="block text-xs font-semibold text-ink hover:text-brand-red">
                            {b.contrato.codigo}
                          </Link>
                        )}
                      </td>
                      <td className={`${CLASE_TD} text-muted`}>
                        {b.aCargoDe} · {quienPaga(b.paga)}
                      </td>
                      <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{fmtMoneda(b.importe, b.moneda)}</td>
                      <td className={CLASE_TD}>
                        <EstadoBoleta b={b} />
                      </td>
                      <td className={CLASE_TD_ACCIONES}>
                        {b.estado === 'pendiente' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setAPagar(b)}
                              aria-label={b.paga === 'inmobiliaria' ? `Pagar ${b.nombre}` : `Registrar el comprobante de ${b.nombre}`}
                              title={b.paga === 'inmobiliaria' ? 'Registrar el pago' : 'La parte presentó el comprobante'}
                              className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                            >
                              {accion(b).split(' ')[0]}
                            </button>
                            {!b.aplicada && (
                              <button type="button" onClick={() => setAAnular(b)} aria-label={`Anular ${b.nombre}`} title="Anular, con un motivo" className="rounded px-1.5 py-0.5 text-base hover:bg-brand-red/5">
                                🚫
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Bloque>

      <CuentasPorPropiedad cuentas={cuentas} servicios={servicios} propiedades={propiedades} />
      <Polizas polizas={polizas} contratos={contratos} />
      <Catalogo servicios={servicios} />

      {aPagar && <PagarBoletaModal boleta={aPagar} onClose={() => setAPagar(null)} onDone={listo} />}
      {aAnular && (
        <AnularModal
          titulo="Anular la boleta"
          detalle={`${aAnular.nombre}${aAnular.cuota ? ` ${aAnular.cuota}` : ''} · ${aAnular.propiedad} · ${fmtMoneda(aAnular.importe, aAnular.moneda)}. Lo que se les cargó a las partes también se anula.`}
          anular={async (motivo) => anularBoleta(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={listo}
        />
      )}
    </div>
  );
}

function PagarBoletaModal({ boleta: b, onClose, onDone }: { boleta: BoletaDto; onClose: () => void; onDone: () => void }) {
  const [fecha, setFecha] = useState(hoy());
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inmo = b.paga === 'inmobiliaria';
  return (
    <Modal title={inmo ? `Pagar ${b.nombre}` : `Comprobante de ${b.nombre}`} subtitle={`${b.propiedad} · ${fmtMoneda(b.importe, b.moneda)}${inmo ? '' : ` · la pagó ${quienPaga(b.paga)}`}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label={inmo ? 'Fecha del pago' : 'Fecha del comprobante'}>
            <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          {/* Si la pagó una parte, solo se registra que trajo el comprobante: el medio no es nuestro. */}
          {inmo && (
            <Campo label="Medio">
              <select className={inputClass} value={medio} onChange={(e) => setMedio(e.target.value as MedioCobro)}>
                {MEDIOS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await pagarBoleta(await getAccessToken(), b.id, fecha, medio);
                onDone();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo registrar.');
                setEnviando(false);
              }
            }}
          >
            {enviando ? 'Registrando…' : inmo ? '💸 Registrar el pago' : '✅ Registrar el comprobante'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Qué impuestos y servicios tiene cada propiedad, con su número de cuenta, quién los debe y quién paga. */
function CuentasPorPropiedad({ cuentas, servicios, propiedades }: { cuentas: CuentaServicioDto[]; servicios: ServicioDto[]; propiedades: PropiedadAlquilerDto[] }) {
  const router = useRouter();
  const [editar, setEditar] = useState<CuentaServicioDto | 'nueva' | null>(null);
  const [aBorrar, setABorrar] = useState<CuentaServicioDto | null>(null);
  const grupos = new Map<string, CuentaServicioDto[]>();
  for (const c of cuentas) grupos.set(c.propiedad.id, [...(grupos.get(c.propiedad.id) ?? []), c]);
  return (
    <Bloque
      icono="🏠"
      titulo="Cuentas por propiedad"
      detalle={`${cuentas.length}`}
      acciones={
        <Button variant="secondary" size="sm" onClick={() => setEditar('nueva')} disabled={servicios.length === 0}>
          ＋ Asignar
        </Button>
      }
    >
      {cuentas.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">{servicios.length ? 'Ninguna propiedad tiene impuestos o servicios asignados todavía.' : 'Primero armá el catálogo, abajo.'}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {[...grupos.values()].map((g) => (
            <li key={g[0]!.propiedad.id} className="px-4 py-2.5">
              <p className="font-semibold text-ink">
                {g[0]!.propiedad.direccion}
                {g[0]!.contrato && <span className="font-normal text-muted"> · {g[0]!.contrato.codigo}</span>}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {g.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-ink">
                      <span aria-hidden>{ICONO_CLASE[c.servicio.clase]} </span>
                      {c.servicio.nombre}
                      <span className="text-xs text-muted">
                        {c.numeroCuenta ? ` · cuenta ${c.numeroCuenta}` : ''} · la debe el {c.aCargoDe}, paga {quienPaga(c.paga)}
                      </span>
                    </span>
                    <AccionesFila nombre={`${c.servicio.nombre} de ${c.propiedad.direccion}`} onEditar={() => setEditar(c)} onBorrar={() => setABorrar(c)} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {editar && (
        <CuentaModal
          cuenta={editar === 'nueva' ? null : editar}
          servicios={servicios}
          propiedades={propiedades}
          onClose={() => setEditar(null)}
          onDone={() => {
            setEditar(null);
            router.refresh();
          }}
        />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar ${aBorrar.servicio.nombre} de esta propiedad`}
          descripcion="Se quita solo si nunca tuvo boletas."
          detalle={<DatoBorrado etiqueta="Propiedad">{aBorrar.propiedad.direccion}</DatoBorrado>}
          onConfirm={async () => {
            await borrarCuentaServicio(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </Bloque>
  );
}

function CuentaModal({
  cuenta: c,
  servicios,
  propiedades,
  onClose,
  onDone,
}: {
  cuenta: CuentaServicioDto | null;
  servicios: ServicioDto[];
  propiedades: PropiedadAlquilerDto[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [propiedadId, setPropiedadId] = useState(c?.propiedad.id ?? '');
  const [servicioId, setServicioId] = useState(c?.servicio.id ?? servicios[0]?.id ?? '');
  const [numeroCuenta, setNumero] = useState(c?.numeroCuenta ?? '');
  const [aCargoDe, setACargoDe] = useState<'inquilino' | 'propietario'>(c?.aCargoDe ?? 'inquilino');
  const [paga, setPaga] = useState<QuienPaga>(c?.paga ?? 'inquilino');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const dto = { propiedadId, servicioId, numeroCuenta, aCargoDe, paga };
    const r = CuentaServicioInputSchema.safeParse(dto);
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await guardarCuentaServicio(await getAccessToken(), c?.id ?? null, dto);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={c ? `Editar ${c.servicio.nombre}` : 'Asignar a una propiedad'} subtitle="Si la paga alguien distinto de quien la debe, a uno se le carga y al otro se le reconoce." onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Campo label="Propiedad" requerido>
          <select className={inputClass} value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
            <option value="">Elegí la propiedad…</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.direccion}
                {p.unidad ? ` ${p.unidad}` : ''}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Impuesto o servicio" requerido>
            <select className={inputClass} value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Número de cuenta">
            <input className={inputClass} value={numeroCuenta} onChange={(e) => setNumero(e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="La debe">
            <select className={inputClass} value={aCargoDe} onChange={(e) => setACargoDe(e.target.value as 'inquilino' | 'propietario')}>
              <option value="inquilino">El inquilino</option>
              <option value="propietario">El propietario</option>
            </select>
          </Campo>
          <Campo label="La paga">
            <select className={inputClass} value={paga} onChange={(e) => setPaga(e.target.value as QuienPaga)}>
              {Object.entries(NOMBRE_QUIEN_PAGA).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** El catálogo de la inmobiliaria: API, TGI, EPE, gas, agua, expensas… */
function Catalogo({ servicios }: { servicios: ServicioDto[] }) {
  const router = useRouter();
  const [editar, setEditar] = useState<ServicioDto | 'nuevo' | null>(null);
  const [aBorrar, setABorrar] = useState<ServicioDto | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  return (
    <Bloque
      icono="📚"
      titulo="Catálogo de impuestos y servicios"
      detalle={`${servicios.length}`}
      acciones={
        <Button variant="secondary" size="sm" onClick={() => setEditar('nuevo')}>
          ＋ Nuevo
        </Button>
      }
    >
      {servicios.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted">
          <span>Vacío. Los habituales son {CATALOGO_SUGERIDO.map((s) => s.nombre.split(' (')[0]).join(', ')}.</span>
          <Button
            variant="primary"
            size="sm"
            disabled={sugiriendo}
            onClick={async () => {
              setSugiriendo(true);
              try {
                await cargarServiciosSugeridos(await getAccessToken());
                router.refresh();
              } finally {
                setSugiriendo(false);
              }
            }}
          >
            {sugiriendo ? 'Cargando…' : 'Cargar los habituales'}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {servicios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="text-ink">
                <span aria-hidden>{ICONO_CLASE[s.clase]} </span>
                {s.nombre}
                <span className="text-xs text-muted">
                  {' '}
                  · {NOMBRE_CLASE_SERVICIO[s.clase].toLowerCase()} · {s.cuentas} {s.cuentas === 1 ? 'propiedad' : 'propiedades'}
                </span>
              </span>
              <AccionesFila nombre={s.nombre} onEditar={() => setEditar(s)} onBorrar={() => setABorrar(s)} />
            </li>
          ))}
        </ul>
      )}
      {editar && (
        <ServicioModal
          servicio={editar === 'nuevo' ? null : editar}
          onClose={() => setEditar(null)}
          onDone={() => {
            setEditar(null);
            router.refresh();
          }}
        />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar ${aBorrar.nombre}`}
          descripcion="Se borra solo si ninguna propiedad lo tiene."
          detalle={<DatoBorrado etiqueta="Tipo">{NOMBRE_CLASE_SERVICIO[aBorrar.clase]}</DatoBorrado>}
          onConfirm={async () => {
            await borrarServicio(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </Bloque>
  );
}

function ServicioModal({ servicio: s, onClose, onDone }: { servicio: ServicioDto | null; onClose: () => void; onDone: () => void }) {
  const [nombre, setNombre] = useState(s?.nombre ?? '');
  const [clase, setClase] = useState<ClaseServicio>(s?.clase ?? 'impuesto');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    const r = ServicioInputSchema.safeParse({ nombre, clase });
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await guardarServicio(await getAccessToken(), s?.id ?? null, r.data);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }
  return (
    <Modal title={s ? `Editar ${s.nombre}` : 'Nuevo impuesto o servicio'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Campo label="Nombre" requerido>
            <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Campo>
          <Campo label="Tipo">
            <select className={inputClass} value={clase} onChange={(e) => setClase(e.target.value as ClaseServicio)}>
              {Object.entries(NOMBRE_CLASE_SERVICIO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
