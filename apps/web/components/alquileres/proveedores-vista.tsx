'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ICONO_RUBRO,
  NOMBRE_RUBRO,
  NOMBRE_TIPO_COMPROBANTE,
  ComprobanteInputSchema,
  ProveedorInputSchema,
  type ACargoDe,
  type ComprobanteDto,
  type ContratoResumenDto,
  type GastosReporteDto,
  type MedioCobro,
  type ProveedorDto,
  type RubroProveedor,
} from '@vacker/types';
import { Button, KpiCard, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularComprobante, borrarProveedor, cargarComprobante, guardarProveedor, pagarComprobante } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AnularModal } from './anular-modal';
import {
  AccionesFila,
  Bloque,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  EncabezadoPagina,
  Insignia,
  TituloSeccion,
} from './piezas';
import { InputImporte } from '../input-importe';
import { leerImporte } from '../../lib/importe';

const A_CARGO: Record<ACargoDe, string> = { propietario: 'Propietario', inquilino: 'Inquilino', inmobiliaria: 'Inmobiliaria' };
const MEDIOS: [MedioCobro, string][] = [
  ['transferencia', 'Transferencia'],
  ['efectivo', 'Efectivo'],
  ['cheque', 'Cheque'],
  ['otro', 'Otro'],
];
const num = (v: string) => leerImporte(v) ?? 0;
const hoy = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function EstadoComprobante({ c }: { c: ComprobanteDto }) {
  if (c.estado === 'anulado') return <Insignia tono="marca">Anulado</Insignia>;
  if (c.estado === 'pagado') return <Insignia tono="exito">Pagado {c.pagadoEl ? fmtFecha(c.pagadoEl) : ''}</Insignia>;
  return <Insignia tono="aviso">A pagar</Insignia>;
}

/**
 * Proveedores (entrega 18): los comprobantes —qué se hizo, a cargo de quién,
 * si ya se pagó—, los proveedores y los gastos del año por rubro. Javier:
 * «les paga la inmobiliaria y se lo retiene al propietario».
 */
