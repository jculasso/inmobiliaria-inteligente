'use client';

import { useState, type ReactNode } from 'react';
import {
  EstadoInmuebleSchema,
  FuenteComparableSchema,
  TipoPrecioComparableSchema,
  TipoPropiedadSchema,
  type ComparableInput,
  type EstadoInmueble,
  type FuenteComparable,
  type TipoPrecioComparable,
  type TipoPropiedad,
} from '@vacker/types';
import { valuationSurface, type AnalisisComparables } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { fmtNum, fmtUSD } from '../../lib/format';
import { ConfianzaBadge } from './confianza-badge';

const TIPOS = TipoPropiedadSchema.options;
const FUENTES = FuenteComparableSchema.options;
const TIPOS_PRECIO = TipoPrecioComparableSchema.options;
const ESTADOS = EstadoInmuebleSchema.options;
const TIPOS_CON_TERRENO: TipoPropiedad[] = ['Casa', 'PH', 'Terreno'];

const COMPARABLE_VACIO: ComparableInput = {
  direccion: '',
  tipoComp: 'Departamento',
  superficie: 0,
  supCubierta: null,
  supSemi: null,
  supDescubierta: null,
  supTerreno: null,
  precio: 0,
  dormitorios: null,
  banos: null,
  cochera: false,
  estado: null,
  fuente: 'Publicación',
  tipoPrecio: 'Publicado',
  fechaReferencia: null,
  distanciaKm: null,
  link: '',
  observaciones: '',
};

interface Props {
  comparables: ComparableInput[];
  onChange: (comparables: ComparableInput[]) => void;
  /** Análisis (USD/m² ponderado, similitud por comparable, confianza) calculado en el wizard. */
  analisis: AnalisisComparables;
}

