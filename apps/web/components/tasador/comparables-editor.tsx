'use client';

import { EstadoInmuebleSchema, type ComparableInput, type EstadoInmueble } from '@vacker/types';
import { promedioUsdM2, usdM2 } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';

const ESTADOS_INMUEBLE = EstadoInmuebleSchema.options;

const COMPARABLE_VACIO: ComparableInput = {
  direccion: '',
  superficie: 0,
  precio: 0,
  dormitorios: null,
  banos: null,
  cochera: false,
  estado: null,
  link: '',
  observaciones: '',
};

interface Props {
  comparables: ComparableInput[];
  onChange: (comparables: ComparableInput[]) => void;
}

/** Editor de comparables de mercado (0, o entre 3 y 6). USD/m² y promedio calculados en vivo. */
export function ComparablesEditor({ comparables, onChange }: Props) {
  // Resumen automático (mismo criterio que el prototipo): solo comparables con
  // precio y superficie cargados.
  const validos = comparables.filter((c) => c.superficie > 0 && c.precio > 0);
  const precios = validos.map((c) => c.precio);
  const resumen = {
    count: validos.length,
    minPrecio: precios.length ? Math.min(...precios) : 0,
    maxPrecio: precios.length ? Math.max(...precios) : 0,
    avgPrecio: precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0,
    promedioUsdM2: promedioUsdM2(validos),
  };

  function actualizar(i: number, cambios: Partial<ComparableInput>) {
    onChange(comparables.map((c, idx) => (idx === i ? { ...c, ...cambios } : c)));
  }

  function agregar() {
    if (comparables.length >= 6) return;
    onChange([...comparables, { ...COMPARABLE_VACIO }]);
  }

  function quitar(i: number) {
    onChange(comparables.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          4. Comparables de mercado ({comparables.length}/6)
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={agregar} disabled={comparables.length >= 6}>
          ＋ Agregar comparable
        </Button>
      </div>

      {comparables.length > 0 && comparables.length < 3 && (
        <p className="text-xs text-brand-red">Cargá al menos 3 comparables (o ninguno todavía).</p>
      )}

      {comparables.map((c, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-brand border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Comparable {i + 1}</span>
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar comparable"
              className="text-xs text-brand-red hover:underline"
            >
              Quitar
            </button>
          </div>
          <input
            value={c.direccion}
            onChange={(e) => actualizar(i, { direccion: e.target.value })}
            placeholder="Dirección"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="number"
              min={0}
              step="0.01"
              value={c.superficie || ''}
              onChange={(e) => actualizar(i, { superficie: Number(e.target.value) || 0 })}
              placeholder="Superficie (m²)"
              className={inputClass}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={c.precio || ''}
              onChange={(e) => actualizar(i, { precio: Number(e.target.value) || 0 })}
              placeholder="Precio (USD)"
              className={inputClass}
            />
            <div className="flex h-9 items-center rounded-brand bg-surface px-2.5 text-sm text-muted">
              USD/m²: {c.superficie > 0 ? fmtUSD(usdM2(c)) : '—'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="number"
              min={0}
              value={c.dormitorios ?? ''}
              onChange={(e) => actualizar(i, { dormitorios: e.target.value ? Number(e.target.value) : null })}
              placeholder="Dormitorios"
              className={inputClass}
            />
            <input
              type="number"
              min={0}
              value={c.banos ?? ''}
              onChange={(e) => actualizar(i, { banos: e.target.value ? Number(e.target.value) : null })}
              placeholder="Baños"
              className={inputClass}
            />
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" checked={c.cochera} onChange={(e) => actualizar(i, { cochera: e.target.checked })} />
              Cochera
            </label>
          </div>
          <select
            value={c.estado ?? ''}
            onChange={(e) => actualizar(i, { estado: (e.target.value || null) as EstadoInmueble | null })}
            className={inputClass}
          >
            <option value="">Estado — seleccionar...</option>
            {ESTADOS_INMUEBLE.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input
            value={c.link ?? ''}
            onChange={(e) => actualizar(i, { link: e.target.value })}
            placeholder="Link (opcional)"
            className={inputClass}
          />
          <input
            value={c.observaciones ?? ''}
            onChange={(e) => actualizar(i, { observaciones: e.target.value })}
            placeholder="Observaciones (opcional)"
            className={inputClass}
          />
        </div>
      ))}

      {resumen.count > 0 && (
        <div className="rounded-brand border-l-[3px] border-brand-red bg-surface p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">Resumen automático</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Comparables" valor={String(resumen.count)} />
            <Stat label="Precio mín." valor={fmtUSD(resumen.minPrecio)} />
            <Stat label="Precio máx." valor={fmtUSD(resumen.maxPrecio)} />
            <Stat label="Precio promedio" valor={fmtUSD(resumen.avgPrecio)} />
            <Stat label="USD/m² promedio" valor={fmtUSD(resumen.promedioUsdM2)} />
          </div>
        </div>
      )}
    </div>
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
