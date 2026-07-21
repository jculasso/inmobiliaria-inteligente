'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AspectoSchema,
  EscenarioSchema,
  EstrategiaAccionSchema,
  FortalezaSchema,
  NivelSchema,
  PerfilCompradorSchema,
  PlazoEstimadoSchema,
  TipoPropiedadSchema,
  type Aspecto,
  type ComparableInput,
  type Escenario,
  type EstrategiaAccion,
  type Fortaleza,
  type Nivel,
  type PerfilComprador,
  type PlazoEstimado,
  type TasacionDto,
  type TasacionFotoDto,
  type TipoOperacion,
  type TipoPropiedad,
} from '@vacker/types';
import { promedioUsdM2, superficieTotal, valoresSugeridos } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTasacion, updateTasacion } from '../../lib/tasador-api';
import { fmtNum, fmtUSD } from '../../lib/format';
import { Modal } from '../tablero/modal';
import { ComparablesEditor } from './comparables-editor';
import { FotosUploader } from './fotos-uploader';

const TIPOS_PROPIEDAD = TipoPropiedadSchema.options;
const NIVELES = NivelSchema.options;
const PERFILES_COMPRADOR = PerfilCompradorSchema.options;
const ESCENARIOS = EscenarioSchema.options;
const PLAZOS = PlazoEstimadoSchema.options;
const FORTALEZAS = FortalezaSchema.options;
const ASPECTOS = AspectoSchema.options;
const ESTRATEGIAS = EstrategiaAccionSchema.options;

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

  // Sección 3 — Análisis comercial
  const [fortalezas, setFortalezas] = useState<string[]>(tasacion?.analisisComercial?.fortalezas ?? []);
  const [aspectos, setAspectos] = useState<string[]>(tasacion?.analisisComercial?.aspectos ?? []);
  const [demanda, setDemanda] = useState<Nivel | ''>(tasacion?.analisisComercial?.demanda ?? '');
  const [competencia, setCompetencia] = useState<Nivel | ''>(tasacion?.analisisComercial?.competencia ?? '');
  const [perfilComprador, setPerfilComprador] = useState<PerfilComprador | ''>(
    tasacion?.analisisComercial?.perfilComprador ?? '',
  );
  const [observacionesComerciales, setObservacionesComerciales] = useState(
    tasacion?.analisisComercial?.observacionesComerciales ?? '',
  );

  // Fotos (se suben directo a Storage — requieren que la tasación ya exista)
  const [fotos, setFotos] = useState<TasacionFotoDto[]>(tasacion?.fotos ?? []);

  // Comparables
  const [comparables, setComparables] = useState<ComparableInput[]>(
    tasacion?.comparables.map(({ usdM2: _usdM2, ...c }) => c) ?? [],
  );

  // Sección 5 — Valores
  const [valorMinimo, setValorMinimo] = useState(String(tasacion?.valorMinimo ?? ''));
  const [valorRecomendado, setValorRecomendado] = useState(String(tasacion?.valorRecomendado ?? ''));
  const [valorAspiracional, setValorAspiracional] = useState(String(tasacion?.valorAspiracional ?? ''));
  const [margenNegociacion, setMargenNegociacion] = useState(String(tasacion?.margenNegociacion ?? ''));
  const [escenarioRecomendado, setEscenarioRecomendado] = useState<Escenario | ''>(
    tasacion?.escenarioRecomendado ?? '',
  );
  const [plazoEstimado, setPlazoEstimado] = useState<PlazoEstimado | ''>(tasacion?.plazoEstimado ?? '');

  // Sección 6 — Estrategia comercial
  const [estrategia, setEstrategia] = useState<string[]>(tasacion?.estrategiaComercial?.estrategia ?? []);
  const [observacionesEstrategia, setObservacionesEstrategia] = useState(
    tasacion?.estrategiaComercial?.observacionesEstrategia ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const superficieTotalPreview = superficieTotal({
    cubierta: Number(supCubierta) || 0,
    semicubierta: Number(supSemicubierta) || 0,
    descubierta: Number(supDescubierta) || 0,
  });

  const sugerencia = useMemo(() => {
    const validos = comparables.filter((c) => c.superficie > 0 && c.precio > 0);
    if (validos.length < 3) return null;
    return valoresSugeridos(superficieTotalPreview, promedioUsdM2(validos));
  }, [comparables, superficieTotalPreview]);

  function toggle(lista: string[], setLista: (v: string[]) => void, valor: string) {
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

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
        comparables: comparables.length > 0 ? comparables : undefined,
        analisisComercial: {
          fortalezas: fortalezas as Fortaleza[],
          aspectos: aspectos as Aspecto[],
          demanda: demanda || null,
          competencia: competencia || null,
          perfilComprador: perfilComprador || null,
          observacionesComerciales: observacionesComerciales || null,
        },
        valorMinimo: valorMinimo ? Number(valorMinimo) : null,
        valorRecomendado: valorRecomendado ? Number(valorRecomendado) : null,
        valorAspiracional: valorAspiracional ? Number(valorAspiracional) : null,
        margenNegociacion: margenNegociacion ? Number(margenNegociacion) : null,
        escenarioRecomendado: escenarioRecomendado || null,
        plazoEstimado: plazoEstimado || null,
        estrategiaComercial: {
          estrategia: estrategia as EstrategiaAccion[],
          observacionesEstrategia: observacionesEstrategia || null,
        },
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

        {tasacion ? (
          <FotosUploader tasacionId={tasacion.id} fotos={fotos} onChange={setFotos} />
        ) : (
          <p className="text-xs text-muted">Podés cargar fotos una vez que guardes la tasación por primera vez.</p>
        )}

        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">3. Análisis comercial</p>
        <CheckPills label="Fortalezas" opciones={FORTALEZAS} valores={fortalezas} onToggle={(v) => toggle(fortalezas, setFortalezas, v)} />
        <CheckPills label="Aspectos a considerar" opciones={ASPECTOS} valores={aspectos} onToggle={(v) => toggle(aspectos, setAspectos, v)} />
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Demanda">
            <select value={demanda} onChange={(e) => setDemanda(e.target.value as Nivel | '')} className={inputClass}>
              <option value="">—</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Competencia">
            <select value={competencia} onChange={(e) => setCompetencia(e.target.value as Nivel | '')} className={inputClass}>
              <option value="">—</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Perfil de comprador">
            <select
              value={perfilComprador}
              onChange={(e) => setPerfilComprador(e.target.value as PerfilComprador | '')}
              className={inputClass}
            >
              <option value="">—</option>
              {PERFILES_COMPRADOR.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo label="Observaciones comerciales">
          <textarea
            value={observacionesComerciales}
            onChange={(e) => setObservacionesComerciales(e.target.value)}
            className={inputClass}
            rows={2}
          />
        </Campo>

        <ComparablesEditor comparables={comparables} onChange={setComparables} />

        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">5. Valores de tasación</p>
        {sugerencia && (
          <div className="rounded-brand bg-surface px-3 py-2 text-xs text-muted">
            Sugerido según comparables: mínimo {fmtUSD(sugerencia.minimo)} · recomendado{' '}
            {fmtUSD(sugerencia.recomendado)} · aspiracional {fmtUSD(sugerencia.aspiracional)} — podés
            editar estos valores.
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Valor mínimo (USD)">
            <input
              type="number"
              min={0}
              value={valorMinimo}
              onChange={(e) => setValorMinimo(e.target.value)}
              placeholder={sugerencia ? String(Math.round(sugerencia.minimo)) : undefined}
              className={inputClass}
            />
          </Campo>
          <Campo label="Valor recomendado (USD)">
            <input
              type="number"
              min={0}
              value={valorRecomendado}
              onChange={(e) => setValorRecomendado(e.target.value)}
              placeholder={sugerencia ? String(Math.round(sugerencia.recomendado)) : undefined}
              className={inputClass}
            />
          </Campo>
          <Campo label="Valor aspiracional (USD)">
            <input
              type="number"
              min={0}
              value={valorAspiracional}
              onChange={(e) => setValorAspiracional(e.target.value)}
              placeholder={sugerencia ? String(Math.round(sugerencia.aspiracional)) : undefined}
              className={inputClass}
            />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Margen de negociación (%)">
            <input
              type="number"
              min={0}
              value={margenNegociacion}
              onChange={(e) => setMargenNegociacion(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Escenario recomendado">
            <select
              value={escenarioRecomendado}
              onChange={(e) => setEscenarioRecomendado(e.target.value as Escenario | '')}
              className={inputClass}
            >
              <option value="">—</option>
              {ESCENARIOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Plazo estimado">
            <select value={plazoEstimado} onChange={(e) => setPlazoEstimado(e.target.value as PlazoEstimado | '')} className={inputClass}>
              <option value="">—</option>
              {PLAZOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">6. Estrategia comercial</p>
        <CheckPills label="Acciones" opciones={ESTRATEGIAS} valores={estrategia} onToggle={(v) => toggle(estrategia, setEstrategia, v)} />
        <Campo label="Observaciones de estrategia">
          <textarea
            value={observacionesEstrategia}
            onChange={(e) => setObservacionesEstrategia(e.target.value)}
            className={inputClass}
            rows={2}
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

function CheckPills({
  label,
  opciones,
  valores,
  onToggle,
}: {
  label: string;
  opciones: readonly string[];
  valores: string[];
  onToggle: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              valores.includes(o)
                ? 'border-brand-red bg-brand-red/10 text-brand-red'
                : 'border-line text-muted hover:border-brand-red/40'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
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
