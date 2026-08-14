'use client';

import type { ComparableInput } from '@vacker/types';
import type { AnalisisComparables, Coeficientes } from '@vacker/domain';
import { ComparablesEditor } from '../comparables-editor';
import { PasoHeader } from './campo';

interface Props {
  comparables: ComparableInput[];
  setComparables: (v: ComparableInput[]) => void;
  analisis: AnalisisComparables;
  coeficientes: Coeficientes;
}

export function Seccion4Comparables({ comparables, setComparables, analisis, coeficientes }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <PasoHeader
        numero={4}
        titulo="Comparables"
        bajada="Propiedades similares en venta que respaldan el valor propuesto."
      />
      <ComparablesEditor
        comparables={comparables}
        onChange={setComparables}
        analisis={analisis}
        coeficientes={coeficientes}
      />
    </div>
  );
}
