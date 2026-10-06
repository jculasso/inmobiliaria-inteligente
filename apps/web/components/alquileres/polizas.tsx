'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sumarDiasIso } from '@vacker/domain';
import {
  DIAS_TABLERO_PROXIMOS,
  NOMBRE_COBERTURA,
  NOMBRE_QUIEN_PAGA,
  PolizaInputSchema,
  type CoberturaPoliza,
  type ContratoResumenDto,
  type MonedaAlquiler,
  type PolizaDto,
  type QuienPaga,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularPoliza, crearPoliza } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { AnularModal } from './anular-modal';
import { Bloque, Insignia } from './piezas';
import { InputImporte } from '../input-importe';
import { leerImporte } from '../../lib/importe';

const hoy = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const num = (v: string) => leerImporte(v) ?? 0;

/** Vigente, por vencer (60 días, como el tablero), vencida o anulada. */
export function EstadoPoliza({ p }: { p: PolizaDto }) {
  if (p.anulada) return <Insignia tono="neutro">Anulada</Insignia>;
  if (p.hasta < hoy()) return <Insignia tono="marca">Vencida</Insignia>;
  if (p.hasta <= sumarDiasIso(hoy(), DIAS_TABLERO_PROXIMOS)) return <Insignia tono="aviso">Vence el {fmtFecha(p.hasta)}</Insignia>;
  return <Insignia tono="exito">Vigente</Insignia>;
}

