'use client';

import {
  AptoCreditoSchema,
  DisposicionSchema,
  DocumentacionSchema,
  EstadoInmuebleSchema,
  OrientacionSchema,
  TipoPropiedadSchema,
  type AptoCredito,
  type Disposicion,
  type Documentacion,
  type EstadoInmueble,
  type Orientacion,
  type TasacionFotoDto,
  type TipoPropiedad,
} from '@vacker/types';
import { fmtNum } from '../../../lib/format';
import { FotosUploader } from '../fotos-uploader';
import { Campo, inputClass } from './campo';

const TIPOS_PROPIEDAD = TipoPropiedadSchema.options;
const ESTADOS_INMUEBLE = EstadoInmuebleSchema.options;
const DISPOSICIONES = DisposicionSchema.options;
const ORIENTACIONES = OrientacionSchema.options;
const DOCUMENTACIONES = DocumentacionSchema.options;
const APTOS_CREDITO = AptoCreditoSchema.options;

interface Props {
  tipoPropiedad: TipoPropiedad;
  setTipoPropiedad: (v: TipoPropiedad) => void;
  supCubierta: string;
  setSupCubierta: (v: string) => void;
  supSemicubierta: string;
  setSupSemicubierta: (v: string) => void;
  supDescubierta: string;
  setSupDescubierta: (v: string) => void;
  superficieTotalPreview: number;
  supTerreno: string;
  setSupTerreno: (v: string) => void;
  dormitorios: string;
  setDormitorios: (v: string) => void;
  banos: string;
  setBanos: (v: string) => void;
  toilette: string;
  setToilette: (v: string) => void;
  ambientes: string;
  setAmbientes: (v: string) => void;
  antiguedad: string;
  setAntiguedad: (v: string) => void;
  disposicion: Disposicion | '';
  setDisposicion: (v: Disposicion | '') => void;
  orientacion: Orientacion | '';
  setOrientacion: (v: Orientacion | '') => void;
  estadoInmueble: EstadoInmueble | '';
  setEstadoInmueble: (v: EstadoInmueble | '') => void;
  cochera: boolean;
  setCochera: (v: boolean) => void;
  balcon: boolean;
  setBalcon: (v: boolean) => void;
  terraza: boolean;
  setTerraza: (v: boolean) => void;
  patio: boolean;
  setPatio: (v: boolean) => void;
  lavadero: boolean;
  setLavadero: (v: boolean) => void;
  piscina: boolean;
  setPiscina: (v: boolean) => void;
  amenities: string;
  setAmenities: (v: string) => void;
  detalleAmenities: string;
  setDetalleAmenities: (v: string) => void;
  expensas: string;
  setExpensas: (v: string) => void;
  aptoCredito: AptoCredito | '';
  setAptoCredito: (v: AptoCredito | '') => void;
  documentacion: Documentacion | '';
  setDocumentacion: (v: Documentacion | '') => void;
  tasacionId: string | null;
  fotos: TasacionFotoDto[];
  setFotos: (fotos: TasacionFotoDto[]) => void;
}

export function Seccion2Caracteristicas(props: Props) {
  const {
    tipoPropiedad,
    setTipoPropiedad,
    supCubierta,
    setSupCubierta,
    supSemicubierta,
    setSupSemicubierta,
    supDescubierta,
    setSupDescubierta,
    superficieTotalPreview,
    supTerreno,
    setSupTerreno,
    dormitorios,
    setDormitorios,
    banos,
    setBanos,
    toilette,
    setToilette,
    ambientes,
    setAmbientes,
    antiguedad,
    setAntiguedad,
    disposicion,
    setDisposicion,
    orientacion,
    setOrientacion,
    estadoInmueble,
    setEstadoInmueble,
    cochera,
    setCochera,
    balcon,
    setBalcon,
    terraza,
    setTerraza,
    patio,
    setPatio,
    lavadero,
    setLavadero,
    piscina,
    setPiscina,
    amenities,
    setAmenities,
    detalleAmenities,
    setDetalleAmenities,
    expensas,
    setExpensas,
    aptoCredito,
    setAptoCredito,
    documentacion,
    setDocumentacion,
    tasacionId,
    fotos,
    setFotos,
  } = props;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">2. Características del inmueble</h2>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <span className="font-bold text-brand-red">{fmtNum(superficieTotalPreview)} m²</span>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <input type="number" min={0} value={banos} onChange={(e) => setBanos(e.target.value)} className={inputClass} />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <select
            value={disposicion}
            onChange={(e) => setDisposicion(e.target.value as Disposicion | '')}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {DISPOSICIONES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Orientación">
          <select
            value={orientacion}
            onChange={(e) => setOrientacion(e.target.value as Orientacion | '')}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {ORIENTACIONES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo label="Estado del inmueble">
        <select
          value={estadoInmueble}
          onChange={(e) => setEstadoInmueble(e.target.value as EstadoInmueble | '')}
          className={inputClass}
        >
          <option value="">Seleccionar...</option>
          {ESTADOS_INMUEBLE.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:grid-cols-3">
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

      <Campo label="Amenities">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Expensas (ARS)">
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
          <select
            value={aptoCredito}
            onChange={(e) => setAptoCredito(e.target.value as AptoCredito | '')}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {APTOS_CREDITO.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo label="Documentación">
        <select
          value={documentacion}
          onChange={(e) => setDocumentacion(e.target.value as Documentacion | '')}
          className={inputClass}
        >
          <option value="">Seleccionar...</option>
          {DOCUMENTACIONES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Campo>

      {tasacionId ? (
        <FotosUploader tasacionId={tasacionId} fotos={fotos} onChange={setFotos} />
      ) : (
        <p className="text-xs text-muted">Podés cargar fotos una vez que guardes esta sección.</p>
      )}
    </div>
  );
}
