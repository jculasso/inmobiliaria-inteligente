'use client';

import type { ComparableInput } from '@vacker/types';
import type { AnalisisComparables } from '@vacker/domain';
import { ComparablesEditor } from '../comparables-editor';

interface Props {
  comparables: ComparableInput[];
  setComparables: (v: ComparableInput[]) => void;
  analisis: AnalisisComparables;
}

export function Seccion4Comparables({ comparables, setComparables, analisis }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <ComparablesEditor comparables={comparables} onChange={setComparables} analisis={analisis} />
    </div>
  );
}
