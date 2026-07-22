'use client';

import { EscenarioSchema, PlazoEstimadoSchema, type Escenario, type PlazoEstimado } from '@vacker/types';
import type { AnalisisComparables } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { fmtNum, fmtUSD } from '../../../lib/format';
import { ConfianzaBadge } from '../confianza-badge';
import { Campo, inputClass } from './campo';

const ESCENARIOS = EscenarioSchema.options;
const PLAZOS = PlazoEstimadoSchema.options;

const ESTRATEGIA_ESCENARIO: Record<Escenario, string> = {
  'Venta rápida': 'Estrategia orientada a maximizar la velocidad de cierre, priorizando un precio competitivo frente al mercado.',
  'Venta equilibrada': 'Estrategia balanceada entre velocidad de cierre y maximización del valor de venta.',
  'Venta aspiracional': 'Estrategia orientada a maximizar el valor obtenido, asumiendo plazos de comercialización más extensos.',
};

interface Props {
  valorMinimo: string;
  setValorMinimo: (v: string) => void;
  valorRecomendado: string;
  setValorRecomendado: (v: string) => void;
  valorAspiracional: string;
  setValorAspiracional: (v: string) => void;
  margenNegociacion: string;
  setMargenNegociacion: (v: string) => void;
  escenarioRecomendado: Escenario | '';
  setEscenarioRecomendado: (v: Escenario | '') => void;
  plazoEstimado: PlazoEstimado | '';
  setPlazoEstimado: (v: PlazoEstimado | '') => void;
  /** Análisis de comparables (referencia ponderada + confianza). */
  analisis: AnalisisComparables;
  /** Superficie total de valuación de la propiedad. */
  superficieTotal: number;
}

export function Seccion5Valores({
  valorMinimo,
  setValorMinimo,
  valorRecomendado,
  setValorRecomendado,
  valorAspiracional,
  setValorAspiracional,
  margenNegociacion,
  setMargenNegociacion,
  escenarioRecomendado,
  setEscenarioRecomendado,
  plazoEstimado,
  setPlazoEstimado,
  analisis,
  superficieTotal,
}: Props) {
  const basisM2 = analisis.weightedUsdPerM2 || analisis.medianUsdPerM2 || analisis.avgUsdPerM2;
  const aspSugerido = superficieTotal > 0 && basisM2 > 0 ? Math.round(superficieTotal * basisM2) : 0;
  const recSugerido = aspSugerido ? Math.round(aspSugerido * 0.94) : 0;
  const minSugerido = aspSugerido ? Math.round(aspSugerido * 0.9) : 0;

  function aplicarSugeridos() {
    if (!aspSugerido) return;
    setValorMinimo(String(minSugerido));
    setValorRecomendado(String(recSugerido));
    setValorAspiracional(String(aspSugerido));
  }

  const min = Number(valorMinimo) || 0;
  const rec = Number(valorRecomendado) || 0;
  const asp = Number(valorAspiracional) || 0;
  const diffPct = min && asp ? (((asp - min) / min) * 100).toFixed(1) : null;
  const comentario = escenarioRecomendado ? ESTRATEGIA_ESCENARIO[escenarioRecomendado] : '';

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">5. Valores de tasación</h2>
      <p className="text-xs text-muted">Definí el rango de valores y el escenario de comercialización.</p>

      {/* Cálculo sugerido */}
      <div className="rounded-brand border border-line border-l-[3px] border-l-brand-red bg-brand-red/[0.03] p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-red">Cálculo sugerido de valores</p>
        {aspSugerido ? (
          <div className="text-[12.5px] leading-relaxed text-ink">
            <div>
              Aspiracional = Sup. de valuación <strong>{fmtNum(superficieTotal)} m²</strong> × referencia ponderada{' '}
              <strong>{fmtUSD(basisM2)}</strong> = <strong className="text-brand-red">{fmtUSD(aspSugerido)}</strong>
            </div>
            <div>
              Recomendado (−6%): <strong>{fmtUSD(recSugerido)}</strong> · Mínimo (−10%): <strong>{fmtUSD(minSugerido)}</strong>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" size="sm" onClick={aplicarSugeridos}>
                Aplicar valores sugeridos
              </Button>
              <ConfianzaBadge nivel={analisis.confidence} score={analisis.confidenceScore} />
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">
            Completá la superficie y al menos un comparable válido para obtener una referencia automática.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Valor mínimo competitivo (USD)">
          <input type="number" min={0} value={valorMinimo} onChange={(e) => setValorMinimo(e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Valor recomendado (USD) *">
          <input type="number" min={0} value={valorRecomendado} onChange={(e) => setValorRecomendado(e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Valor aspiracional (USD)">
          <input type="number" min={0} value={valorAspiracional} onChange={(e) => setValorAspiracional(e.target.value)} className={inputClass} />
        </Campo>
      </div>

      {/* Vista previa del rango */}
      {(min || rec || asp) > 0 && (
        <div className="rounded-brand bg-surface p-5">
          <p className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">Vista previa del rango</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-muted">Mínimo</div>
              <div className="text-lg font-bold text-ink">{fmtUSD(min)}</div>
            </div>
            <div className="relative h-1 min-w-[100px] max-w-[220px] flex-1 rounded bg-line">
              <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-red" />
            </div>
            <div className="text-center">
              <div className="text-[11px] font-bold text-brand-red">RECOMENDADO</div>
              <div className="text-[22px] font-extrabold text-brand-red">{fmtUSD(rec)}</div>
            </div>
            <div className="h-1 min-w-[100px] max-w-[220px] flex-1 rounded bg-line" />
            <div>
              <div className="text-[11px] text-muted">Aspiracional</div>
              <div className="text-lg font-bold text-ink">{fmtUSD(asp)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Margen de negociación estimado (%)">
          <input type="number" min={0} value={margenNegociacion} onChange={(e) => setMargenNegociacion(e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Escenario recomendado">
          <select value={escenarioRecomendado} onChange={(e) => setEscenarioRecomendado(e.target.value as Escenario | '')} className={inputClass}>
            <option value="">—</option>
            {ESCENARIOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Plazo estimado de venta">
          <select value={plazoEstimado} onChange={(e) => setPlazoEstimado(e.target.value as PlazoEstimado | '')} className={inputClass}>
            <option value="">Seleccionar…</option>
            {PLAZOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {diffPct && (
        <p className="mt-1 text-center text-[12.5px] text-muted">
          Diferencia entre valor mínimo y aspiracional: <strong className="text-ink">{diffPct}%</strong>
        </p>
      )}
      {comentario && <p className="text-center text-[12.5px] italic text-ink">{comentario}</p>}
    </div>
  );
}
