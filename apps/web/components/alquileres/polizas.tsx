'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sumarDiasIso } from '@vacker/domain';
import {
  DIAS_TABLERO_PROXIMOS,
  NOMBRE_COBERTURA,
  PolizaInputSchema,
  consecuenciaDeBoleta,
  type CoberturaPoliza,
  type ContratoResumenDto,
  type MonedaAlquiler,
  type PolizaDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularPoliza, crearPoliza } from '../../lib/alquileres-api';
import { cantidad, fmtFecha, fmtMoneda, hoyIso } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { AnularModal } from './anular-modal';
import { AccionFila, Bloque, CLASE_FOCO, Insignia, VacioBloque } from './piezas';
import { InputImporte } from '../input-importe';
import { leerImporte } from '../../lib/importe';
import { useRefrescar } from '../../lib/refrescar';
import { SelectQuienPaga, type QuienPagaValor } from './quien-paga';
import { primerMensaje } from '../../lib/mensaje-zod';

const num = (v: string) => leerImporte(v) ?? 0;

/** Vigente, por vencer (60 días, como el tablero), vencida o anulada. */
export function EstadoPoliza({ p }: { p: PolizaDto }) {
  if (p.anulada) return <Insignia tono="neutro">Anulada</Insignia>;
  if (p.hasta < hoyIso()) return <Insignia tono="peligro">Vencida</Insignia>;
  if (p.hasta <= sumarDiasIso(hoyIso(), DIAS_TABLERO_PROXIMOS))
    return <Insignia tono="aviso">Vence el {fmtFecha(p.hasta)}</Insignia>;
  return <Insignia tono="exito">Vigente</Insignia>;
}

