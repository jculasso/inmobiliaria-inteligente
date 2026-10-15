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
 *
 * Desde el 15/10/2026 también lo que se propone en cada contrato nuevo
 * (regla 99) y el sellado por tipo de contrato (regla 103), pedidos por
 * Florencia (Vacker).
 */
/** Un día de vencimiento: de 1 a 28, para que exista en todos los meses. */
const diaDelMes = (texto: string) => Math.min(28, Math.max(1, Math.round(Number(texto)) || 1));

/** Regla 133: los días para pagar la diferencia de la liquidación final, de 0 a 60. */
const diasDeLaDiferencia = (texto: string) =>
  Math.min(60, Math.max(0, Math.round(Number(texto)) || 0));

/**
 * El día se acomoda entre 1 y 28 al salir del campo, no en cada tecla: si no,
 * borrar el 5 para escribir 10 dejaba un 1 y terminaba en 28. `acomodar`
 * cambia el rango (los días de la diferencia van de 0 a 60).
 */
function InputDia({
  valor,
  onValor,
  acomodar = diaDelMes,
}: {
  valor: number;
  onValor: (n: number) => void;
  acomodar?: (texto: string) => number;
}) {
  const [texto, setTexto] = useState(String(valor));
  return (
    <input
      type="text"
      inputMode="numeric"
      className={inputClass}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        if (e.target.value.trim()) onValor(acomodar(e.target.value));
      }}
      onBlur={() => setTexto(String(acomodar(texto)))}
    />
  );
}

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
      setAviso('Guardado. Se aplica a los contratos y cargos que se carguen desde ahora.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const ejemplo =
    350_000 *
    24 *
    (c.comisionInicialPct / 100) *
    (c.comisionInicialConIva ? 1 + c.ivaHonorariosPct / 100 : 1);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <EncabezadoPagina titulo="Configuración">
        <Link
          href="/alquileres/plantillas"
          className={`rounded text-sm font-semibold text-brand-red hover:underline ${CLASE_FOCO}`}
        >
          📝 Plantillas de contrato y de reserva →
        </Link>
      </EncabezadoPagina>
      <Panel icono="💼" titulo="Comisión inicial">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="% del valor total del contrato">
            <InputPorcentaje
              valor={c.comisionInicialPct}
              onValor={(n) => cambiar({ comisionInicialPct: n })}
            />
          </Campo>
          <Campo label="En cuántas cuotas">
            <input
              type="number"
              min={1}
              max={12}
              className={inputClass}
              value={c.comisionInicialCuotas}
              onChange={(e) =>
                cambiar({
                  comisionInicialCuotas: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
          </Campo>
          <Campo label="IVA">
            <select
              className={inputClass}
              value={c.comisionInicialConIva ? 'si' : 'no'}
              onChange={(e) => cambiar({ comisionInicialConIva: e.target.value === 'si' })}
            >
              <option value="si">Más IVA ({fmtPct(c.ivaHonorariosPct)})</option>
              <option value="no">Sin IVA</option>
            </select>
          </Campo>
        </div>
        <p className="mt-2 text-xs text-muted">
          Ejemplo: un contrato de 24 meses a {fmtMoneda(350_000)} → {fmtMoneda(ejemplo)} en{' '}
          {c.comisionInicialCuotas} {c.comisionInicialCuotas === 1 ? 'cuota' : 'cuotas'}, a cargo
          del inquilino.
        </p>
      </Panel>
      <Panel icono="📝" titulo="Contratos nuevos">
        <p className="mb-3 text-sm text-muted">
          Lo que se propone al cargar un contrato. Cada contrato lo puede cambiar; los ya cargados
          no cambian.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo label="Honorarios (%)" hint="Al propietario, más IVA.">
            <InputPorcentaje
              valor={c.contratoHonorariosPct}
              onValor={(n) => cambiar({ contratoHonorariosPct: n })}
            />
          </Campo>
          <Campo label="Gastos adm. (%)" hint="Al inquilino, más IVA.">
            <InputPorcentaje
              valor={c.contratoGastosAdmPct}
              onValor={(n) => cambiar({ contratoGastosAdmPct: n })}
            />
          </Campo>
          <Campo label="Punitorio diario (%)" hint="Desde el día siguiente al vencimiento.">
            <InputPorcentaje
              valor={c.contratoPunitorioDiarioPct}
              onValor={(n) => cambiar({ contratoPunitorioDiarioPct: n })}
            />
          </Campo>
          <Campo label="Vence el día" hint="Inquilino. Del 1 al 28.">
            <InputDia
              valor={c.contratoDiaVencimiento}
              onValor={(n) => cambiar({ contratoDiaVencimiento: n })}
            />
          </Campo>
          <Campo label="Se paga el día" hint="Propietario. Del 1 al 28.">
            <InputDia
              valor={c.contratoDiaPagoPropietario}
              onValor={(n) => cambiar({ contratoDiaPagoPropietario: n })}
            />
          </Campo>
        </div>
        <p className="mt-2 text-xs text-muted">
          Si el vencimiento cae sábado, domingo o feriado nacional, se corre al siguiente día hábil.
        </p>
      </Panel>
      <Panel icono="🧾" titulo="Sellado">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Particular (%)" hint="0 = exento.">
            <InputPorcentaje
              valor={c.selladoViviendaPct}
              onValor={(n) => cambiar({ selladoViviendaPct: n })}
            />
          </Campo>
          <Campo label="Comercial (%)" hint="Inquilino sin certificado MiPyme.">
            <InputPorcentaje
              valor={c.selladoComercialPct}
              onValor={(n) => cambiar({ selladoComercialPct: n })}
            />
          </Campo>
          <Campo label="Comercial MiPyme (%)" hint="Inquilino con certificado MiPyme.">
            <InputPorcentaje
              valor={c.selladoComercialMipymePct}
              onValor={(n) => cambiar({ selladoComercialMipymePct: n })}
            />
          </Campo>
          <Campo label="Lo paga el inquilino (%)" hint="El resto, el propietario.">
            {/* Como los otros porcentajes de la pantalla; sigue siendo de 0 a 100. */}
            <InputPorcentaje
              valor={c.selladoInquilinoPct}
              onValor={(n) => cambiar({ selladoInquilinoPct: Math.min(100, Math.max(0, n)) })}
            />
          </Campo>
        </div>
        <p className="mt-2 text-xs text-muted">
          Sobre el valor total del contrato. Se propone al cargar los cargos de ingreso, y ahí se
          puede ajustar.
        </p>
      </Panel>
      <Panel icono="🔐" titulo="Depósito en garantía">
        <Campo label="En los contratos nuevos">
          <select
            className={inputClass}
            value={c.depositoGestion}
            onChange={(e) =>
              cambiar({
                depositoGestion: e.target.value as ConfiguracionAlquileres['depositoGestion'],
              })
            }
          >
            <option value="entrega_propietario">Se le entrega al propietario</option>
            <option value="retiene_inmobiliaria">Lo retiene la inmobiliaria</option>
          </select>
        </Campo>
      </Panel>
      {/* Regla 133 (Florencia, Vacker, 15/10/2026): el IPC sale atrasado. */}
      <Panel icono="🧮" titulo="Liquidación final">
        <Campo
          label="Días para pagar la diferencia de la liquidación final"
          hint="Cuando sale el índice y se confirma, la diferencia de los meses cobrados como parcial vence a estos días (corrida al siguiente día hábil). Antes no hay punitorio."
        >
          <InputDia
            valor={c.diasDiferenciaFinal}
            onValor={(n) => cambiar({ diasDiferenciaFinal: n })}
            acomodar={diasDeLaDiferencia}
          />
        </Campo>
      </Panel>
      {/* Regla 171 (Florencia, Vacker, 15/10/2026): la seña retenida se le entrega al propietario. */}
      <Panel icono="🔖" titulo="Reservas">
        <Campo
          label="Honorarios sobre la seña retenida (%)"
          hint="Si la reserva se cae, la seña se le entrega al propietario en su liquidación; con 0, entera. Se le suma el IVA de la inmobiliaria."
        >
          <InputPorcentaje
            valor={c.honorariosSenaRetenidaPct}
            onValor={(n) => cambiar({ honorariosSenaRetenidaPct: n })}
          />
        </Campo>
      </Panel>
      <Panel icono="🏢" titulo="IVA de la inmobiliaria">
        <Campo
          label="IVA sobre honorarios, gastos y comisión (%)"
          hint="21 si es responsable inscripta; 0 si es monotributista."
        >
          <InputPorcentaje
            valor={c.ivaHonorariosPct}
            onValor={(n) => cambiar({ ivaHonorariosPct: n })}
          />
        </Campo>
      </Panel>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {aviso && (
        <p
          role="status"
          className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink"
        >
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
