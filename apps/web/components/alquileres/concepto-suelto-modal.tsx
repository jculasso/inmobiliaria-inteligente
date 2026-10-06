'use client';

import { useState, type FormEvent } from 'react';
import type { ConceptoSueltoInput, ContratoResumenDto, TipoConceptoSuelto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { crearConceptoSuelto } from '../../lib/alquileres-api';
import { Campo, inputClass } from '../form-ui';
import { leerImporte } from '../../lib/importe';
import { InputImporte } from '../input-importe';

export const NOMBRE_TIPO_SUELTO: Record<TipoConceptoSuelto, string> = {
  expensa: 'Expensas',
  impuesto: 'Impuesto',
  servicio: 'Servicio',
  reparacion: 'Reparación',
  otro: 'Otro',
};

type Parte = 'inquilino' | 'propietario';
type Pagador = 'nadie' | 'inmobiliaria' | Parte;

/**
 * Un gasto suelto de un contrato (regla 14): expensas, impuestos, servicios,
 * reparaciones. Se dice quién lo debe y, si alguien ya lo pagó, quién.
 */
export function ConceptoSueltoModal({
  contratos,
  periodo,
  onClose,
  onSaved,
}: {
  contratos: ContratoResumenDto[];
  periodo: string;
  onClose: () => void;
  onSaved: (n: number) => void;
}) {
  // Los que tienen cuenta: no un borrador ni uno anulado.
  const vigentes = contratos.filter((c) => c.estado !== 'borrador' && c.estado !== 'anulado');
  const [contratoId, setContratoId] = useState(vigentes[0]?.id ?? '');
  const [tipo, setTipo] = useState<TipoConceptoSuelto>('expensa');
  const [aCargoDe, setACargoDe] = useState<Parte>('inquilino');
  const [pagadoPor, setPagadoPor] = useState<Pagador>('nadie');
  const [importe, setImporte] = useState('');
  const [vencimiento, setVencimiento] = useState(`${periodo}-10`);
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const otra: Parte = aCargoDe === 'inquilino' ? 'propietario' : 'inquilino';

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const monto = leerImporte(importe) ?? Number.NaN;
    if (!(monto > 0)) {
      setError('Cargá el importe.');
      return;
    }
    const dto: ConceptoSueltoInput = {
      contratoId,
      tipo,
      aCargoDe,
      pagadoPor,
      importe: monto,
      vencimiento,
      periodo,
      descripcion,
    };
    setGuardando(true);
    try {
      const creados = await crearConceptoSuelto(await getAccessToken(), dto);
      onSaved(creados.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  return (
    <Modal title="Gasto suelto" onClose={onClose}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <Campo label="Contrato" requerido>
          <select
            className={inputClass}
            value={contratoId}
            onChange={(e) => setContratoId(e.target.value)}
            required
          >
            {vigentes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.propiedad.direccion}
                {c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Tipo">
            <select
              className={inputClass}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoConceptoSuelto)}
            >
              {Object.entries(NOMBRE_TIPO_SUELTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Importe" requerido>
            <InputImporte
              moneda={vigentes.find((c) => c.id === contratoId)?.moneda ?? 'ARS'}
              value={importe}
              onChange={setImporte}
            />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Lo debe">
            <select
              className={inputClass}
              value={aCargoDe}
              onChange={(e) => {
                const v = e.target.value as Parte;
                setACargoDe(v);
                if (pagadoPor === v) setPagadoPor('nadie');
              }}
            >
              <option value="inquilino">El inquilino</option>
              <option value="propietario">El propietario</option>
            </select>
          </Campo>
          <Campo
            label="Ya lo pagó"
            hint={pagadoPor === otra ? `Se le reconoce al ${otra} en su cuenta.` : undefined}
          >
            <select
              className={inputClass}
              value={pagadoPor}
              onChange={(e) => setPagadoPor(e.target.value as Pagador)}
            >
              <option value="nadie">Nadie todavía</option>
              <option value="inmobiliaria">La inmobiliaria</option>
              <option value={otra}>El {otra}</option>
            </select>
          </Campo>
        </div>
        <Campo label="Vence">
          <input
            type="date"
            className={inputClass}
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value)}
            required
          />
        </Campo>
        <Campo label="Descripción" requerido={tipo === 'otro'}>
          <input
            className={inputClass}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej.: arreglo del calefón"
          />
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={guardando || !contratoId}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
