'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ICONO_RUBRO,
  NOMBRE_TIPO_COMPROBANTE,
  ComprobanteInputSchema,
  type ACargoDe,
  type ContratoResumenDto,
  type MedioCobro,
  type ProveedorDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cargarComprobante } from '../../lib/alquileres-api';
import { hoyIso } from '../../lib/format';
import { leerImporte } from '../../lib/importe';
import { primerMensaje } from '../../lib/mensaje-zod';
import { Campo, inputClass } from '../form-ui';
import { InputImporte } from '../input-importe';
import { MEDIOS_COBRO, NOMBRE_MEDIO } from './medios';
import { Dato } from './piezas';

const num = (v: string) => leerImporte(v) ?? 0;

/** El reclamo del que sale el gasto: queda enlazado, con su proveedor y su contrato (regla 70). */
export interface ReclamoDelGasto {
  id: string;
  numero: number;
  proveedorId: string | null;
  /** El contrato del reclamo, fijo: el gasto del arreglo va a ese. */
  contrato: { id: string; texto: string } | null;
}

/**
 * Cargar un comprobante de proveedor. El mismo formulario en Gastos ›
 * Proveedores y en la ficha de un reclamo («Cargar el gasto del arreglo»):
 * desde el reclamo viene con su proveedor y su contrato, y el comprobante
 * queda enlazado a él.
 */
export function CargarComprobanteModal({
  proveedores,
  contratos,
  reclamo,
  onClose,
  onDone,
}: {
  proveedores: Pick<ProveedorDto, 'id' | 'nombre' | 'rubro'>[];
  contratos: Pick<ContratoResumenDto, 'id' | 'codigo' | 'propiedad' | 'estado'>[];
  reclamo?: ReclamoDelGasto;
  onClose: () => void;
  onDone: () => void;
}) {
  // Desde un reclamo sin proveedor se elige acá: no se propone uno cualquiera.
  const [proveedorId, setProveedorId] = useState(
    reclamo ? (reclamo.proveedorId ?? '') : (proveedores[0]?.id ?? ''),
  );
  const [contratoId, setContratoId] = useState(reclamo?.contrato?.id ?? '');
  const [aCargoDe, setACargoDe] = useState<ACargoDe>('propietario');
  const [fecha, setFecha] = useState(hoyIso());
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [tipoComprobante, setTipo] = useState<
    'factura_a' | 'factura_b' | 'factura_c' | 'recibo' | 'ticket' | 'otro'
  >('factura_c');
  const [numero, setNumero] = useState('');
  const [pagado, setPagado] = useState(false);
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    const dto = {
      proveedorId,
      contratoId: aCargoDe === 'inmobiliaria' ? null : contratoId || null,
      fecha,
      descripcion,
      importe: num(importe),
      tipoComprobante,
      numero,
      aCargoDe,
      pagado,
      medio,
      reclamoId: reclamo?.id ?? null,
    };
    const r = ComprobanteInputSchema.safeParse(dto);
    if (!r.success) {
      setError(primerMensaje(r.error, 'Revisá los datos.'));
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
    <Modal
      title={reclamo ? 'Cargar el gasto del arreglo' : 'Cargar comprobante'}
      subtitle={
        reclamo
          ? `Queda en el reclamo ${reclamo.numero} y en Gastos › Proveedores. Lo que va a cargo del propietario se le descuenta en su próxima liquidación.`
          : 'Lo que va a cargo del propietario se le descuenta en su próxima liquidación.'
      }
      onClose={onClose}
      size="lg"
    >
      {proveedores.length === 0 ? (
        reclamo ? (
          <p className="text-sm text-muted">
            Primero cargá el proveedor en{' '}
            <Link href="/alquileres/proveedores" className="font-semibold text-ink underline">
              Gastos › Proveedores
            </Link>
            .
          </p>
        ) : (
          <p className="text-sm text-muted">Primero cargá el proveedor, abajo en «Proveedores».</p>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Proveedor" requerido>
              <select
                className={inputClass}
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                {!proveedorId && <option value="">Elegí el proveedor…</option>}
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {ICONO_RUBRO[p.rubro]} {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="A cargo de">
              <select
                className={inputClass}
                value={aCargoDe}
                onChange={(e) => setACargoDe(e.target.value as ACargoDe)}
              >
                <option value="propietario">Propietario (se le descuenta)</option>
                <option value="inquilino">Inquilino (se le cobra)</option>
                <option value="inmobiliaria">Inmobiliaria (gasto propio)</option>
              </select>
            </Campo>
          </div>
          {aCargoDe !== 'inmobiliaria' &&
            (reclamo?.contrato ? (
              <dl>
                <Dato etiqueta="Contrato">
                  <span className="font-semibold">{reclamo.contrato.texto}</span>
                </Dato>
              </dl>
            ) : (
              <Campo label="Contrato" requerido>
                <select
                  className={inputClass}
                  value={contratoId}
                  onChange={(e) => setContratoId(e.target.value)}
                >
                  <option value="">Elegí el contrato…</option>
                  {contratos
                    .filter(
                      (c) =>
                        c.estado === 'vigente' ||
                        c.estado === 'finalizado' ||
                        c.estado === 'rescindido',
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} · {c.propiedad.direccion}
                        {c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}
                      </option>
                    ))}
                </select>
              </Campo>
            ))}
          <Campo label="Qué se hizo" requerido>
            <input
              className={inputClass}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Cambio de flexible del baño"
            />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Fecha">
              <input
                type="date"
                className={inputClass}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Campo>
            {/* Los proveedores se pagan en pesos: el rótulo lo dice para que nadie cargue dólares. */}
            <Campo label="Importe en pesos" requerido>
              <InputImporte value={importe} onChange={setImporte} />
            </Campo>
            <Campo label="Comprobante">
              <select
                className={inputClass}
                value={tipoComprobante}
                onChange={(e) => setTipo(e.target.value as typeof tipoComprobante)}
              >
                {Object.entries(NOMBRE_TIPO_COMPROBANTE).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Número">
              <input
                className={inputClass}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-red"
                checked={pagado}
                onChange={(e) => setPagado(e.target.checked)}
              />
              Ya se le pagó al proveedor
            </label>
            {pagado && (
              <select
                aria-label="Medio de pago"
                className={`${inputClass} w-44`}
                value={medio}
                onChange={(e) => setMedio(e.target.value as MedioCobro)}
              >
                {MEDIOS_COBRO.map((v) => (
                  <option key={v} value={v}>
                    {NOMBRE_MEDIO[v]}
                  </option>
                ))}
              </select>
            )}
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
            <Button variant="primary" onClick={cargar} disabled={enviando}>
              {enviando ? 'Cargando…' : 'Cargar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
