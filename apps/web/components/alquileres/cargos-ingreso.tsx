'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CargoIngresoSchema,
  type CargoIngreso,
  type CargosIngresoDto,
  type EstadoContrato,
  type MonedaAlquiler,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cargarCargosIngreso } from '../../lib/alquileres-api';
import { fmtMoneda, hoyIso } from '../../lib/format';
import { inputClass } from '../form-ui';
import { CLASE_FOCO, Panel } from './piezas';
import { InputImporteNumero } from '../input-importe';

const TIPO: Record<CargoIngreso['tipo'], string> = {
  comision: 'Comisión',
  informe: 'Informe',
  deposito: 'Depósito',
  sellado: 'Sellado',
};

/**
 * Los cargos de ingreso (punto 7 de Javier): comisión sobre el valor total en
 * cuotas, informes de garantía, depósito y sellado. Se proponen con la
 * configuración de la inmobiliaria, se revisan y se cargan una vez; después se
 * cobran desde Cobros como cualquier concepto.
 */
export function CargosIngreso({
  contratoId,
  estado,
  moneda,
  cargos,
}: {
  contratoId: string;
  estado: EstadoContrato;
  moneda: MonedaAlquiler;
  cargos: CargosIngresoDto;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<CargoIngreso[]>(cargos.propuesta);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const cambiar = (i: number, c: Partial<CargoIngreso>) =>
    setFilas((xs) => xs.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const hoy = hoyIso();

  async function cargar() {
    setError(null);
    for (const [i, f] of filas.entries()) {
      const r = CargoIngresoSchema.safeParse(f);
      if (!r.success) {
        setError(`Fila ${i + 1}: ${r.error.issues[0]?.message ?? 'revisá los datos.'}`);
        return;
      }
    }
    setCargando(true);
    try {
      await cargarCargosIngreso(await getAccessToken(), contratoId, filas);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar.');
      setCargando(false);
    }
  }

  const detalle =
    cargos.valorTotal > 0
      ? `valor total ${fmtMoneda(cargos.valorTotal, moneda)} · ${cargos.meses} meses`
      : undefined;
  if (cargos.cargados) {
    return (
      <Panel icono="💼" titulo="Cargos de ingreso">
        <p className="text-sm text-ink">
          ✅ Cargados. Se cobran desde Cobros y aparecen en la cuenta de cada uno y en Conceptos.
        </p>
      </Panel>
    );
  }
  if (estado !== 'vigente') {
    return (
      <Panel icono="💼" titulo="Cargos de ingreso">
        <p className="text-sm text-muted">
          {estado === 'borrador'
            ? 'Se cargan al activar el contrato: comisión, informes, depósito y sellado, con la configuración de la inmobiliaria.'
            : 'El contrato no está vigente.'}
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      icono="💼"
      titulo={
        <>
          Cargos de ingreso
          {detalle && <span className="font-normal normal-case tracking-normal"> · {detalle}</span>}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          La propuesta sale de la configuración (⚙️ Configuración). Revisala, sumá los informes de
          garantía y cargala: se cobra desde Cobros.
        </p>
        <ul className="flex flex-col gap-2">
          {filas.map((f, i) => (
            // En una fila recién desde `lg`: entre 640 y 760 px las seis columnas no entraban y la fila se salía de la tarjeta.
            <li
              key={i}
              className="grid gap-2 rounded-brand border border-line p-2 sm:grid-cols-2 sm:items-center lg:grid-cols-[6rem_1fr_9rem_9rem_9rem_auto]"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                {TIPO[f.tipo]}
              </span>
              <input
                aria-label="Descripción"
                className={inputClass}
                value={f.descripcion}
                onChange={(e) => cambiar(i, { descripcion: e.target.value })}
              />
              <select
                aria-label="A cargo de"
                className={inputClass}
                value={f.aCargoDe}
                onChange={(e) =>
                  cambiar(i, { aCargoDe: e.target.value as CargoIngreso['aCargoDe'] })
                }
              >
                <option value="inquilino">Inquilino</option>
                <option value="propietario">Propietario</option>
              </select>
              <InputImporteNumero
                aria-label="Importe"
                moneda={f.moneda ?? moneda}
                valor={f.importe}
                onValor={(n) => cambiar(i, { importe: n ?? 0 })}
              />
              <input
                aria-label="Vence"
                type="date"
                className={inputClass}
                value={f.vencimiento}
                onChange={(e) => cambiar(i, { vencimiento: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setFilas((xs) => xs.filter((_, j) => j !== i))}
                className={`justify-self-end rounded px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5 ${CLASE_FOCO}`}
              >
                🗑️ Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setFilas((xs) => [
                ...xs,
                {
                  tipo: 'informe',
                  descripcion: 'Informe de garantía',
                  aCargoDe: 'inquilino',
                  importe: 0,
                  vencimiento: hoy,
                  moneda: null,
                },
              ])
            }
          >
            ＋ Informe de garantía
          </Button>
          <span className="text-sm text-muted">
            Total:{' '}
            <span className="font-bold tabular-nums text-ink">
              {fmtMoneda(
                filas
                  .filter((f) => !f.moneda || f.moneda === moneda)
                  .reduce((s, f) => s + f.importe, 0),
                moneda,
              )}
            </span>
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={cargar}
            disabled={cargando || filas.length === 0}
          >
            {cargando ? 'Cargando…' : 'Cargar los cargos'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
