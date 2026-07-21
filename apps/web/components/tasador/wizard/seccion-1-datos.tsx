'use client';

import type { TipoOperacion } from '@vacker/types';
import { Campo, inputClass } from './campo';

interface Props {
  cliente: string;
  setCliente: (v: string) => void;
  fecha: string;
  setFecha: (v: string) => void;
  tipoOperacion: TipoOperacion;
  setTipoOperacion: (v: TipoOperacion) => void;
  direccion: string;
  setDireccion: (v: string) => void;
  barrio: string;
  setBarrio: (v: string) => void;
  ciudad: string;
  setCiudad: (v: string) => void;
}

export function Seccion1Datos({
  cliente,
  setCliente,
  fecha,
  setFecha,
  tipoOperacion,
  setTipoOperacion,
  direccion,
  setDireccion,
  barrio,
  setBarrio,
  ciudad,
  setCiudad,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">1. Datos del informe</h2>
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
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} required className={inputClass} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Barrio">
          <input value={barrio} onChange={(e) => setBarrio(e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Ciudad">
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass} />
        </Campo>
      </div>
    </div>
  );
}
