'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  NOMBRE_A_CARGO_DE,
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO_RECLAMO,
  type EstadoReclamo,
  type GastoDelReclamo,
  type PrioridadReclamo,
  type ProveedorDto,
  type ReclamoDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarReclamo } from '../../lib/alquileres-api';
import { fmtFecha, fmtFechaDe, fmtFechaHora, fmtMoneda } from '../../lib/format';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { AvisarProveedorModal } from './avisar-proveedor-modal';
import { CargarComprobanteModal } from './cargar-comprobante-modal';
import {
  Bloque,
  CabezaTarjeta,
  CLASE_TD,
  CLASE_TH,
  Dato,
  EncabezadoPagina,
  Insignia,
  Panel,
  VacioBloque,
} from './piezas';
import {
  ContactoProveedor,
  EstadoReclamoBadge,
  PrioridadBadge,
  SelectLoSigue,
  SelectProveedor,
  useUsuarios,
} from './reclamos-piezas';

/**
 * Un reclamo: qué pasa, de quién, quién lo sigue, quién lo arregla, lo que
 * costó el arreglo y su historial de notas. Desde acá se le avisa al
 * proveedor por mail y se carga el gasto del arreglo (reglas 70 a 73).
 */
export function ReclamoFicha({
  reclamo: r,
  proveedores,
}: {
  reclamo: ReclamoDto;
  /** Los proveedores del módulo: para elegir quién lo arregla y para el gasto. */
  proveedores: ProveedorDto[];
}) {
  const router = useRouter();
  const usuarios = useUsuarios();
  const [avisando, setAvisando] = useState(false);
  const [cargandoGasto, setCargandoGasto] = useState(false);
  const [estado, setEstado] = useState<EstadoReclamo>(r.estado);
  const [prioridad, setPrioridad] = useState<PrioridadReclamo>(r.prioridad);
  const [asignado, setAsignado] = useState(r.asignadoAId ?? '');
  const [proveedor, setProveedor] = useState(r.proveedor?.id ?? '');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambio =
    estado !== r.estado ||
    prioridad !== r.prioridad ||
    asignado !== (r.asignadoAId ?? '') ||
    proveedor !== (r.proveedor?.id ?? '') ||
    nota.trim() !== '';

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await cambiarReclamo(await getAccessToken(), r.id, {
        ...(estado !== r.estado ? { estado } : {}),
        ...(prioridad !== r.prioridad ? { prioridad } : {}),
        ...(asignado !== (r.asignadoAId ?? '') ? { asignadoAId: asignado || null } : {}),
        ...(proveedor !== (r.proveedor?.id ?? '') ? { proveedorId: proveedor || null } : {}),
        nota: nota.trim() || null,
      });
      setNota('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo={`Reclamo ${r.numero} · ${r.asunto}`}
        volver={{ href: '/alquileres/reclamos', texto: 'Reclamos' }}
      >
        <PrioridadBadge prioridad={r.prioridad} />
        <EstadoReclamoBadge estado={r.estado} />
      </EncabezadoPagina>
      <Panel icono="🛠️" titulo={NOMBRE_TIPO_RECLAMO[r.tipo]}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dato etiqueta="Contrato">
            {r.contrato && (
              <Link
                href={`/alquileres/contratos/${r.contrato.id}`}
                className="font-semibold text-ink hover:underline"
              >
                {r.contrato.codigo} · {r.contrato.propiedad}
              </Link>
            )}
          </Dato>
          <Dato etiqueta="De">
            {r.persona && (
              <Link
                href={`/alquileres/personas/${r.persona.id}`}
                className="text-ink hover:underline"
              >
                {r.persona.nombre}
              </Link>
            )}
          </Dato>
          <Dato etiqueta="Abierto">
            {fmtFechaDe(r.abierto)}
            {r.abiertoPor ? ` · ${r.abiertoPor}` : ''}
          </Dato>
          <Dato etiqueta="Lo sigue">{r.asignadoA ?? 'Sin asignar'}</Dato>
          <Dato etiqueta="Proveedor">
            <ContactoProveedor proveedor={r.proveedor} />
          </Dato>
        </dl>
        {r.descripcion && (
          <p className="mt-3 whitespace-pre-line text-sm text-ink">{r.descripcion}</p>
        )}
        <AvisoAlProveedor reclamo={r} onAvisar={() => setAvisando(true)} />
      </Panel>
      <GastosDelArreglo reclamo={r} onCargar={() => setCargandoGasto(true)} />
      <Panel icono="✍️" titulo="Actualizar">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Estado">
              <select
                className={inputClass}
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoReclamo)}
              >
                {Object.entries(NOMBRE_ESTADO_RECLAMO).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Prioridad">
              <select
                className={inputClass}
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as PrioridadReclamo)}
              >
                {Object.entries(NOMBRE_PRIORIDAD).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Campo>
            <SelectLoSigue
              usuarios={usuarios}
              value={asignado}
              onChange={setAsignado}
              actual={r.asignadoAId ? { id: r.asignadoAId, nombre: r.asignadoA } : null}
            />
            <SelectProveedor
              proveedores={proveedores}
              value={proveedor}
              onChange={setProveedor}
              actual={r.proveedor}
            />
          </div>
          <Campo
            label="Nota"
            hint="Lo que se hizo o se habló: queda en el historial con tu nombre."
          >
            <textarea
              className={textareaClass}
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </Campo>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={guardar} disabled={guardando || !cambio}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Panel>
      <Bloque icono="🕓" titulo="Historial" detalle={`${r.notas.length}`}>
        {r.notas.length === 0 ? (
          <VacioBloque>Sin notas todavía.</VacioBloque>
        ) : (
          <ol className="divide-y divide-line text-sm">
            {r.notas.map((n) => (
              <li key={n.id} className="px-4 py-2.5">
                <p className="whitespace-pre-line text-ink">{n.texto}</p>
                <p className="text-xs text-muted">
                  {n.usuario ?? 'Sin operador'} · {fmtFechaHora(n.en)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Bloque>
      {avisando && r.proveedor?.email && (
        <AvisarProveedorModal
          reclamo={r}
          email={r.proveedor.email}
          onClose={() => setAvisando(false)}
          onEnviado={() => {
            setAvisando(false);
            router.refresh();
          }}
        />
      )}
      {cargandoGasto && (
        <CargarComprobanteModal
          proveedores={proveedores}
          contratos={[]}
          reclamo={{
            id: r.id,
            numero: r.numero,
            proveedorId: r.proveedor?.id ?? null,
            contrato: r.contrato
              ? { id: r.contrato.id, texto: `${r.contrato.codigo} · ${r.contrato.propiedad}` }
              : null,
          }}
          onClose={() => setCargandoGasto(false)}
          onDone={() => {
            setCargandoGasto(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * «Avisar al proveedor» (regla 73). Sin proveedor o sin su email, el botón no
 * falla: dice qué falta y dónde se carga.
 */
function AvisoAlProveedor({ reclamo: r, onAvisar }: { reclamo: ReclamoDto; onAvisar: () => void }) {
  const falta = !r.proveedor ? (
    'Elegí el proveedor en «Actualizar» para poder avisarle.'
  ) : !r.proveedor.email ? (
    <>
      Cargale un email al proveedor en{' '}
      <Link href="/alquileres/proveedores" className="font-semibold text-ink underline">
        Gastos › Proveedores
      </Link>
      .
    </>
  ) : null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
      <Button
        variant="secondary"
        onClick={onAvisar}
        disabled={!!falta}
        aria-describedby={falta ? 'aviso-proveedor-falta' : undefined}
      >
        ✉️ Avisar al proveedor
      </Button>
      {falta && (
        <p id="aviso-proveedor-falta" className="text-sm text-muted">
          {falta}
        </p>
      )}
    </div>
  );
}

function EstadoGasto({ estado }: { estado: GastoDelReclamo['estado'] }) {
  if (estado === 'anulado') return <Insignia tono="neutro">Anulado</Insignia>;
  if (estado === 'pagado') return <Insignia tono="exito">Pagado</Insignia>;
  return <Insignia tono="aviso">A pagar</Insignia>;
}

/**
 * «Gastos del arreglo» (regla 71): los comprobantes de proveedor cargados
 * desde el reclamo, tarjetas en el celular y tabla en la compu, con el total
 * sin los anulados.
 */
function GastosDelArreglo({ reclamo: r, onCargar }: { reclamo: ReclamoDto; onCargar: () => void }) {
  const tachado = (g: GastoDelReclamo) => (g.estado === 'anulado' ? 'text-muted line-through' : '');
  return (
    <Bloque
      icono="🧾"
      titulo="Gastos del arreglo"
      detalle={r.gastos.length ? `${r.gastos.length}` : undefined}
      acciones={
        <Button variant="secondary" size="sm" onClick={onCargar}>
          ＋ Cargar el gasto del arreglo
        </Button>
      }
    >
      {r.gastos.length === 0 ? (
        <VacioBloque>Todavía no se cargó ningún gasto del arreglo.</VacioBloque>
      ) : (
        <>
          <ListaTarjetas etiqueta="Gastos del arreglo">
            {r.gastos.map((g) => (
              <Tarjeta key={g.id}>
                <CabezaTarjeta
                  titulo={g.proveedor}
                  detalle={`${fmtFecha(g.fecha)} · ${g.descripcion}`}
                  insignia={<EstadoGasto estado={g.estado} />}
                />
                <CamposTarjeta>
                  <CampoTarjeta etiqueta="Importe">
                    <span className={tachado(g)}>{fmtMoneda(g.importe, g.moneda)}</span>
                  </CampoTarjeta>
                  <CampoTarjeta etiqueta="A cargo de">{NOMBRE_A_CARGO_DE[g.aCargoDe]}</CampoTarjeta>
                </CamposTarjeta>
              </Tarjeta>
            ))}
          </ListaTarjetas>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={CLASE_TH}>Fecha</th>
                  <th className={CLASE_TH}>Proveedor</th>
                  <th className={CLASE_TH}>Qué se hizo</th>
                  <th className={CLASE_TH}>A cargo de</th>
                  <th className={`${CLASE_TH} text-right`}>Importe</th>
                  <th className={CLASE_TH}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {r.gastos.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(g.fecha)}</td>
                    <td className={`${CLASE_TD} text-ink`}>{g.proveedor}</td>
                    <td className="px-3 py-2 text-ink">{g.descripcion}</td>
                    <td className={`${CLASE_TD} text-muted`}>{NOMBRE_A_CARGO_DE[g.aCargoDe]}</td>
                    <td
                      className={`${CLASE_TD} text-right font-semibold tabular-nums ${tachado(g) || 'text-ink'}`}
                    >
                      {fmtMoneda(g.importe, g.moneda)}
                    </td>
                    <td className={CLASE_TD}>
                      <EstadoGasto estado={g.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex flex-wrap justify-end gap-x-3 border-t border-line px-4 py-2.5 text-sm text-ink">
            <span className="text-muted">Total del arreglo</span>
            <span className="font-bold tabular-nums">
              {r.totalGastos.length
                ? r.totalGastos.map((t) => fmtMoneda(t.importe, t.moneda)).join(' · ')
                : fmtMoneda(0, 'ARS')}
            </span>
          </p>
        </>
      )}
    </Bloque>
  );
}