/** Editor de comparables (0, o entre 3 y 6). USD/m², similitud, ponderación y confianza en vivo. */
export function ComparablesEditor({ comparables, onChange, analisis }: Props) {
  function actualizar(i: number, cambios: Partial<ComparableInput>) {
    onChange(
      comparables.map((c, idx) => {
        if (idx !== i) return c;
        const next = { ...c, ...cambios };
        // La superficie de valuación se deriva del desglose (cubierta + semi + descubierta×0.3, o terreno según el tipo).
        next.superficie = valuationSurface(
          { supCubierta: next.supCubierta, supSemi: next.supSemi, supDescubierta: next.supDescubierta, supTerreno: next.supTerreno },
          next.tipoComp,
        );
        return next;
      }),
    );
  }
  // Acordeón: solo el comparable en edición queda expandido; el resto colapsa a
  // un renglón. Arranca todo colapsado (compacto); al agregar, se abre el nuevo.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function agregar() {
    if (comparables.length >= 6) return;
    onChange([...comparables, { ...COMPARABLE_VACIO }]);
    setOpenIndex(comparables.length);
  }
  function quitar(i: number) {
    onChange(comparables.filter((_, idx) => idx !== i));
    setOpenIndex((prev) => (prev == null ? null : prev === i ? null : prev > i ? prev - 1 : prev));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Comparables de mercado ({comparables.length}/6)</p>
        <Button type="button" variant="secondary" size="sm" onClick={agregar} disabled={comparables.length >= 6}>
          ＋ Agregar comparable
        </Button>
      </div>
      <p className="text-xs text-muted">
        Cargá entre 3 y 6 comparables. Los cierres reales pesan más; los valores atípicos se detectan automáticamente.
      </p>
      {comparables.length > 0 && comparables.length < 3 && (
        <p className="text-xs text-brand-red">Cargá al menos 3 comparables (o ninguno todavía).</p>
      )}

      {comparables.map((c, i) => {
        const entry = analisis.entries.find((e) => e.index === i);
        const badge = entry ? `${entry.similarity}% similitud${entry.outlier ? ' · atípico' : ''}` : 'Sin datos suficientes';
        const resumenFila = entry
          ? `${fmtUSD(entry.usdM2)}/m² · ${entry.similarity}%${entry.outlier ? ' · atípico' : ''}`
          : 'USD/m² —';

        // Colapsado: un renglón con dirección + USD/m² + similitud (click para editar).
        if (openIndex !== i) {
          return (
            <div key={i} className="flex items-center gap-2 rounded-brand border border-line px-3 py-2.5">
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold text-muted">Comparable {i + 1}</span>
                  <span className="truncate text-sm text-ink">{c.direccion || 'Sin dirección'}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand-red">{resumenFila}</span>
              </button>
              <button type="button" onClick={() => quitar(i)} className="shrink-0 text-xs text-brand-red hover:underline">
                × Quitar
              </button>
            </div>
          );
        }

        // Expandido: el formulario completo.
        return (
          <div key={i} className="flex flex-col gap-3 rounded-brand border border-brand-red/40 bg-brand-red/[0.015] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="text-xs font-semibold text-muted hover:text-ink"
              >
                ▴ Comparable {i + 1}
              </button>
              <span className="text-xs font-semibold text-brand-red">
                {entry ? `${fmtUSD(entry.usdM2)} /m² · ${badge}` : 'USD/m² —'}
              </span>
              <button type="button" onClick={() => quitar(i)} className="text-xs text-brand-red hover:underline">
                × Quitar
              </button>
            </div>

            <Campo label="Link de la publicación">
              <input value={c.link ?? ''} onChange={(e) => actualizar(i, { link: e.target.value })} placeholder="https://…" className={inputClass} />
            </Campo>
            <Campo label="Dirección / Zona">
              <input value={c.direccion} onChange={(e) => actualizar(i, { direccion: e.target.value })} placeholder="Zona o dirección" className={inputClass} />
            </Campo>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Campo label="Tipo">
                <select value={c.tipoComp} onChange={(e) => actualizar(i, { tipoComp: e.target.value as TipoPropiedad })} className={inputClass}>
                  {TIPOS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Fuente">
                <select value={c.fuente} onChange={(e) => actualizar(i, { fuente: e.target.value as FuenteComparable })} className={inputClass}>
                  {FUENTES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo de precio">
                <select value={c.tipoPrecio} onChange={(e) => actualizar(i, { tipoPrecio: e.target.value as TipoPrecioComparable })} className={inputClass}>
                  {TIPOS_PRECIO.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Campo label="Fecha de referencia">
                <input type="date" value={c.fechaReferencia ?? ''} onChange={(e) => actualizar(i, { fechaReferencia: e.target.value || null })} className={inputClass} />
              </Campo>
              <Campo label="Distancia aprox. (km)">
                <NumInput value={c.distanciaKm} onChange={(v) => actualizar(i, { distanciaKm: v })} placeholder="Ej: 0.8" />
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Campo label="Cubiertos (m²)">
                <NumInput value={c.supCubierta} onChange={(v) => actualizar(i, { supCubierta: v })} />
              </Campo>
              <Campo label="Semicubiertos (m²)">
                <NumInput value={c.supSemi} onChange={(v) => actualizar(i, { supSemi: v })} />
              </Campo>
              <Campo label="Descubiertos (m²)">
                <NumInput value={c.supDescubierta} onChange={(v) => actualizar(i, { supDescubierta: v })} />
              </Campo>
              {TIPOS_CON_TERRENO.includes(c.tipoComp) ? (
                <Campo label="Terreno (m²)">
                  <NumInput value={c.supTerreno} onChange={(v) => actualizar(i, { supTerreno: v })} />
                </Campo>
              ) : (
                <Campo label="m² de valuación">
                  <input readOnly tabIndex={-1} value={c.superficie > 0 ? fmtNum(c.superficie) : ''} placeholder="—" className={`${inputClass} bg-surface font-semibold text-muted`} />
                </Campo>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Campo label="Precio (USD)">
                <NumInput value={c.precio || null} onChange={(v) => actualizar(i, { precio: v ?? 0 })} placeholder="Ej: 120000" />
              </Campo>
              <Campo label="Dormitorios">
                <NumInput value={c.dormitorios} onChange={(v) => actualizar(i, { dormitorios: v })} />
              </Campo>
              <Campo label="Baños">
                <NumInput value={c.banos} onChange={(v) => actualizar(i, { banos: v })} />
              </Campo>
              <Campo label="Cochera">
                <select value={c.cochera ? 'Sí' : 'No'} onChange={(e) => actualizar(i, { cochera: e.target.value === 'Sí' })} className={inputClass}>
                  <option>No</option>
                  <option>Sí</option>
                </select>
              </Campo>
            </div>

            <Campo label="Estado">
              <select value={c.estado ?? ''} onChange={(e) => actualizar(i, { estado: (e.target.value || null) as EstadoInmueble | null })} className={inputClass}>
                <option value="">Seleccionar…</option>
                {ESTADOS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Observaciones">
              <input value={c.observaciones ?? ''} onChange={(e) => actualizar(i, { observaciones: e.target.value })} placeholder="Ej: reciclado a nuevo, sin cochera…" className={inputClass} />
            </Campo>
          </div>
        );
      })}

      {analisis.count > 0 && (
        <div className="rounded-brand border-l-[3px] border-brand-red bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Resumen automático</p>
            <ConfianzaBadge nivel={analisis.confidence} score={analisis.confidenceScore} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Comparables" valor={String(analisis.count)} />
            <Stat label="Precio mín." valor={fmtUSD(analisis.minPrice)} />
            <Stat label="Precio máx." valor={fmtUSD(analisis.maxPrice)} />
            <Stat label="Mediana USD/m²" valor={fmtUSD(analisis.medianUsdPerM2)} />
            <Stat label="Referencia ponderada" valor={fmtUSD(analisis.weightedUsdPerM2)} />
          </div>
          {analisis.outlierCount > 0 && (
            <p className="mt-2.5 text-[11.5px] text-muted">
              {analisis.outlierCount} comparable(s) atípico(s) reducido(s) en la ponderación. Dispersión:{' '}
              {fmtNum(analisis.spreadPct)}%.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Input numérico que mapea '' → null (para campos opcionales). */
function NumInput({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      placeholder={placeholder}
      className={inputClass}
    />
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{valor}</p>
    </div>
  );
}

const inputClass =
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red';
