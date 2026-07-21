'use client';

import { EscenarioSchema, PlazoEstimadoSchema, type Escenario, type PlazoEstimado } from '@vacker/types';
import { fmtUSD } from '../../../lib/format';
import { Campo, inputClass } from './campo';

const ESCENARIOS = EscenarioSchema.options;
const PLAZOS = PlazoEstimadoSchema.options;

interface Sugerencia {
  minimo: number;
  recomendado: number;
  aspiracional: number;
}

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
  sugerencia: Sugerencia | null;
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
  sugerencia,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">5. Valores de tasación</h2>
      {sugerencia && (
        <div className="rounded-brand bg-surface px-3 py-2 text-xs text-muted">
          Sugerido según comparables: mínimo {fmtUSD(sugerencia.minimo)} · recomendado{' '}
          {fmtUSD(sugerencia.recomendado)} · aspiracional {fmtUSD(sugerencia.aspiracional)} — podés editar
          estos valores.
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
          <select
            value={plazoEstimado}
            onChange={(e) => setPlazoEstimado(e.target.value as PlazoEstimado | '')}
            className={inputClass}
          >
            <option value="">—</option>
            {PLAZOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>
      </div>
    </div>
  );
}
