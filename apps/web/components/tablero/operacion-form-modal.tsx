'use client';

import { useState, type FormEvent } from 'react';
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
import { fmtUSD } from '../../lib/format';
import { escribirImporte, leerImporte } from '../../lib/importe';
import { estadoLabel } from '../../lib/operacion-estado';
import { Campo, Seccion, inputClass } from '../form-ui';
import { InputImporte } from '../input-importe';
import { MensajeError } from '../piezas';

const ESTADOS_VENTA: EstadoVenta[] = ['escriturada', 'senada', 'reservada', 'boleto'];
const ESTADOS_ALQUILER: EstadoAlquiler[] = ['firmado', 'reservado', 'pendiente'];

/**
 * Un importe del formulario como número: vacío es 0, y lo que no se puede leer
 * es `NaN` (el submit lo frena con un aviso).
 *
 * Antes era `Number(texto) || 0` sobre un campo `type=number`: «200.000»
 * (como se escribe acá un precio) se guardaba 200, y lo ilegible se volvía 0
 * sin avisar. `leerImporte` es el mismo lector que usa Alquileres.
 */
function importe(texto: string): number {
  return leerImporte(texto) ?? 0;
}

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
  const [precio, setPrecio] = useState(escribirImporte(operacion?.precio));
  const [valorMensual, setValorMensual] = useState(escribirImporte(operacion?.valorMensual));
  const [comisionAlquiler, setComisionAlquiler] = useState(
    tipo === 'alquiler' ? escribirImporte(operacion?.comTotal) : '',
  );
  const [estado, setEstado] = useState(
    operacion?.estado ?? (tipo === 'venta' ? 'escriturada' : 'firmado'),
  );
  const [fechaReserva, setFechaReserva] = useState(operacion?.fechaReserva ?? '');
  const [fechaFirma, setFechaFirma] = useState(operacion?.fechaFirma ?? '');
  const [obs, setObs] = useState(operacion?.obs ?? '');
  const [usuarioIdVend, setUsuarioIdVend] = useState(puntaVendActual?.usuarioId ?? '');
  const [comisionVend, setComisionVend] = useState(escribirImporte(puntaVendActual?.comision));
  const [usuarioIdComp, setUsuarioIdComp] = useState(puntaCompActual?.usuarioId ?? '');
  const [comisionComp, setComisionComp] = useState(escribirImporte(puntaCompActual?.comision));

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
        comision: importe(comisionVend),
      });
    }
    if (usuarioIdComp) {
      puntas.push({
        lado: 'compradora',
        usuarioId: usuarioIdComp,
        comision: importe(comisionComp),
      });
    }

    const importes =
      tipo === 'venta'
        ? [
            precio,
            ...(usuarioIdVend ? [comisionVend] : []),
            ...(usuarioIdComp ? [comisionComp] : []),
          ]
        : [valorMensual, comisionAlquiler];
    const ilegible = importes.find((t) => Number.isNaN(importe(t)));
    if (ilegible !== undefined) {
      setError(`«${ilegible}» no es un importe. Escribilo con números, por ejemplo 200.000.`);
      return;
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
          precio: tipo === 'venta' ? importe(precio) : null,
          valorMensual: tipo === 'alquiler' ? importe(valorMensual) : null,
          comision: tipo === 'alquiler' ? importe(comisionAlquiler) : 0,
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
            ? { tipo, ...base, precio: importe(precio), estado: estado as EstadoVenta, puntas }
            : {
                tipo,
                ...base,
                valorMensual: importe(valorMensual),
                comision: importe(comisionAlquiler),
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
  // Mientras se escribe algo ilegible, el total no suma ese campo (no muestra NaN).
  const sumable = (t: string) => importe(t) || 0;
  const comisionTotal = esVenta
    ? (usuarioIdVend ? sumable(comisionVend) : 0) + (usuarioIdComp ? sumable(comisionComp) : 0)
    : sumable(comisionAlquiler);

  return (
    <Modal
      title={`${operacion ? 'Editar' : 'Nueva'} ${esVenta ? 'venta' : 'alquiler'}`}
      onClose={onClose}
      size="xl"
    >
      <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <Seccion titulo="Datos de la operación" icono={esVenta ? '🏠' : '🔑'} full>
          <div className="grid gap-2.5 sm:grid-cols-[140px_1fr]">
            <Campo label="Código">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                className={inputClass}
              />
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
                <InputImporte moneda="USD" value={precio} onChange={setPrecio} required />
              </Campo>
              <Campo label="Estado">
                <EstadoSelect value={estado} estados={estados} onChange={setEstado} />
              </Campo>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Campo label="Valor mensual">
                <InputImporte
                  moneda="USD"
                  value={valorMensual}
                  onChange={setValorMensual}
                  required
                />
              </Campo>
              <Campo label="Comisión">
                <InputImporte
                  moneda="USD"
                  value={comisionAlquiler}
                  onChange={setComisionAlquiler}
                />
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
              <input
                type="date"
                value={fechaReserva}
                onChange={(e) => setFechaReserva(e.target.value)}
                className={inputClass}
              />
            </Campo>
            <Campo label="Fecha de firma">
              <input
                type="date"
                value={fechaFirma}
                onChange={(e) => setFechaFirma(e.target.value)}
                className={inputClass}
              />
            </Campo>
          </div>
        </Seccion>

        {esVenta && (
          <Seccion titulo="Puntas y comisiones" icono="🤝" full>
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

        <Seccion titulo="Observaciones" icono="📝" full>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            placeholder="Notas internas (opcional)"
            className={inputClass}
          />
        </Seccion>

        <MensajeError className="rounded-brand bg-danger/10 px-3 py-2 sm:col-span-2">
          {error}
        </MensajeError>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 sm:col-span-2">
          <p className="text-sm text-muted">
            Comisión total: <span className="font-bold text-ink">{fmtUSD(comisionTotal)}</span>
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as EstadoVenta | EstadoAlquiler)}
      className={inputClass}
    >
      {estados.map((s) => (
        <option key={s} value={s}>
          {estadoLabel(s)}
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
      <select
        value={usuarioId}
        onChange={(e) => onUsuarioId(e.target.value)}
        className={inputClass}
      >
        <option value="">Sin asignar</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>
      <InputImporte
        moneda="USD"
        value={comision}
        onChange={onComision}
        disabled={!usuarioId}
        aria-label={`Comisión de la ${label.toLowerCase()}`}
        placeholder="0,00"
      />
    </div>
  );
}
