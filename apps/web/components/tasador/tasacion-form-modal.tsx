'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { TipoPropiedadSchema, type TasacionDto, type TipoOperacion, type TipoPropiedad } from '@vacker/types';
import { superficieTotal } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTasacion, updateTasacion } from '../../lib/tasador-api';
import { fmtNum } from '../../lib/format';
import { Modal } from '../tablero/modal';

const TIPOS_PROPIEDAD = TipoPropiedadSchema.options;

interface Props {
  tasacion?: TasacionDto;
  onClose: () => void;
  onSaved: () => void;
}

export function TasacionFormModal({ tasacion, onClose, onSaved }: Props) {
  const [cliente, setCliente] = useState(tasacion?.cliente ?? '');
  const [fecha, setFecha] = useState(tasacion?.fecha ?? new Date().toISOString().slice(0, 10));
  const [direccion, setDireccion] = useState(tasacion?.direccion ?? '');
  const [barrio, setBarrio] = useState(tasacion?.barrio ?? '');
  const [ciudad, setCiudad] = useState(tasacion?.ciudad ?? '');
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>(tasacion?.tipoOperacion ?? 'venta');

  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad>(tasacion?.tipoPropiedad ?? 'Departamento');
  const [supCubierta, setSupCubierta] = useState(String(tasacion?.supCubierta ?? ''));
  const [supSemicubierta, setSupSemicubierta] = useState(String(tasacion?.supSemicubierta ?? ''));
  const [supDescubierta, setSupDescubierta] = useState(String(tasacion?.supDescubierta ?? ''));
  const [supTerreno, setSupTerreno] = useState(String(tasacion?.supTerreno ?? ''));
  const [dormitorios, setDormitorios] = useState(String(tasacion?.dormitorios ?? ''));
  const [banos, setBanos] = useState(String(tasacion?.banos ?? ''));
  const [toilette, setToilette] = useState(String(tasacion?.toilette ?? ''));
  const [ambientes, setAmbientes] = useState(String(tasacion?.ambientes ?? ''));
  const [antiguedad, setAntiguedad] = useState(String(tasacion?.antiguedad ?? ''));
  const [estadoInmueble, setEstadoInmueble] = useState(tasacion?.estadoInmueble ?? '');
  const [disposicion, setDisposicion] = useState(tasacion?.disposicion ?? '');
  const [orientacion, setOrientacion] = useState(tasacion?.orientacion ?? '');
  const [cochera, setCochera] = useState(tasacion?.cochera ?? false);
  const [balcon, setBalcon] = useState(tasacion?.balcon ?? false);
  const [terraza, setTerraza] = useState(tasacion?.terraza ?? false);
  const [patio, setPatio] = useState(tasacion?.patio ?? false);
  const [lavadero, setLavadero] = useState(tasacion?.lavadero ?? false);
  const [piscina, setPiscina] = useState(tasacion?.piscina ?? false);
  const [amenities, setAmenities] = useState(tasacion?.amenities.join(', ') ?? '');
  const [detalleAmenities, setDetalleAmenities] = useState(tasacion?.detalleAmenities ?? '');
  const [expensas, setExpensas] = useState(String(tasacion?.expensas ?? ''));
  const [aptoCredito, setAptoCredito] = useState(tasacion?.aptoCredito ?? '');
  const [documentacion, setDocumentacion] = useState(tasacion?.documentacion ?? '');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const preview = superficieTotal({
    cubierta: Number(supCubierta) || 0,
    semicubierta: Number(supSemicubierta) || 0,
    descubierta: Number(supDescubierta) || 0,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const dto = {
        cliente,
        fecha,
        direccion,
        barrio: barrio || null,
        ciudad: ciudad || null,
        tipoOperacion,
        tipoPropiedad,
        supCubierta: Number(supCubierta) || 0,
        supSemicubierta: Number(supSemicubierta) || 0,
        supDescubierta: Number(supDescubierta) || 0,
        supTerreno: supTerreno ? Number(supTerreno) : null,
        dormitorios: dormitorios ? Number(dormitorios) : null,
        banos: banos ? Number(banos) : null,
        toilette: toilette ? Number(toilette) : null,
        ambientes: ambientes ? Number(ambientes) : null,
        antiguedad: antiguedad ? Number(antiguedad) : null,
        estadoInmueble: estadoInmueble || null,
        disposicion: disposicion || null,
        orientacion: orientacion || null,
        cochera,
        balcon,
        terraza,
        patio,
        lavadero,
        piscina,
        amenities: amenities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        detalleAmenities: detalleAmenities || null,
        expensas: expensas ? Number(expensas) : null,
        aptoCredito: aptoCredito || null,
        documentacion: documentacion || null,
      };

      if (tasacion) {
        await updateTasacion(accessToken, tasacion.id, dto);
      } else {
        await createTasacion(accessToken, dto);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tasación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={tasacion ? 'Editar tasación' : 'Nueva tasación'} onClose={onClose}>
      <form className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1" onSubmit={handleSubmit}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">1. Datos del informe</p>
        <Campo label="Cliente">
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} required className={inputClass} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={inputClass}
            />
          </Campo>
          <Campo label="Tipo de operación">
            <select
              value={tipoOperacion}
              onChange={(e) => setTipoOperacion(e.target.value as TipoOperacion)}
              className={inputClass}
            >
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </select>
          </Campo>
        </div>
        <Campo label="Dirección">
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
            className={inputClass}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Barrio">
            <input value={barrio} onChange={(e) => setBarrio(e.target.value)} className={inputClass} />
          </Campo>
          <Campo label="Ciudad">
            <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass} />
          </Campo>
        </div>

        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
          2. Características del inmueble
        </p>
        <Campo label="Tipo de propiedad">
          <select
            value={tipoPropiedad}
            onChange={(e) => setTipoPropiedad(e.target.value as TipoPropiedad)}
            className={inputClass}
          >
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Sup. cubierta (m²)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={supCubierta}
              onChange={(e) => setSupCubierta(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Sup. semicubierta (m²)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={supSemicubierta}
              onChange={(e) => setSupSemicubierta(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Sup. descubierta (m²)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={supDescubierta}
              onChange={(e) => setSupDescubierta(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>
        <div className="rounded-brand bg-surface px-3 py-2 text-sm">
          <span className="font-medium text-ink">Superficie total: </span>
          <span className="font-bold text-brand-red">{fmtNum(preview)} m²</span>
          <span className="ml-1 text-xs text-muted">(cubierta + semicubierta + 30% descubierta)</span>
        </div>
        <Campo label="Sup. terreno (m²)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={supTerreno}
            onChange={(e) => setSupTerreno(e.target.value)}
            className={inputClass}
          />
        </Campo>

        <div className="grid grid-cols-4 gap-3">
          <Campo label="Dormitorios">
            <input
              type="number"
              min={0}
              value={dormitorios}
              onChange={(e) => setDormitorios(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Baños">
            <input
              type="number"
              min={0}
              value={banos}
              onChange={(e) => setBanos(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Toilette">
            <input
              type="number"
              min={0}
              value={toilette}
              onChange={(e) => setToilette(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Ambientes">
            <input
              type="number"
              min={0}
              value={ambientes}
              onChange={(e) => setAmbientes(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Campo label="Antigüedad (años)">
            <input
              type="number"
              min={0}
              value={antiguedad}
              onChange={(e) => setAntiguedad(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Disposición">
            <input value={disposicion} onChange={(e) => setDisposicion(e.target.value)} className={inputClass} />
          </Campo>
          <Campo label="Orientación">
            <input value={orientacion} onChange={(e) => setOrientacion(e.target.value)} className={inputClass} />
          </Campo>
        </div>
        <Campo label="Estado del inmueble">
          <input
            value={estadoInmueble}
            onChange={(e) => setEstadoInmueble(e.target.value)}
            className={inputClass}
          />
        </Campo>

        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          {(
            [
              ['Cochera', cochera, setCochera],
              ['Balcón', balcon, setBalcon],
              ['Terraza', terraza, setTerraza],
              ['Patio', patio, setPatio],
              ['Lavadero', lavadero, setLavadero],
              ['Piscina', piscina, setPiscina],
            ] as [string, boolean, (v: boolean) => void][]
          ).map(([label, value, setValue]) => (
            <label key={label} className="flex items-center gap-1.5 text-ink">
              <input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        <Campo label="Amenities (separados por coma)">
          <input value={amenities} onChange={(e) => setAmenities(e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Detalle de amenities">
          <textarea
            value={detalleAmenities}
            onChange={(e) => setDetalleAmenities(e.target.value)}
            className={inputClass}
            rows={2}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Expensas (USD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={expensas}
              onChange={(e) => setExpensas(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Apto crédito">
            <input value={aptoCredito} onChange={(e) => setAptoCredito(e.target.value)} className={inputClass} />
          </Campo>
        </div>
        <Campo label="Documentación">
          <input
            value={documentacion}
            onChange={(e) => setDocumentacion(e.target.value)}
            className={inputClass}
          />
        </Campo>

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 mt-2 flex justify-end gap-2 bg-white pt-2">
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
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red';

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
