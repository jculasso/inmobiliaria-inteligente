import type { ResumenAlquileres } from '@vacker/types';
import { KpiCard } from '@vacker/ui';
import { fmtNum } from '../../lib/format';

/**
 * La cartera en números. Es el lugar del tablero del módulo (entrega 8); por
 * ahora muestra lo que hay cargado.
 */
export function ResumenCartera({ resumen }: { resumen: ResumenAlquileres }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label="Contratos vigentes" value={fmtNum(resumen.contratosVigentes)} sub={`de ${fmtNum(resumen.contratos)} cargados`} tone="brand" />
      <KpiCard label="Personas" value={fmtNum(resumen.personas)} />
      <KpiCard label="Propiedades" value={fmtNum(resumen.propiedades)} />
    </div>
  );
}