export function ProveedoresVista({
  proveedores,
  comprobantes,
  reporte,
  contratos,
  estado,
}: {
  proveedores: ProveedorDto[];
  comprobantes: ComprobanteDto[];
  reporte: GastosReporteDto;
  contratos: ContratoResumenDto[];
  estado: 'pendientes' | 'todos';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cargando, setCargando] = useState(false);
  const [proveedor, setProveedor] = useState<ProveedorDto | 'nuevo' | null>(null);
  const [aBorrar, setABorrar] = useState<ProveedorDto | null>(null);
  const [aPagar, setAPagar] = useState<ComprobanteDto | null>(null);
  const [aAnular, setAAnular] = useState<ComprobanteDto | null>(null);
  const listo = () => {
    setCargando(false);
    setProveedor(null);
    setAPagar(null);
    setAAnular(null);
    router.refresh();
  };
  const total = reporte.porMes.reduce((s, x) => s + x, 0);
  const deCargo = (a: ACargoDe) => reporte.porACargo.find((x) => x.aCargoDe === a)?.importe ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Proveedores">
        <BotonNuevo onClick={() => setCargando(true)}>Cargar comprobante</BotonNuevo>
      </EncabezadoPagina>

      <section className="flex flex-col gap-2">
        <TituloSeccion icono="📊" detalle={`${reporte.anio}, en pesos`}>
          Gastos
        </TituloSeccion>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="A pagar a proveedores" value={fmtMoneda(reporte.pendiente, 'ARS')} icon="💸" tone={reporte.pendiente > 0 ? 'warning' : 'success'} />
          <KpiCard label={`Gastos de ${reporte.anio}`} value={fmtMoneda(total, 'ARS')} icon="🧰" tone="brand" />
          <KpiCard label="A cargo de propietarios" value={fmtMoneda(deCargo('propietario'), 'ARS')} sub="se les descuenta al liquidar" icon="🧑‍💼" />
          <KpiCard label="A cargo de inquilinos e inmobiliaria" value={fmtMoneda(deCargo('inquilino') + deCargo('inmobiliaria'), 'ARS')} sub={`${fmtMoneda(deCargo('inmobiliaria'), 'ARS')} de la inmobiliaria`} icon="🏢" />
        </div>
        {reporte.porRubro.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reporte.porRubro.map((r) => (
              <li key={r.rubro} className="flex items-center justify-between gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm shadow-sm">
                <span>
                  <span aria-hidden>{ICONO_RUBRO[r.rubro]} </span>
                  <span className="font-semibold text-ink">{NOMBRE_RUBRO[r.rubro]}</span>
                  <span className="text-muted"> · {r.cantidad}</span>
                </span>
                <span className="whitespace-nowrap font-bold tabular-nums text-ink">{fmtMoneda(r.importe, 'ARS')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Bloque
        icono="🧾"
        titulo="Comprobantes"
        detalle={`${comprobantes.length}`}
        acciones={
          <div role="group" aria-label="Qué comprobantes" className="flex gap-1 rounded-brand border border-line bg-white p-1">
            {(['pendientes', 'todos'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={estado === v}
                onClick={() => router.push(v === 'pendientes' ? pathname : `${pathname}?ver=todos`)}
                className={`rounded-brand px-3 py-1 text-xs font-semibold ${estado === v ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`}
              >
                {v === 'pendientes' ? 'A pagar' : 'Todos'}
              </button>
            ))}
          </div>
        }
      >
        {comprobantes.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">{estado === 'pendientes' ? 'No hay nada para pagar a proveedores.' : 'Todavía no se cargó ningún comprobante.'}</p>
        ) : (
          <>
            <div className="sm:hidden">
              <ListaTarjetas etiqueta="Comprobantes">
                {comprobantes.map((c) => (
                  <Tarjeta key={c.id}>
                    <CabezaTarjeta
                      titulo={`${ICONO_RUBRO[c.proveedor.rubro]} ${c.proveedor.nombre}`}
                      detalle={`${fmtFecha(c.fecha)} · ${c.descripcion}`}
                      insignia={<EstadoComprobante c={c} />}
                    />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Importe">{fmtMoneda(c.importe, c.moneda)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="A cargo de">{A_CARGO[c.aCargoDe]}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Contrato">{c.contrato ? `${c.contrato.codigo} · ${c.contrato.propiedad}` : '—'}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Registró">{c.registradoPor ?? '—'}</CampoTarjeta>
                    </CamposTarjeta>
                    {c.estado === 'pendiente' && (
                      <div className="mt-2 flex justify-end gap-1 border-t border-line pt-2">
                        <button type="button" onClick={() => setAPagar(c)} className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">
                          💸 Pagar
                        </button>
                        {!c.aplicado && (
                          <button type="button" onClick={() => setAAnular(c)} className="rounded px-2 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/5">
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
                    <th className={CLASE_TH}>Fecha</th>
                    <th className={CLASE_TH}>Proveedor</th>
                    <th className={CLASE_TH}>Qué se hizo</th>
                    <th className={CLASE_TH}>Contrato</th>
                    <th className={CLASE_TH}>A cargo de</th>
                    <th className={`${CLASE_TH} text-right`}>Importe</th>
                    <th className={CLASE_TH}>Estado</th>
                    <th className={CLASE_TH_ACCIONES} />
                  </tr>
                </thead>
                <tbody>
                  {comprobantes.map((c) => (
                    <tr key={c.id} className={`border-b border-line last:border-0 ${c.estado === 'anulado' ? 'opacity-60' : ''}`}>
                      <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(c.fecha)}</td>
                      <td className={`${CLASE_TD} text-ink`}>
                        <span aria-hidden>{ICONO_RUBRO[c.proveedor.rubro]} </span>
                        {c.proveedor.nombre}
                      </td>
                      <td className="px-3 py-2 text-ink">
                        {c.descripcion}
                        <span className="block text-xs text-muted">
                          {NOMBRE_TIPO_COMPROBANTE[c.tipoComprobante]}
                          {c.numero ? ` ${c.numero}` : ''}
                          {c.registradoPor ? ` · registró ${c.registradoPor}` : ''}
                        </span>
                      </td>
                      <td className={`${CLASE_TD} text-muted`}>{c.contrato ? c.contrato.codigo : '—'}</td>
                      <td className={`${CLASE_TD} text-muted`}>{A_CARGO[c.aCargoDe]}</td>
                      <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{fmtMoneda(c.importe, c.moneda)}</td>
                      <td className={CLASE_TD}>
                        <EstadoComprobante c={c} />
                      </td>
                      <td className={CLASE_TD_ACCIONES}>
                        {c.estado === 'pendiente' && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setAPagar(c)} aria-label={`Pagar a ${c.proveedor.nombre}`} title="Registrar el pago" className="rounded px-1.5 py-0.5 text-base hover:bg-surface">
                              💸
                            </button>
                            {!c.aplicado && (
                              <button type="button" onClick={() => setAAnular(c)} aria-label="Anular el comprobante" title="Anular, con un motivo" className="rounded px-1.5 py-0.5 text-base hover:bg-brand-red/5">
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

      <Bloque icono="🧰" titulo="Proveedores" detalle={`${proveedores.length}`} acciones={<Button variant="secondary" size="sm" onClick={() => setProveedor('nuevo')}>＋ Nuevo proveedor</Button>}>
        {proveedores.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Sin proveedores cargados: plomero, electricista, pintor…</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {proveedores.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    <span aria-hidden>{ICONO_RUBRO[p.rubro]} </span>
                    {p.nombre} <span className="font-normal text-muted">· {NOMBRE_RUBRO[p.rubro]}</span>
                  </span>
                  <span className="block text-xs text-muted">{[p.telefono, p.email, p.alias && `alias ${p.alias}`].filter(Boolean).join(' · ') || 'Sin contacto cargado'}</span>
                </span>
                <span className="flex items-center gap-3">
                  {p.pendiente > 0 && <span className="whitespace-nowrap text-xs text-warning">a pagar {fmtMoneda(p.pendiente, 'ARS')}</span>}
                  <AccionesFila nombre={p.nombre} onEditar={() => setProveedor(p)} onBorrar={() => setABorrar(p)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {cargando && <CargarComprobanteModal proveedores={proveedores} contratos={contratos} onClose={() => setCargando(false)} onDone={listo} />}
      {proveedor && <ProveedorModal proveedor={proveedor === 'nuevo' ? null : proveedor} onClose={() => setProveedor(null)} onDone={listo} />}
      {aPagar && <PagarModal comprobante={aPagar} onClose={() => setAPagar(null)} onDone={listo} />}
      {aAnular && (
        <AnularModal
          titulo="Anular el comprobante"
          detalle={`${aAnular.proveedor.nombre} · ${aAnular.descripcion} · ${fmtMoneda(aAnular.importe, aAnular.moneda)}. Lo que se le cargó a la parte también se anula.`}
          anular={async (motivo) => anularComprobante(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={listo}
        />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar a ${aBorrar.nombre}`}
          descripcion="Se borra solo si no tiene comprobantes."
          detalle={<DatoBorrado etiqueta="Rubro">{NOMBRE_RUBRO[aBorrar.rubro]}</DatoBorrado>}
          onConfirm={async () => {
            await borrarProveedor(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}

function CargarComprobanteModal({ proveedores, contratos, onClose, onDone }: { proveedores: ProveedorDto[]; contratos: ContratoResumenDto[]; onClose: () => void; onDone: () => void }) {
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? '');
  const [contratoId, setContratoId] = useState('');
  const [aCargoDe, setACargoDe] = useState<ACargoDe>('propietario');
  const [fecha, setFecha] = useState(hoy());
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [tipoComprobante, setTipo] = useState<'factura_a' | 'factura_b' | 'factura_c' | 'recibo' | 'ticket' | 'otro'>('factura_c');
  const [numero, setNumero] = useState('');
  const [pagado, setPagado] = useState(false);
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    const dto = { proveedorId, contratoId: aCargoDe === 'inmobiliaria' ? null : contratoId || null, fecha, descripcion, importe: num(importe), tipoComprobante, numero, aCargoDe, pagado, medio };
    const r = ComprobanteInputSchema.safeParse(dto);
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await cargarComprobante(await getAccessToken(), dto);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.');
      setEnviando(false);
    }
  }

  return (
    <Modal title="Cargar comprobante" subtitle="Lo que va a cargo del propietario se le descuenta en su próxima liquidación." onClose={onClose} size="lg">
      {proveedores.length === 0 ? (
        <p className="text-sm text-muted">Primero cargá el proveedor, abajo en «Proveedores».</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Proveedor" requerido>
              <select className={inputClass} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {ICONO_RUBRO[p.rubro]} {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="A cargo de">
              <select className={inputClass} value={aCargoDe} onChange={(e) => setACargoDe(e.target.value as ACargoDe)}>
                <option value="propietario">Propietario (se le descuenta)</option>
                <option value="inquilino">Inquilino (se le cobra)</option>
                <option value="inmobiliaria">Inmobiliaria (gasto propio)</option>
              </select>
            </Campo>
          </div>
          {aCargoDe !== 'inmobiliaria' && (
            <Campo label="Contrato" requerido>
              <select className={inputClass} value={contratoId} onChange={(e) => setContratoId(e.target.value)}>
                <option value="">Elegí el contrato…</option>
                {contratos
                  .filter((c) => c.estado === 'vigente' || c.estado === 'finalizado' || c.estado === 'rescindido')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} · {c.propiedad.direccion}
                      {c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}
                    </option>
                  ))}
              </select>
            </Campo>
          )}
          <Campo label="Qué se hizo" requerido>
            <input className={inputClass} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Cambio de flexible del baño" />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo label="Fecha">
              <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo label="Importe" requerido>
              <InputImporte value={importe} onChange={setImporte} />
            </Campo>
            <Campo label="Comprobante">
              <select className={inputClass} value={tipoComprobante} onChange={(e) => setTipo(e.target.value as typeof tipoComprobante)}>
                {Object.entries(NOMBRE_TIPO_COMPROBANTE).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Número">
              <input className={inputClass} value={numero} onChange={(e) => setNumero(e.target.value)} />
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 accent-brand-red" checked={pagado} onChange={(e) => setPagado(e.target.checked)} />
              Ya se le pagó al proveedor
            </label>
            {pagado && (
              <select aria-label="Medio de pago" className={`${inputClass} w-44`} value={medio} onChange={(e) => setMedio(e.target.value as MedioCobro)}>
                {MEDIOS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
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
            <Button variant="primary" onClick={cargar} disabled={enviando}>
              {enviando ? 'Cargando…' : 'Cargar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ProveedorModal({ proveedor: p, onClose, onDone }: { proveedor: ProveedorDto | null; onClose: () => void; onDone: () => void }) {
  const [nombre, setNombre] = useState(p?.nombre ?? '');
  const [rubro, setRubro] = useState<RubroProveedor>(p?.rubro ?? 'plomero');
  const [telefono, setTelefono] = useState(p?.telefono ?? '');
  const [email, setEmail] = useState(p?.email ?? '');
  const [cuit, setCuit] = useState(p?.cuit ?? '');
  const [alias, setAlias] = useState(p?.alias ?? '');
  const [cbu, setCbu] = useState(p?.cbu ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const dto = { nombre, rubro, telefono, email, cuit, alias, cbu, obs: p?.obs ?? null };
    const r = ProveedorInputSchema.safeParse(dto);
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await guardarProveedor(await getAccessToken(), p?.id ?? null, dto);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={p ? `Editar ${p.nombre}` : 'Nuevo proveedor'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Campo label="Nombre" requerido>
            <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Campo>
          <Campo label="Rubro">
            <select className={inputClass} value={rubro} onChange={(e) => setRubro(e.target.value as RubroProveedor)}>
              {Object.entries(NOMBRE_RUBRO).map(([v, l]) => (
                <option key={v} value={v}>
                  {ICONO_RUBRO[v as RubroProveedor]} {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Teléfono">
            <input className={inputClass} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
          <Campo label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo label="CUIT">
            <input className={inputClass} inputMode="numeric" value={cuit} onChange={(e) => setCuit(e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Alias">
            <input className={inputClass} value={alias} onChange={(e) => setAlias(e.target.value)} />
          </Campo>
          <Campo label="CBU">
            <input className={inputClass} inputMode="numeric" value={cbu} onChange={(e) => setCbu(e.target.value)} />
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

function PagarModal({ comprobante: c, onClose, onDone }: { comprobante: ComprobanteDto; onClose: () => void; onDone: () => void }) {
  const [fecha, setFecha] = useState(hoy());
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal title={`Pagar a ${c.proveedor.nombre}`} subtitle={`${c.descripcion} · ${fmtMoneda(c.importe, c.moneda)}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Fecha del pago">
            <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo label="Medio">
            <select className={inputClass} value={medio} onChange={(e) => setMedio(e.target.value as MedioCobro)}>
              {MEDIOS.map(([v, l]) => (
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
          <Button
            variant="primary"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await pagarComprobante(await getAccessToken(), c.id, fecha, medio);
                onDone();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo registrar.');
                setEnviando(false);
              }
            }}
          >
            {enviando ? 'Registrando…' : `💸 Registrar el pago`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
