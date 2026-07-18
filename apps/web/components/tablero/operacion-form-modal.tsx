'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type {
  CreateOperacion,
  EstadoAlquiler,
  EstadoVenta,
  OperacionDto,
  PuntaInput,
  TipoOperacion,
  UpdateOperacion,
  VendedorDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createOperacion, updateOperacion } from '../../lib/tablero-api';
import { Modal } from './modal';

const ESTADOS_VENTA: EstadoVenta[] = ['escriturada', 'senada', 'reservada', 'boleto'];
const ESTADOS_ALQUILER: EstadoAlquiler[] = ['firmado', 'reservado', 'pendiente'];

function nuevoCodigo(tipo: TipoOperacion): string {
  const prefijo = tipo === 'venta' ? 'OP' : 'ALQ';
  return `${prefijo}-${Date.now().toString().slice(-6)}`;
}

interface Props {
  tipo: TipoOperacion;
  vendedores: VendedorDto[];
  operacion?: OperacionDto;
  onClose: () => void;
  onSaved: () => void;
}

export function OperacionFormModal({ tipo, vendedores, operacion, onClose, onSaved }: Props) {
  const puntaVendActual = operacion?.puntas.find((p) => p.lado === 'vendedora');
  const puntaCompActual = operacion?.puntas.find((p) => p.lado === 'compradora');

  const [codigo, setCodigo] = useState(operacion?.codigo ?? nuevoCodigo(tipo));
  const [direccion, setDireccion] = useState(operacion?.direccion ?? '');
  const [precio, setPrecio] = useState(String(operacion?.precio ?? ''));
  const [valorMensual, setValorMensual] = useState(String(operacion?.valorMensual ?? ''));
  const [comisionAlquiler, setComisionAlquiler] = useState(
    String(tipo === 'alquiler' ? (operacion?.comTotal ?? '') : ''),
  );
  const [estado, setEstado] = useState(
    operacion?.estado ?? (tipo === 'venta' ? 'escriturada' : 'firmado'),
  );
  const [fechaReserva, setFechaReserva] = useState(operacion?.fechaReserva ?? '');
  const [fechaFirma, setFechaFirma] = useState(operacion?.fechaFirma ?? '');
  const [obs, setObs] = useState(operacion?.obs ?? '');
  const [usuarioIdVend, setUsuarioIdVend] = useState(puntaVendActual?.usuarioId ?? '');
  const [comisionVend, setComisionVend] = useState(String(puntaVendActual?.comision ?? ''));
  const [usuarioIdComp, setUsuarioIdComp] = useState(puntaCompActual?.usuarioId ?? '');
  const [comisionComp, setComisionComp] = useState(String(puntaCompActual?.comision ?? ''));

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const puntas: PuntaInput[] = [];
    if (usuarioIdVend) {
      puntas.push({
        lado: 'vendedora',
        usuarioId: usuarioIdVend,
        comision: Number(comisionVend) || 0,
      });
    }
    if (usuarioIdComp) {
      puntas.push({
        lado: 'compradora',
        usuarioId: usuarioIdComp,
        comision: Number(comisionComp) || 0,
      });
    }

    if (tipo === 'venta' && puntas.length === 0) {
      setError('Una venta necesita al menos una punta (vendedora o compradora).');
      return;
    }

    setLoading(true);
    try {
      const accessToken = await getAccessToken();

      if (operacion) {
        const dto: UpdateOperacion = {
          codigo,
          direccion,
          moneda: 'USD',
          precio: tipo === 'venta' ? Number(precio) || 0 : null,
          valorMensual: tipo === 'alquiler' ? Number(valorMensual) || 0 : null,
          comision: tipo === 'alquiler' ? Number(comisionAlquiler) || 0 : 0,
          estado,
          fechaReserva: fechaReserva || null,
          fechaFirma: fechaFirma || null,
          obs: obs || null,
          ...(tipo === 'venta' ? { puntas } : {}),
        };
        await updateOperacion(accessToken, operacion.id, dto);
      } else {
        const base = {
          codigo,
          direccion,
          moneda: 'USD',
          fechaReserva: fechaReserva || null,
          fechaFirma: fechaFirma || null,
          obs: obs || null,
        };
        const dto: CreateOperacion =
          tipo === 'venta'
            ? { tipo, ...base, precio: Number(precio) || 0, estado: estado as EstadoVenta, puntas }
            : {
                tipo,
                ...base,
                valorMensual: Number(valorMensual) || 0,
                comision: Number(comisionAlquiler) || 0,
                estado: estado as EstadoAlquiler,
              };
        await createOperacion(accessToken, dto);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la operación.');
    } finally {
      setLoading(false);
    }
  }

  const estados = tipo === 'venta' ? ESTADOS_VENTA : ESTADOS_ALQUILER;

  return (
    <Modal
      title={`${operacion ? 'Editar' : 'Nueva'} ${tipo === 'venta' ? 'venta' : 'alquiler'}`}
      onClose={onClose}
      size="lg"
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Código">
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required className={inputClass} />
          </Campo>
          <Campo label="Dirección">
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              required
              className={inputClass}
            />
          </Campo>
        </div>

        {tipo === 'venta' ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Precio (USD)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
                className={inputClass}
              />
            </Campo>
            <Campo label="Estado">
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoVenta | EstadoAlquiler)}
                className={inputClass}
              >
                {estados.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Valor mensual (USD)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={valorMensual}
                onChange={(e) => setValorMensual(e.target.value)}
                required
                className={inputClass}
              />
            </Campo>
            <Campo label="Comisión (USD)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={comisionAlquiler}
                onChange={(e) => setComisionAlquiler(e.target.value)}
                className={inputClass}
              />
            </Campo>
            <Campo label="Estado">
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoVenta | EstadoAlquiler)}
                className={inputClass}
              >
                {estados.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha reserva">
            <input
              type="date"
              value={fechaReserva}
              onChange={(e) => setFechaReserva(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Fecha firma">
            <input
              type="date"
              value={fechaFirma}
              onChange={(e) => setFechaFirma(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>

        {tipo === 'venta' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Punta vendedora">
              <select
                value={usuarioIdVend}
                onChange={(e) => setUsuarioIdVend(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Comisión vendedora">
              <input
                type="number"
                min={0}
                step="0.01"
                value={comisionVend}
                onChange={(e) => setComisionVend(e.target.value)}
                disabled={!usuarioIdVend}
                className={inputClass}
              />
            </Campo>
            <Campo label="Punta compradora">
              <select
                value={usuarioIdComp}
                onChange={(e) => setUsuarioIdComp(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Comisión compradora">
              <input
                type="number"
                min={0}
                step="0.01"
                value={comisionComp}
                onChange={(e) => setComisionComp(e.target.value)}
                disabled={!usuarioIdComp}
                className={inputClass}
              />
            </Campo>
          </div>
        )}

        <Campo label="Observaciones">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={inputClass} rows={2} />
        </Campo>

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface disabled:text-muted';

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
