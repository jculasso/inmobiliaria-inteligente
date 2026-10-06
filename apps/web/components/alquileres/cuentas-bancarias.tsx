'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CuentaBancariaInputSchema,
  type CuentaBancariaDto,
  type CuentaBancariaInput,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { guardarCuentasBancarias } from '../../lib/alquileres-api';
import { Campo, inputClass } from '../form-ui';
import { CLASE_FOCO, Insignia, Panel } from './piezas';

type Fila = Required<Pick<CuentaBancariaInput, 'banco' | 'tipo' | 'moneda' | 'principal'>> & {
  numero: string;
  cbu: string;
  alias: string;
  titular: string;
  cuitTitular: string;
};
const vacia = (): Fila => ({
  banco: '',
  tipo: 'caja_ahorro',
  moneda: 'ARS',
  numero: '',
  cbu: '',
  alias: '',
  titular: '',
  cuitTitular: '',
  principal: false,
});
const deDto = (c: CuentaBancariaDto): Fila => ({
  ...c,
  numero: c.numero ?? '',
  cbu: c.cbu ?? '',
  alias: c.alias ?? '',
  titular: c.titular ?? '',
  cuitTitular: c.cuitTitular ?? '',
});

/** «0110 5995 2000 0001 2345 65»: el CBU en bloques, para leerlo y dictarlo. */
const cbuLegible = (cbu: string) => cbu.replace(/(\d{4})(?=\d)/g, '$1 ');

/**
 * Las cuentas bancarias de la persona (Gexion, «Gestión administrativa»): a
 * dónde se le transfiere al propietario. CBU y alias se validan antes de
 * guardar; un CBU mal copiado es plata transferida a otro.
 */
export function CuentasBancarias({
  personaId,
  cuentas,
}: {
  personaId: string;
  cuentas: CuentaBancariaDto[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [filas, setFilas] = useState<Fila[]>(cuentas.map(deDto));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (i: number, c: Partial<Fila>) =>
    setFilas((xs) =>
      xs.map((x, j) => (j === i ? { ...x, ...c } : c.principal ? { ...x, principal: false } : x)),
    );

  async function guardar() {
    setError(null);
    for (const [i, f] of filas.entries()) {
      const r = CuentaBancariaInputSchema.safeParse(f);
      if (!r.success) {
        setError(`Cuenta ${i + 1}: ${r.error.issues[0]?.message ?? 'revisá los datos.'}`);
        return;
      }
    }
    setGuardando(true);
    try {
      await guardarCuentasBancarias(await getAccessToken(), personaId, filas);
      setEditando(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Panel
      icono="🏦"
      titulo="Cuentas bancarias"
      derecha={
        !editando && (
          <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
            {cuentas.length ? '✏️ Editar' : '＋ Agregar cuentas'}
          </Button>
        )
      }
    >
      {!editando ? (
        cuentas.length === 0 ? (
          <p className="text-sm text-muted">
            Sin cuentas cargadas. Para liquidarle a un propietario por transferencia, cargá su CBU o
            alias.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cuentas.map((c) => (
              <li key={c.id} className="rounded-brand border border-line px-3 py-2 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {c.banco} · {c.tipo === 'caja_ahorro' ? 'Caja de ahorro' : 'Cuenta corriente'} en{' '}
                  {c.moneda === 'ARS' ? 'pesos' : 'dólares'}
                  {c.principal && <Insignia tono="exito">Principal</Insignia>}
                </p>
                <p className="text-muted">
                  {c.cbu && <span className="mr-3 tabular-nums">CBU {cbuLegible(c.cbu)}</span>}
                  {c.alias && <span className="mr-3">Alias {c.alias}</span>}
                  {c.titular && <span>Titular {c.titular}</span>}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {filas.map((f, i) => (
            <fieldset
              key={i}
              className="grid gap-2 rounded-brand border border-line p-3 sm:grid-cols-4"
            >
              <Campo label="Banco" requerido>
                <input
                  className={inputClass}
                  value={f.banco}
                  onChange={(e) => cambiar(i, { banco: e.target.value })}
                />
              </Campo>
              <Campo label="Tipo">
                <select
                  className={inputClass}
                  value={f.tipo}
                  onChange={(e) => cambiar(i, { tipo: e.target.value as Fila['tipo'] })}
                >
                  <option value="caja_ahorro">Caja de ahorro</option>
                  <option value="cuenta_corriente">Cuenta corriente</option>
                </select>
              </Campo>
              <Campo label="Moneda">
                <select
                  className={inputClass}
                  value={f.moneda}
                  onChange={(e) => cambiar(i, { moneda: e.target.value as Fila['moneda'] })}
                >
                  <option value="ARS">Pesos</option>
                  <option value="USD">Dólares</option>
                </select>
              </Campo>
              <Campo label="Número de cuenta">
                <input
                  className={inputClass}
                  value={f.numero}
                  onChange={(e) => cambiar(i, { numero: e.target.value })}
                />
              </Campo>
              <div className="sm:col-span-2">
                <Campo label="CBU" hint="22 números; se controlan los dígitos verificadores.">
                  <input
                    className={inputClass}
                    value={f.cbu}
                    onChange={(e) => cambiar(i, { cbu: e.target.value })}
                    inputMode="numeric"
                  />
                </Campo>
              </div>
              <Campo label="Alias">
                <input
                  className={inputClass}
                  value={f.alias}
                  onChange={(e) => cambiar(i, { alias: e.target.value })}
                />
              </Campo>
              <Campo label="Titular">
                <input
                  className={inputClass}
                  value={f.titular}
                  onChange={(e) => cambiar(i, { titular: e.target.value })}
                />
              </Campo>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-4">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="principal"
                    className="h-4 w-4 accent-brand-red"
                    checked={f.principal}
                    onChange={() => cambiar(i, { principal: true })}
                  />
                  Principal: a esta se le transfiere
                </label>
                <button
                  type="button"
                  onClick={() => setFilas((xs) => xs.filter((_, j) => j !== i))}
                  className={`rounded px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5 ${CLASE_FOCO}`}
                >
                  🗑️ Quitar
                </button>
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilas((xs) => [...xs, { ...vacia(), principal: xs.length === 0 }])}
            >
              ＋ Agregar cuenta
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilas(cuentas.map(deDto));
                  setEditando(false);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