/** Las pólizas, de un contrato o de todos, con su alta y su anulación. */
export function Polizas({
  polizas,
  contratos,
  contratoFijo,
  moneda,
  titulo = 'Pólizas de seguro',
}: {
  polizas: PolizaDto[];
  contratos: ContratoResumenDto[];
  contratoFijo?: string;
  /** La moneda del contrato, cuando la lista es de uno. */
  moneda?: MonedaAlquiler;
  titulo?: string;
}) {
  const router = useRouter();
  const [nueva, setNueva] = useState(false);
  const [aAnular, setAAnular] = useState<PolizaDto | null>(null);
  return (
    <Bloque
      icono="🛡️"
      titulo={titulo}
      detalle={polizas.length ? `${polizas.length}` : undefined}
      acciones={
        <Button variant="secondary" size="sm" onClick={() => setNueva(true)}>
          ＋ Nueva póliza
        </Button>
      }
    >
      {polizas.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">Sin pólizas cargadas.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {polizas.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${p.anulada ? 'opacity-60' : ''}`}>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">
                  {p.aseguradora}
                  {p.numero ? ` N° ${p.numero}` : ''} <span className="font-normal text-muted">· {NOMBRE_COBERTURA[p.cobertura]}</span>
                </span>
                <span className="block text-xs text-muted">
                  {!contratoFijo && (
                    <>
                      <Link href={`/alquileres/contratos/${p.contrato.id}`} className="font-semibold text-ink hover:text-brand-red">
                        {p.contrato.codigo}
                      </Link>{' '}
                      · {p.contrato.propiedad} ·{' '}
                    </>
                  )}
                  {fmtFecha(p.desde)} al {fmtFecha(p.hasta)} · {fmtMoneda(p.premio, p.moneda)} en {p.cuotas} {p.cuotas === 1 ? 'cuota' : 'cuotas'} ({p.cuotasPagadas} pagas) · la debe el {p.aCargoDe}, paga {NOMBRE_QUIEN_PAGA[p.paga].toLowerCase()}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <EstadoPoliza p={p} />
                {!p.anulada && (
                  <button type="button" onClick={() => setAAnular(p)} aria-label={`Anular la póliza de ${p.aseguradora}`} title="Anular, con un motivo" className="rounded px-1.5 py-0.5 text-base hover:bg-brand-red/5">
                    🚫
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {nueva && (
        <PolizaModal
          contratos={contratos}
          contratoFijo={contratoFijo}
          monedaFija={moneda}
          onClose={() => setNueva(false)}
          onDone={() => {
            setNueva(false);
            router.refresh();
          }}
        />
      )}
      {aAnular && (
        <AnularModal
          titulo="Anular la póliza"
          detalle={`${aAnular.aseguradora} · ${aAnular.contrato.codigo}. Se anulan las cuotas sin pagar y lo que se les cargó a las partes; lo ya pagado queda.`}
          anular={async (motivo) => anularPoliza(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={() => {
            setAAnular(null);
            router.refresh();
          }}
        />
      )}
    </Bloque>
  );
}

export function PolizaModal({
  contratos,
  contratoFijo,
  monedaFija,
  onClose,
  onDone,
}: {
  contratos: ContratoResumenDto[];
  contratoFijo?: string;
  monedaFija?: MonedaAlquiler;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contratoId, setContratoId] = useState(contratoFijo ?? '');
  const [moneda, setMoneda] = useState<MonedaAlquiler>(monedaFija ?? 'ARS');
  const [aseguradora, setAseguradora] = useState('');
  const [numero, setNumero] = useState('');
  const [cobertura, setCobertura] = useState<CoberturaPoliza>('incendio');
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState('');
  const [premio, setPremio] = useState('');
  const [cuotas, setCuotas] = useState('1');
  const [primerVencimiento, setPrimer] = useState(hoy());
  const [aCargoDe, setACargoDe] = useState<'inquilino' | 'propietario'>('inquilino');
  const [paga, setPaga] = useState<QuienPaga>('inmobiliaria');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const dto = { contratoId, aseguradora, numero, cobertura, desde, hasta, premio: num(premio), cuotas: Number(cuotas) || 1, primerVencimiento, moneda, aCargoDe, paga };
    const r = PolizaInputSchema.safeParse(dto);
    if (!r.success) {
      setError(contratoId ? (r.error.issues[0]?.message ?? 'Revisá los datos.') : 'Elegí el contrato.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await crearPoliza(await getAccessToken(), dto);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }

  return (
    <Modal title="Nueva póliza" subtitle="Cada cuota se carga como una boleta, una por mes desde el primer vencimiento." onClose={onClose} size="lg">
      <div className="flex flex-col gap-3">
        {!contratoFijo && (
          <Campo label="Contrato" requerido>
            <select className={inputClass} value={contratoId} onChange={(e) => {
                setContratoId(e.target.value);
                setMoneda(contratos.find((c) => c.id === e.target.value)?.moneda ?? 'ARS');
              }}
            >
              <option value="">Elegí el contrato…</option>
              {contratos
                .filter((c) => c.estado === 'vigente')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {c.propiedad.direccion}
                    {c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}
                  </option>
                ))}
            </select>
          </Campo>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Aseguradora" requerido>
            <input className={inputClass} value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} />
          </Campo>
          <Campo label="Número de póliza">
            <input className={inputClass} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Campo>
          <Campo label="Cobertura">
            <select className={inputClass} value={cobertura} onChange={(e) => setCobertura(e.target.value as CoberturaPoliza)}>
              {Object.entries(NOMBRE_COBERTURA).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Vigente desde" requerido>
            <input type="date" className={inputClass} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo label="Hasta" requerido>
            <input type="date" className={inputClass} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr_6rem_1fr]">
          <Campo label="Moneda">
            <select className={inputClass} value={moneda} onChange={(e) => setMoneda(e.target.value as MonedaAlquiler)}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </Campo>
          <Campo label="Premio total" requerido>
            <InputImporte moneda={moneda} value={premio} onChange={setPremio} />
          </Campo>
          <Campo label="Cuotas">
            <input className={`${inputClass} text-right tabular-nums`} inputMode="numeric" value={cuotas} onChange={(e) => setCuotas(e.target.value)} />
          </Campo>
          <Campo label="Primer vencimiento" requerido>
            <input type="date" className={inputClass} value={primerVencimiento} onChange={(e) => setPrimer(e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="La debe">
            <select className={inputClass} value={aCargoDe} onChange={(e) => setACargoDe(e.target.value as 'inquilino' | 'propietario')}>
              <option value="inquilino">El inquilino</option>
              <option value="propietario">El propietario</option>
            </select>
          </Campo>
          <Campo label="La paga">
            <select className={inputClass} value={paga} onChange={(e) => setPaga(e.target.value as QuienPaga)}>
              {Object.entries(NOMBRE_QUIEN_PAGA).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
