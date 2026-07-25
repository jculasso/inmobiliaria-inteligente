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
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createOperacion, updateOperacion } from '../../lib/tablero-api';

const ESTADOS_VENTA: EstadoVenta[] = ['escriturada', 'senada', 'reservada', 'boleto'];
const ESTADOS_ALQUILER: EstadoAlquiler[] = ['firmado', 'reservado', 'pendiente'];

/** Etiquetas legibles para el select de estado (la base guarda el enum en minúsculas). */
const ESTADO_LABEL: Record<string, string> = {
  escriturada: 'Escriturada',
  senada: 'Señada',
  reservada: 'Reservada',
  boleto: 'Boleto',
  firmado: 'Firmado',
  reservado: 'Reservado',
  pendiente: 'Pendiente',
};

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
  const [estado, setEstado] = useState(operacion?.estado ?? (tipo === 'venta' ? 'escriturada' : 'firmado'));
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
      puntas.push({ lado: 'vendedora', usuarioId: usuarioIdVend, comision: Number(comisionVend) || 0 });
    }
    if (usuarioIdComp) {
      puntas.push({ lado: 'compradora', usuarioId: usuarioIdComp, comision: Number(comisionComp) || 0 });
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

  const esVenta = tipo === 'venta';
  const estados = esVenta ? ESTADOS_VENTA : ESTADOS_ALQUILER;
  const comisionTotal = esVenta
    ? (usuarioIdVend ? Number(comisionVend) || 0 : 0) + (usuarioIdComp ? Number(comisionComp) || 0 : 0)
    : Number(comisionAlquiler) || 0;

  return (
    <Modal title={`${operacion ? 'Editar' : 'Nueva'} ${esVenta ? 'venta' : 'alquiler'}`} onClose={onClose} size="lg">
      <form className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
        <Seccion titulo="Datos de la operación" icono={esVenta ? '🏠' : '🔑'}>
          <div className="grid gap-2.5 sm:grid-cols-[140px_1fr]">
            <Campo label="Código">
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required className={inputClass} />
            </Campo>
            <Campo label="Dirección">
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                required
                placeholder="Calle y número, barrio"
                className={inputClass}
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Valor y estado" icono="💵">
          {esVenta ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Campo label="Precio">
                <MoneyInput value={precio} onChange={setPrecio} required />
              </Campo>
              <Campo label="Estado">
                <EstadoSelect value={estado} estados={estados} onChange={setEstado} />
              </Campo>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Campo label="Valor mensual">
                <MoneyInput value={valorMensual} onChange={setValorMensual} required />
              </Campo>
              <Campo label="Comisión">
                <MoneyInput value={comisionAlquiler} onChange={setComisionAlquiler} />
              </Campo>
              <Campo label="Estado">
                <EstadoSelect value={estado} estados={estados} onChange={setEstado} />
              </Campo>
            </div>
          )}
        </Seccion>

        <Seccion titulo="Fechas" icono="📅">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo label="Fecha de reserva">
              <input type="date" value={fechaReserva} onChange={(e) => setFechaReserva(e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Fecha de firma">
              <input type="date" value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} className={inputClass} />
            </Campo>
          </div>
        </Seccion>

        {esVenta && (
          <Seccion titulo="Puntas y comisiones" icono="🤝">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <PuntaCard
                label="Punta vendedora"
                usuarioId={usuarioIdVend}
                onUsuarioId={setUsuarioIdVend}
                comision={comisionVend}
                onComision={setComisionVend}
                vendedores={vendedores}
              />
              <PuntaCard
                label="Punta compradora"
                usuarioId={usuarioIdComp}
                onUsuarioId={setUsuarioIdComp}
                comision={comisionComp}
                onComision={setComisionComp}
                vendedores={vendedores}
              />
            </div>
          </Seccion>
        )}

        <Seccion titulo="Observaciones" icono="📝">
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            placeholder="Notas internas (opcional)"
            className={inputClass}
          />
        </Seccion>

        {error && (
          <p role="alert" className="rounded-brand bg-brand-red/10 px-3 py-2 text-sm font-medium text-brand-red">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-muted">
            Comisión total:{' '}
            <span className="font-bold text-ink">USD {comisionTotal.toLocaleString('es-AR')}</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface disabled:text-muted';

function Seccion({ titulo, icono, children }: { titulo: string; icono: string; children: ReactNode }) {
  return (
    <div className="rounded-brand border border-line bg-white px-3 py-2.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-red">
        <span aria-hidden>{icono}</span>
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

/** Input de monto con prefijo "USD" adentro. */
function MoneyInput({
  value,
  onChange,
  required,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
        USD
      </span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder="0"
        className={`${inputClass} pl-10`}
      />
    </div>
  );
}

function EstadoSelect({
  value,
  estados,
  onChange,
}: {
  value: string;
  estados: readonly string[];
  onChange: (v: EstadoVenta | EstadoAlquiler) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as EstadoVenta | EstadoAlquiler)} className={inputClass}>
      {estados.map((s) => (
        <option key={s} value={s}>
          {ESTADO_LABEL[s] ?? s}
        </option>
      ))}
    </select>
  );
}

/** Sub-tarjeta de una punta (vendedora/compradora): vendedor + su comisión. */
function PuntaCard({
  label,
  usuarioId,
  onUsuarioId,
  comision,
  onComision,
  vendedores,
}: {
  label: string;
  usuarioId: string;
  onUsuarioId: (v: string) => void;
  comision: string;
  onComision: (v: string) => void;
  vendedores: VendedorDto[];
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-brand border border-line bg-surface/40 p-2.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <select value={usuarioId} onChange={(e) => onUsuarioId(e.target.value)} className={inputClass}>
        <option value="">Sin asignar</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>
      <MoneyInput value={comision} onChange={onComision} disabled={!usuarioId} />
    </div>
  );
}
