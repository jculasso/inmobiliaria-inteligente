'use client';

import type { ComparableInput } from '@vacker/types';
import { ComparablesEditor } from '../comparables-editor';

interface Props {
  comparables: ComparableInput[];
  setComparables: (v: ComparableInput[]) => void;
}

export function Seccion4Comparables({ comparables, setComparables }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <ComparablesEditor comparables={comparables} onChange={setComparables} />
    </div>
  );
}
