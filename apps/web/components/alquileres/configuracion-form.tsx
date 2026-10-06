'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ConfiguracionAlquileres } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { guardarConfiguracionAlquileres } from '../../lib/alquileres-api';
import { Campo, inputClass } from '../form-ui';
import { InputPorcentaje } from '../input-importe';
import { fmtMoneda } from '../../lib/format';
import { fmtPct } from '../../lib/importe';
import { CLASE_FOCO, EncabezadoPagina, Panel } from './piezas';

/**
 * La configuración del módulo (Javier, 6/10/2026: «la comisión la podemos
 * dejar parametrizable», y el sellado). Es la propuesta que se ve al cargar
 * los cargos de ingreso de cada contrato; ahí todavía se puede ajustar.
 */
export function ConfiguracionForm({ inicial }: { inicial: ConfiguracionAlquileres }) {
  const [c, setC] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (x: Partial<ConfiguracionAlquileres>) => {
    setAviso(null);
    setC((v) => ({ ...v, ...x }));
  };

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      setC(await guardarConfiguracionAlquileres(await getAccessToken(), c));
      setAviso('Guardado. Se aplica a los cargos que se propongan desde ahora.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const ejemplo = 350_000 * 24 * (c.comisionInicialPct / 100) * (c.comisionInicialConIva ? 1 + c.ivaHonorariosPct / 100 : 1);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <EncabezadoPagina titulo="Configuración">
        <Link href="/alquileres/plantillas" className={`rounded text-sm font-semibold text-brand-red hover:underline ${CLASE_FOCO}`}>
          📝 Plantillas de contrato →
        </Link>
      </EncabezadoPagina>
      <Panel icono="💼" titulo="Comisión inicial">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="% del valor total del contrato">
            <InputPorcentaje valor={c.comisionInicialPct} onValor={(n) => cambiar({ comisionInicialPct: n })} />
          </Campo>
          <Campo label="En cuántas cuotas">
            <input type="number" min={1} max={12} className={inputClass} value={c.comisionInicialCuotas} onChange={(e) => cambiar({ comisionInicialCuotas: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })} />
          </Campo>
          <Campo label="IVA">
            <select className={inputClass} value={c.comisionInicialConIva ? 'si' : 'no'} onChange={(e) => cambiar({ comisionInicialConIva: e.target.value === 'si' })}>
              <option value="si">Más IVA ({fmtPct(c.ivaHonorariosPct)})</option>
              <option value="no">Sin IVA</option>
            </select>
          </Campo>
        </div>
        <p className="mt-2 text-xs text-muted">
          Ejemplo: un contrato de 24 meses a {fmtMoneda(350_000)} → {fmtMoneda(ejemplo)} en {c.comisionInicialCuotas}{' '}
          {c.comisionInicialCuotas === 1 ? 'cuota' : 'cuotas'}, a cargo del inquilino.
        </p>
      </Panel>
      <Panel icono="🧾" titulo="Sellado">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Alícuota sobre el valor total (%)" hint="0 = no se propone sellado.">
            <InputPorcentaje valor={c.selladoPct} onValor={(n) => cambiar({ selladoPct: n })} />
          </Campo>
          <Campo label="Lo paga el inquilino (%)" hint="El resto, el propietario.">
            {/* Como los otros porcentajes de la pantalla; sigue siendo de 0 a 100. */}
            <InputPorcentaje valor={c.selladoInquilinoPct} onValor={(n) => cambiar({ selladoInquilinoPct: Math.min(100, Math.max(0, n)) })} />
          </Campo>
        </div>
      </Panel>
      <Panel icono="🔐" titulo="Depósito en garantía">
        <Campo label="En los contratos nuevos">
          <select className={inputClass} value={c.depositoGestion} onChange={(e) => cambiar({ depositoGestion: e.target.value as ConfiguracionAlquileres['depositoGestion'] })}>
            <option value="entrega_propietario">Se le entrega al propietario</option>
            <option value="retiene_inmobiliaria">Lo retiene la inmobiliaria</option>
          </select>
        </Campo>
      </Panel>
      <Panel icono="🏢" titulo="IVA de la inmobiliaria">
        <Campo label="IVA sobre honorarios, gastos y comisión (%)" hint="21 si es responsable inscripta; 0 si es monotributista.">
          <InputPorcentaje valor={c.ivaHonorariosPct} onValor={(n) => cambiar({ ivaHonorariosPct: n })} />
        </Campo>
      </Panel>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink">
          {aviso}
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
