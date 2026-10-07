'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ICONO_RUBRO,
  NOMBRE_A_CARGO_DE,
  NOMBRE_RUBRO,
  NOMBRE_TIPO_COMPROBANTE,
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
import {
  anularComprobante,
  borrarProveedor,
  guardarProveedor,
  pagarComprobante,
} from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda, hoyIso } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AnularModal } from './anular-modal';
import { CargarComprobanteModal } from './cargar-comprobante-modal';
import { MEDIOS_COBRO, NOMBRE_MEDIO } from './medios';
import {
  AccionesFila,
  AccionFila,
  Bloque,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  EncabezadoPagina,
  Insignia,
  Segmentado,
  TituloSeccion,
  VacioBloque,
} from './piezas';
import { primerMensaje } from '../../lib/mensaje-zod';

const A_CARGO = NOMBRE_A_CARGO_DE;

/** «Reclamo 7», con link a su ficha: el gasto salió de ese arreglo (regla 72). */
function LinkReclamo({ reclamo }: { reclamo: ComprobanteDto['reclamo'] }) {
  if (!reclamo) return null;
  return (
    <Link
      href={`/alquileres/reclamos/${reclamo.id}`}
      className="font-semibold text-ink underline-offset-2 hover:underline"
    >
      Reclamo {reclamo.numero}
    </Link>
  );
}

