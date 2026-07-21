'use client';

import {
  AspectoSchema,
  FortalezaSchema,
  NivelSchema,
  PerfilCompradorSchema,
  type Nivel,
  type PerfilComprador,
} from '@vacker/types';
import { Campo, CheckPills, inputClass } from './campo';

const FORTALEZAS = FortalezaSchema.options;
const ASPECTOS = AspectoSchema.options;
const NIVELES = NivelSchema.options;
const PERFILES_COMPRADOR = PerfilCompradorSchema.options;

interface Props {
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

export function Seccion3Analisis({
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
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">3. Análisis comercial</h2>
      <CheckPills
        label="Fortalezas"
        opciones={FORTALEZAS}
        valores={fortalezas}
        onToggle={(v) => toggle(fortalezas, setFortalezas, v)}
      />
      <CheckPills
        label="Aspectos a considerar"
        opciones={ASPECTOS}
        valores={aspectos}
        onToggle={(v) => toggle(aspectos, setAspectos, v)}
      />
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