/** Las pólizas, de un contrato o de todos, con su alta y su anulación. */
export function Polizas({
  polizas,
  contratos,
  contratoFijo,
  moneda,
  titulo = 'Pólizas de seguro',
  sePuedeAgregar = true,
}: {
  polizas: PolizaDto[];
  contratos: ContratoResumenDto[];
  contratoFijo?: string;
  /** La moneda del contrato, cuando la lista es de uno. */
  moneda?: MonedaAlquiler;
  titulo?: string;
  /** En la ficha de un contrato, solo si está vigente: a uno rescindido no se le asegura nada. */
  sePuedeAgregar?: boolean;
}) {
  const { refrescar } = useRefrescar();
  const [nueva, setNueva] = useState(false);
  const [aAnular, setAAnular] = useState<PolizaDto | null>(null);
  return (
    <Bloque
      icono="🛡️"
      titulo={titulo}
      detalle={polizas.length ? `${polizas.length}` : undefined}
      acciones={
        sePuedeAgregar && (
          <Button variant="secondary" size="sm" onClick={() => setNueva(true)}>
            ＋ Nueva póliza
          </Button>
        )
      }
    >
      {polizas.length === 0 ? (
        <VacioBloque>Sin pólizas cargadas.</VacioBloque>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {polizas.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <span className="min-w-0">
                <span
                  className={`block font-semibold ${p.anulada ? 'text-muted line-through' : 'text-ink'}`}
                >
                  {p.aseguradora}
                  {p.numero ? ` N.º ${p.numero}` : ''}{' '}
                  <span className="font-normal text-muted">· {NOMBRE_COBERTURA[p.cobertura]}</span>
                </span>
                <span className="block text-xs text-muted">
                  {!contratoFijo && (
                    <>
                      <Link
                        href={`/alquileres/contratos/${p.contrato.id}`}
                        className={`rounded font-semibold text-ink hover:text-brand-red ${CLASE_FOCO}`}
                      >
                        {p.contrato.codigo}
                      </Link>{' '}
                      · {p.contrato.propiedad} ·{' '}
                    </>
                  )}
                  {fmtFecha(p.desde)} al {fmtFecha(p.hasta)} · {fmtMoneda(p.premio, p.moneda)} en{' '}
                  {p.cuotas} {p.cuotas === 1 ? 'cuota' : 'cuotas'} (
                  {cantidad(p.cuotasPagadas, 'paga')}) · {consecuenciaDeBoleta(p.aCargoDe, p.paga)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <EstadoPoliza p={p} />
                {!p.anulada && (
                  <AccionFila
                    icono="🚫"
                    texto="Anular"
                    etiqueta={`Anular la póliza de ${p.aseguradora}`}
                    title="Anular, con un motivo"
                    onClick={() => setAAnular(p)}
                    peligro
                  />
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
          onDone={async () => {
            await refrescar();
            setNueva(false);
          }}
        />
      )}
      {aAnular && (
        <AnularModal
          titulo="Anular la póliza"
          detalle={`${aAnular.aseguradora} · ${aAnular.contrato.codigo}. Se anulan las cuotas sin pagar y lo que se les cargó a las partes; lo ya pagado queda.`}
          anular={async (motivo) => anularPoliza(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={async () => {
            await refrescar();
            setAAnular(null);
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
  /** Si devuelve una promesa (el refresh de la página), el modal la espera ocupado. */
  onDone: () => void | Promise<void>;
}) {
  const [contratoId, setContratoId] = useState(contratoFijo ?? '');
  const [moneda, setMoneda] = useState<MonedaAlquiler>(monedaFija ?? 'ARS');
  const [aseguradora, setAseguradora] = useState('');
  const [numero, setNumero] = useState('');
  const [cobertura, setCobertura] = useState<CoberturaPoliza>('incendio');
  const [desde, setDesde] = useState(hoyIso());
  const [hasta, setHasta] = useState('');
  const [premio, setPremio] = useState('');
  const [cuotas, setCuotas] = useState('1');
  const [primerVencimiento, setPrimer] = useState(hoyIso());
  // La póliza la paga la inmobiliaria y se le cobra al inquilino: lo más común.
  const [quien, setQuien] = useState<QuienPagaValor>({
    aCargoDe: 'inquilino',
    paga: 'inmobiliaria',
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  async function guardar() {
    const dto = {
      contratoId,
      aseguradora,
      numero,
      cobertura,
      desde,
      hasta,
      premio: num(premio),
      cuotas: Number(cuotas) || 1,
      primerVencimiento,
      moneda,
      ...quien,
    };
    const r = PolizaInputSchema.safeParse(dto);
    if (!r.success) {
      setError(contratoId ? primerMensaje(r.error, 'Revisá los datos.') : 'Elegí el contrato.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await crearPoliza(await getAccessToken(), dto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
      return;
    }
    setActualizando(true);
    await onDone();
  }

  return (
    <Modal
      title="Nueva póliza"
      subtitle="Cada cuota se carga como una boleta, una por mes desde el primer vencimiento."
      onClose={onClose}
      cerrable={!enviando}
      size="lg"
    >
      <div className="flex flex-col gap-3">
        {!contratoFijo && (
          <Campo label="Contrato" requerido>
            <select
              className={inputClass}
              value={contratoId}
              onChange={(e) => {
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
            <input
              className={inputClass}
              value={aseguradora}
              onChange={(e) => setAseguradora(e.target.value)}
            />
          </Campo>
          <Campo label="Número de póliza">
            <input
              className={inputClass}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </Campo>
          <Campo label="Cobertura">
            <select
              className={inputClass}
              value={cobertura}
              onChange={(e) => setCobertura(e.target.value as CoberturaPoliza)}
            >
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
            <input
              type="date"
              className={inputClass}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Campo>
          <Campo label="Hasta" requerido>
            <input
              type="date"
              className={inputClass}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr_6rem_1fr]">
          <Campo label="Moneda">
            <select
              className={inputClass}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as MonedaAlquiler)}
            >
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </Campo>
          <Campo label="Premio total" requerido>
            <InputImporte moneda={moneda} value={premio} onChange={setPremio} />
          </Campo>
          <Campo label="Cuotas">
            <input
              className={`${inputClass} text-right tabular-nums`}
              inputMode="numeric"
              value={cuotas}
              onChange={(e) => setCuotas(e.target.value)}
            />
          </Campo>
          <Campo label="Primer vencimiento" requerido>
            <input
              type="date"
              className={inputClass}
              value={primerVencimiento}
              onChange={(e) => setPrimer(e.target.value)}
            />
          </Campo>
        </div>
        <SelectQuienPaga valor={quien} onChange={setQuien} />
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={enviando}>
            {actualizando ? 'Actualizando…' : enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