function EstadoComprobante({ c }: { c: ComprobanteDto }) {
  if (c.estado === 'anulado') return <Insignia tono="neutro">Anulado</Insignia>;
  if (c.estado === 'pagado')
    return <Insignia tono="exito">Pagado {c.pagadoEl ? fmtFecha(c.pagadoEl) : ''}</Insignia>;
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
          <KpiCard
            label="A pagar a proveedores"
            value={fmtMoneda(reporte.pendiente, 'ARS')}
            icon="💸"
            tone={reporte.pendiente > 0 ? 'warning' : 'success'}
          />
          <KpiCard
            label={`Gastos de ${reporte.anio}`}
            value={fmtMoneda(total, 'ARS')}
            icon="🧰"
            tone="brand"
          />
          <KpiCard
            label="A cargo de propietarios"
            value={fmtMoneda(deCargo('propietario'), 'ARS')}
            sub="se les descuenta al liquidar"
            icon="🧑‍💼"
          />
          <KpiCard
            label="A cargo de inquilinos e inmobiliaria"
            value={fmtMoneda(deCargo('inquilino') + deCargo('inmobiliaria'), 'ARS')}
            sub={`${fmtMoneda(deCargo('inmobiliaria'), 'ARS')} de la inmobiliaria`}
            icon="🏢"
          />
        </div>
        {reporte.porRubro.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reporte.porRubro.map((r) => (
              <li
                key={r.rubro}
                className="flex items-center justify-between gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span>
                  <span aria-hidden>{ICONO_RUBRO[r.rubro]} </span>
                  <span className="font-semibold text-ink">{NOMBRE_RUBRO[r.rubro]}</span>
                  <span className="text-muted"> · {r.cantidad}</span>
                </span>
                <span className="whitespace-nowrap font-bold tabular-nums text-ink">
                  {fmtMoneda(r.importe, 'ARS')}
                </span>
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
          <Segmentado
            etiqueta="Qué comprobantes"
            opciones={[
              ['pendientes', 'A pagar'],
              ['todos', 'Todos'],
            ]}
            valor={estado}
            onCambio={(v) => router.push(v === 'pendientes' ? pathname : `${pathname}?ver=todos`)}
          />
        }
      >
        {comprobantes.length === 0 ? (
          <VacioBloque>
            {estado === 'pendientes'
              ? 'No hay nada para pagar a proveedores.'
              : 'Todavía no se cargó ningún comprobante.'}
          </VacioBloque>
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
                      <CampoTarjeta etiqueta="Importe">
                        <span className={c.estado === 'anulado' ? 'text-muted line-through' : ''}>
                          {fmtMoneda(c.importe, c.moneda)}
                        </span>
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta="A cargo de">{A_CARGO[c.aCargoDe]}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Contrato">
                        {c.contrato ? `${c.contrato.codigo} · ${c.contrato.propiedad}` : '—'}
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta="Registró">{c.registradoPor ?? '—'}</CampoTarjeta>
                      {c.reclamo && (
                        <CampoTarjeta etiqueta="Reclamo">
                          <LinkReclamo reclamo={c.reclamo} />
                        </CampoTarjeta>
                      )}
                    </CamposTarjeta>
                    {c.estado === 'pendiente' && (
                      <AccionesFila
                        tarjeta
                        nombre={`el comprobante de ${c.proveedor.nombre}`}
                        extra={
                          <AccionFila
                            tarjeta
                            icono="💸"
                            texto="Pagar"
                            etiqueta={`Pagar a ${c.proveedor.nombre}`}
                            onClick={() => setAPagar(c)}
                          />
                        }
                        onBorrar={c.aplicado ? undefined : () => setAAnular(c)}
                        anula
                      />
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
                    <tr key={c.id} className="border-b border-line last:border-0">
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
                        {c.reclamo && (
                          <span className="block text-xs">
                            <LinkReclamo reclamo={c.reclamo} />
                          </span>
                        )}
                      </td>
                      <td className={`${CLASE_TD} text-muted`}>
                        {c.contrato ? c.contrato.codigo : '—'}
                      </td>
                      <td className={`${CLASE_TD} text-muted`}>{A_CARGO[c.aCargoDe]}</td>
                      <td
                        className={`${CLASE_TD} text-right font-semibold tabular-nums ${c.estado === 'anulado' ? 'text-muted line-through' : 'text-ink'}`}
                      >
                        {fmtMoneda(c.importe, c.moneda)}
                      </td>
                      <td className={CLASE_TD}>
                        <EstadoComprobante c={c} />
                      </td>
                      <td className={CLASE_TD_ACCIONES}>
                        {c.estado === 'pendiente' && (
                          <AccionesFila
                            nombre={`el comprobante de ${c.proveedor.nombre} (${c.descripcion})`}
                            extra={
                              <AccionFila
                                icono="💸"
                                texto="Pagar"
                                etiqueta={`Pagar a ${c.proveedor.nombre}`}
                                title="Registrar el pago"
                                onClick={() => setAPagar(c)}
                              />
                            }
                            onBorrar={c.aplicado ? undefined : () => setAAnular(c)}
                            anula
                          />
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

      <Bloque
        icono="🧰"
        titulo="Proveedores"
        detalle={`${proveedores.length}`}
        acciones={
          <Button variant="secondary" size="sm" onClick={() => setProveedor('nuevo')}>
            ＋ Nuevo proveedor
          </Button>
        }
      >
        {proveedores.length === 0 ? (
          <VacioBloque>Sin proveedores cargados: plomero, electricista, pintor…</VacioBloque>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {proveedores.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    <span aria-hidden>{ICONO_RUBRO[p.rubro]} </span>
                    {p.nombre}{' '}
                    <span className="font-normal text-muted">· {NOMBRE_RUBRO[p.rubro]}</span>
                  </span>
                  <span className="block text-xs text-muted">
                    {[p.telefono, p.email, p.alias && `alias ${p.alias}`]
                      .filter(Boolean)
                      .join(' · ') || 'Sin contacto cargado'}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {p.pendiente > 0 && (
                    <span className="whitespace-nowrap text-xs text-warning">
                      a pagar {fmtMoneda(p.pendiente, 'ARS')}
                    </span>
                  )}
                  <AccionesFila
                    nombre={p.nombre}
                    onEditar={() => setProveedor(p)}
                    onBorrar={() => setABorrar(p)}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {cargando && (
        <CargarComprobanteModal
          proveedores={proveedores}
          contratos={contratos}
          onClose={() => setCargando(false)}
          onDone={listo}
        />
      )}
      {proveedor && (
        <ProveedorModal
          proveedor={proveedor === 'nuevo' ? null : proveedor}
          onClose={() => setProveedor(null)}
          onDone={listo}
        />
      )}
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

function ProveedorModal({
  proveedor: p,
  onClose,
  onDone,
}: {
  proveedor: ProveedorDto | null;
  onClose: () => void;
  onDone: () => void;
}) {
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
      setError(primerMensaje(r.error, 'Revisá los datos.'));
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
            <input
              className={inputClass}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </Campo>
          <Campo label="Rubro">
            <select
              className={inputClass}
              value={rubro}
              onChange={(e) => setRubro(e.target.value as RubroProveedor)}
            >
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
            <input
              className={inputClass}
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </Campo>
          <Campo label="Email">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <Campo label="CUIT">
            <input
              className={inputClass}
              inputMode="numeric"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
            />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Alias">
            <input
              className={inputClass}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </Campo>
          <Campo label="CBU">
            <input
              className={inputClass}
              inputMode="numeric"
              value={cbu}
              onChange={(e) => setCbu(e.target.value)}
            />
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
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

function PagarModal({
  comprobante: c,
  onClose,
  onDone,
}: {
  comprobante: ComprobanteDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fecha, setFecha] = useState(hoyIso());
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal
      title={`Pagar a ${c.proveedor.nombre}`}
      subtitle={`${c.descripcion} · ${fmtMoneda(c.importe, c.moneda)}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Fecha del pago">
            <input
              type="date"
              className={inputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
          <Campo label="Medio">
            <select
              className={inputClass}
              value={medio}
              onChange={(e) => setMedio(e.target.value as MedioCobro)}
            >
              {MEDIOS_COBRO.map((v) => (
                <option key={v} value={v}>
                  {NOMBRE_MEDIO[v]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
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
