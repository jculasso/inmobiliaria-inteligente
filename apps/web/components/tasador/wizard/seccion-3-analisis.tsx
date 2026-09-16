'use client';

import {
  NivelSchema,
  PerfilCompradorSchema,
  aspectosDe,
  fortalezasDe,
  type Nivel,
  type PerfilComprador,
  type TipoPropiedad,
} from '@vacker/types';
import { useMemo, useState } from 'react';
import { Campo, PasoHeader, inputClass } from './campo';

const NIVELES = NivelSchema.options;
const PERFILES_COMPRADOR = PerfilCompradorSchema.options;

/** Arriba de esto aparece el buscador. */
const TOPE_SIN_PLEGAR = 24;

/**
 * Cuántas sin elegir se muestran antes del «ver todas».
 *
 * La lista pasó de 16 opciones a entre 24 y 59 según la tipología. En el
 * escritorio entran; en el teléfono —que es donde se tasa, parado adentro de la
 * propiedad— cada etiqueta ocupa su propio renglón y 59 son una pantalla y
 * media de scroll para llegar a «Demanda». Se muestran las primeras y el resto
 * se busca o se despliega.
 */
const VISIBLES_AL_PRINCIPIO = 12;

interface Props {
  /** De la sección 2. Define qué opciones se ofrecen acá. */
  tipoPropiedad: TipoPropiedad;
  fortalezas: string[];
  setFortalezas: (v: string[]) => void;
  aspectos: string[];
  setAspectos: (v: string[]) => void;
  demanda: Nivel | '';
  setDemanda: (v: Nivel | '') => void;
  competencia: Nivel | '';
  setCompetencia: (v: Nivel | '') => void;
  perfilComprador: PerfilComprador | '';
  setPerfilComprador: (v: PerfilComprador | '') => void;
  observacionesComerciales: string;
  setObservacionesComerciales: (v: string) => void;
}

function toggle(lista: string[], setLista: (v: string[]) => void, valor: string) {
  setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
}

/** Sin tildes ni mayúsculas, para que «balcon» encuentre «Balcón funcional». */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function Pill({
  valor,
  activo,
  onClick,
}: {
  valor: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        activo
          ? 'border-brand-red bg-brand-red/10 text-brand-red'
          : 'border-line text-muted hover:border-brand-red/40 hover:text-ink'
      }`}
    >
      {valor}
    </button>
  );
}

/**
 * Las etiquetas de una sección: primero lo elegido, después lo que ofrece el
 * catálogo para esta tipología.
 *
 * Lo elegido va arriba y SIEMPRE se muestra, aunque no esté en el catálogo. Es
 * lo que sostiene dos casos: las que el tasador escribió a mano, y las de una
 * tasación que se cargó como departamento y después se cambió a casa. En ningún
 * caso se pierde lo que alguien ya había marcado.
 */
function SeccionPills({
  label,
  ayuda,
  opciones,
  valores,
  setValores,
  etiquetaAgregar,
}: {
  label: string;
  ayuda: string;
  opciones: string[];
  valores: string[];
  setValores: (v: string[]) => void;
  etiquetaAgregar: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [texto, setTexto] = useState('');

  const delCatalogo = useMemo(() => new Set(opciones), [opciones]);
  const propias = valores.filter((v) => !delCatalogo.has(v));
  const sinElegir = useMemo(() => opciones.filter((o) => !valores.includes(o)), [opciones, valores]);

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return q ? sinElegir.filter((o) => normalizar(o).includes(q)) : sinElegir;
  }, [sinElegir, busqueda]);

  const elegidas = valores.filter((v) => delCatalogo.has(v));
  const conBuscador = opciones.length > TOPE_SIN_PLEGAR;
  // Buscar muestra todo lo que coincide: plegar ahí escondería justo lo que se
  // fue a buscar.
  const buscando = busqueda.trim().length > 0;
  const visibles = buscando || verTodas ? filtradas : filtradas.slice(0, VISIBLES_AL_PRINCIPIO);
  const ocultas = filtradas.length - visibles.length;

  function agregar() {
    const limpio = texto.trim();
    if (!limpio) return;
    if (!valores.some((v) => normalizar(v) === normalizar(limpio))) setValores([...valores, limpio]);
    setTexto('');
    setAgregando(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</span>
        <span className="text-[10px] text-muted">{ayuda}</span>
      </div>

      {(elegidas.length > 0 || propias.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {elegidas.map((v) => (
            <Pill key={v} valor={v} activo onClick={() => toggle(valores, setValores, v)} />
          ))}
          {propias.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed
              onClick={() => toggle(valores, setValores, v)}
              className="rounded-full border border-dashed border-brand-red bg-brand-red/10 px-3 py-1.5 text-xs font-semibold text-brand-red"
              title="Fuera de la lista de esta tipología"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {conBuscador && (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`Buscar entre ${opciones.length}…`}
          aria-label={`Buscar ${label.toLowerCase()}`}
          className={inputClass}
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {visibles.map((o) => (
          <Pill key={o} valor={o} activo={false} onClick={() => toggle(valores, setValores, o)} />
        ))}
        {filtradas.length === 0 && (
          <span className="py-1 text-xs text-muted">
            {buscando ? 'Nada con ese texto. Podés agregarla abajo.' : 'Ya elegiste todas las de la lista.'}
          </span>
        )}
        {ocultas > 0 && (
          <button
            type="button"
            onClick={() => setVerTodas(true)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red/40"
          >
            Ver las {ocultas} restantes
          </button>
        )}
        {verTodas && !buscando && (
          <button
            type="button"
            onClick={() => setVerTodas(false)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
          >
            Ver menos
          </button>
        )}
      </div>

      {agregando ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                agregar();
              }
              if (e.key === 'Escape') setAgregando(false);
            }}
            placeholder={etiquetaAgregar}
            aria-label={etiquetaAgregar}
            className={`${inputClass} max-w-xs`}
          />
          <button
            type="button"
            onClick={agregar}
            className="rounded-full border border-brand-red bg-brand-red/10 px-3 py-1.5 text-xs font-semibold text-brand-red"
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => setAgregando(false)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="self-start rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-muted hover:border-brand-red/40 hover:text-ink"
        >
          + {etiquetaAgregar}
        </button>
      )}
    </div>
  );
}

export function Seccion3Analisis({
  tipoPropiedad,
  fortalezas,
  setFortalezas,
  aspectos,
  setAspectos,
  demanda,
  setDemanda,
  competencia,
  setCompetencia,
  perfilComprador,
  setPerfilComprador,
  observacionesComerciales,
  setObservacionesComerciales,
}: Props) {
  const opcionesFortalezas = useMemo(() => fortalezasDe(tipoPropiedad), [tipoPropiedad]);
  const opcionesAspectos = useMemo(() => aspectosDe(tipoPropiedad), [tipoPropiedad]);
  const segunTipo = `Según el tipo: ${tipoPropiedad.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-4">
      <PasoHeader numero={3} titulo="Análisis comercial" bajada="Contexto de mercado y posicionamiento de la propiedad." />
      <SeccionPills
        label="Fortalezas"
        ayuda={segunTipo}
        opciones={opcionesFortalezas}
        valores={fortalezas}
        setValores={setFortalezas}
        etiquetaAgregar="Agregar fortaleza"
      />
      <SeccionPills
        label="Aspectos a considerar"
        ayuda={segunTipo}
        opciones={opcionesAspectos}
        valores={aspectos}
        setValores={setAspectos}
        etiquetaAgregar="Agregar aspecto"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <select
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value as Nivel | '')}
            className={inputClass}
          >
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
    </div>
  );
}
