'use client';

import { EstrategiaAccionSchema } from '@vacker/types';
import { Campo, CheckPills, inputClass } from './campo';

const ESTRATEGIAS = EstrategiaAccionSchema.options;

interface Props {
  estrategia: string[];
  setEstrategia: (v: string[]) => void;
  observacionesEstrategia: string;
  setObservacionesEstrategia: (v: string) => void;
}

function toggle(lista: string[], setLista: (v: string[]) => void, valor: string) {
  setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
}

export function Seccion6Estrategia({
  estrategia,
  setEstrategia,
  observacionesEstrategia,
  setObservacionesEstrategia,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">6. Estrategia comercial</h2>
      <CheckPills
        label="Acciones"
        opciones={ESTRATEGIAS}
        valores={estrategia}
        onToggle={(v) => toggle(estrategia, setEstrategia, v)}
      />
      <Campo label="Observaciones de estrategia">
        <textarea
          value={observacionesEstrategia}
          onChange={(e) => setObservacionesEstrategia(e.target.value)}
          className={inputClass}
          rows={2}
        />
      </Campo>
    </div>
  );
}
