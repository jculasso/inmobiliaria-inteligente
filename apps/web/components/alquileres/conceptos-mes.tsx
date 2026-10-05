'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LIMITE_LISTA,
  recortarAlLimite,
  type ConceptoDto,
  type ContratoResumenDto,
  type MonedaAlquiler,
  type ResultadoGeneracionDto,
  type TipoConcepto,
} from '@vacker/types';
import { mesLargo, sumarMesesIso } from '@vacker/domain';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularConcepto, generarPeriodo } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { ConceptoSueltoModal } from './concepto-suelto-modal';

const NOMBRE_TIPO: Record<TipoConcepto, string> = {
  alquiler: 'Alquiler',
  gastos_adm: 'Gastos adm.',
  honorarios: 'Honorarios',
  iva: 'IVA',
  punitorio: 'Punitorio',
  expensa: 'Expensas',
  impuesto: 'Impuesto',
  servicio: 'Servicio',
  reparacion: 'Reparación',
  saldo_inicial: 'Saldo inicial',
  otro: 'Otro',
};

const mesDe = (periodo: string) => mesLargo(`${periodo}-01`);
/** «Diciembre de 2026»: mayúscula solo al principio (`capitalize` daría «Diciembre De»). */
const titulo = (periodo: string) => mesDe(periodo).replace(/^./, (l) => l.toUpperCase());
const correr = (periodo: string, n: number) => sumarMesesIso(`${periodo}-01`, n).slice(0, 7);
const lo = (c: ConceptoDto) => c.descripcion ?? NOMBRE_TIPO[c.tipo];

/** Lo que muestran las tarjetas de arriba: qué entra, qué sale y qué gana la inmobiliaria, por moneda. */
function totales(conceptos: ConceptoDto[]) {
  const vivos = conceptos.filter((c) => !c.anulado);
  const porMoneda = (filtro: (c: ConceptoDto) => boolean) => {
    const m = new Map<MonedaAlquiler, number>();
    for (const c of vivos.filter(filtro)) m.set(c.moneda, (m.get(c.moneda) ?? 0) + c.importe);
    return [...m];
  };
  return [
    { titulo: 'A cobrar', detalle: 'todo lo que deben inquilinos y propietarios', valores: porMoneda((c) => c.sentido === 'a_cobrar') },
    { titulo: 'A pagar', detalle: 'alquileres y reintegros a propietarios', valores: porMoneda((c) => c.sentido === 'a_pagar') },
    { titulo: 'Para la inmobiliaria', detalle: 'honorarios y gastos administrativos', valores: porMoneda((c) => c.tipo === 'honorarios' || c.tipo === 'gastos_adm') },
  ];
}

function Importe({ c }: { c: ConceptoDto }) {
  return (
    <span className={c.anulado ? 'text-muted line-through' : c.sentido === 'a_pagar' ? 'text-ink' : 'font-semibold text-ink'}>
      {c.sentido === 'a_pagar' ? '−' : ''}
      {fmtMoneda(c.importe, c.moneda)}
    </span>
  );
}

/**
 * Los conceptos de un mes y la generación del período (reglas 9 a 14).
 * «Generar» se puede apretar las veces que haga falta: la segunda vez solo
 * crea lo que falte (regla 10), por ejemplo un contrato cargado después.
 */
export function ConceptosMes({ periodo, conceptos, contratos }: { periodo: string; conceptos: ConceptoDto[]; contratos: ContratoResumenDto[] }) {
  const router = useRouter();
  const [resultado, setResultado] = useState<ResultadoGeneracionDto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [suelto, setSuelto] = useState(false);
  const [anulando, setAnulando] = useState<ConceptoDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(conceptos);

  async function generar() {
    setError(null);
    setAviso(null);
    setGenerando(true);
    try {
      setResultado(await generarPeriodo(await getAccessToken(), periodo));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el mes.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`?periodo=${correr(periodo, -1)}`} aria-label="Mes anterior" className="rounded-brand px-2 py-1 text-lg text-muted hover:bg-white hover:text-ink">
            ‹
          </Link>
          <h2 className="min-w-[10rem] text-center text-lg font-extrabold text-ink">{titulo(periodo)}</h2>
          <Link href={`?periodo=${correr(periodo, 1)}`} aria-label="Mes siguiente" className="rounded-brand px-2 py-1 text-lg text-muted hover:bg-white hover:text-ink">
            ›
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSuelto(true)}>
            + Gasto suelto
          </Button>
          <Button variant="primary" size="sm" onClick={generar} disabled={generando}>
            {generando ? 'Generando…' : `Generar ${mesDe(periodo).split(' ')[0]}`}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-brand border border-brand-red/30 bg-brand-red/5 px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}
      {resultado && (
        <div role="status" className="flex flex-col gap-1 rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink">
          <p>
            {resultado.creados === 0
              ? `No había nada nuevo para generar en ${resultado.contratos} contratos.`
              : `Se generaron ${resultado.creados} conceptos de ${resultado.contratos} contratos.`}
            {resultado.creados > 0 && resultado.existentes > 0 ? ` ${resultado.existentes} ya estaban.` : ''}
          </p>
          {resultado.sinIndexar.length > 0 && (
            <p>
              Sin generar, porque el tramo no está indexado:{' '}
              {resultado.sinIndexar.map((s) => `${s.codigo} (${fmtFecha(s.desde).slice(0, 5)} al ${fmtFecha(s.hasta).slice(0, 5)})`).join(', ')}.{' '}
              <Link href="/alquileres/indexaciones" className="font-semibold text-brand-red hover:underline">
                Ir a indexar
              </Link>
            </p>
          )}
        </div>
      )}
      {aviso && (
        <p role="status" className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink">
          {aviso}
        </p>
      )}

      {conceptos.length === 0 ? (
        <div className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          <p className="font-semibold text-ink">Todavía no hay conceptos de {mesDe(periodo)}.</p>
          <p className="mt-1">«Generar» crea el alquiler, los gastos administrativos y los honorarios de cada contrato del mes.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {totales(conceptos).map((t) => (
              <div key={t.titulo} className="rounded-brand border border-line bg-white px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{t.titulo}</p>
                <p className="mt-1 text-lg font-extrabold tabular-nums text-ink">
                  {t.valores.length === 0 ? '—' : t.valores.map(([m, v]) => fmtMoneda(v, m)).join(' · ')}
                </p>
                <p className="text-xs text-muted">{t.detalle}</p>
              </div>
            ))}
          </div>

          {hayMas && (
            <p role="status" className="text-sm text-muted">
              Se muestran los primeros {LIMITE_LISTA} conceptos.
            </p>
          )}

          <div className="rounded-brand border border-line bg-white sm:overflow-x-auto">
            <ListaTarjetas etiqueta="Conceptos">
              {visibles.map((c) => (
                <Tarjeta key={c.id}>
                  <span className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-bold ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}>{lo(c)}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <Importe c={c} />
                    </span>
                  </span>
                  <CamposTarjeta>
                    <CampoTarjeta etiqueta="Contrato">{c.contrato ? `${c.contrato.codigo} · ${c.contrato.direccion}` : '—'}</CampoTarjeta>
                    <CampoTarjeta etiqueta={c.sentido === 'a_pagar' ? 'Se le paga a' : 'Lo debe'}>{c.persona.nombre}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Vence">{fmtFecha(c.vencimiento)}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Estado">{c.anulado ? `Anulado: ${c.anulado.motivo}` : c.adelantadoPorInmobiliaria ? 'Adelantado' : 'Pendiente'}</CampoTarjeta>
                  </CamposTarjeta>
                  {!c.anulado && !c.aplicado && (
                    <button type="button" onClick={() => setAnulando(c)} className="mt-2 text-xs font-semibold text-brand-red">
                      Anular
                    </button>
                  )}
                </Tarjeta>
              ))}
            </ListaTarjetas>
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Contrato</th>
                  <th className="px-4 py-2.5">Concepto</th>
                  <th className="px-4 py-2.5">Persona</th>
                  <th className="px-4 py-2.5">Vence</th>
                  <th className="px-4 py-2.5 text-right">Importe</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-muted">
                      {c.contrato ? (
                        <Link href={`/alquileres/contratos/${c.contrato.id}`} className="hover:underline">
                          <span className="font-semibold tabular-nums text-ink">{c.contrato.codigo}</span> · {c.contrato.direccion}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={c.anulado ? 'text-muted line-through' : 'text-ink'}>{lo(c)}</span>
                      {c.adelantadoPorInmobiliaria && !c.anulado && <span className="ml-2 text-[11px] font-bold text-warning">Adelantado</span>}
                      {c.anulado && <span className="block text-xs text-muted">Anulado: {c.anulado.motivo}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      <span className="text-[10px] font-bold uppercase tracking-wide">{c.sentido === 'a_pagar' ? 'Se le paga' : 'Debe'}</span>{' '}
                      {c.persona.nombre}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{fmtFecha(c.vencimiento)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      <Importe c={c} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!c.anulado && !c.aplicado && (
                        <button type="button" onClick={() => setAnulando(c)} className="text-xs font-semibold text-muted hover:text-brand-red">
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {suelto && (
        <ConceptoSueltoModal
          contratos={contratos}
          periodo={periodo}
          onClose={() => setSuelto(false)}
          onSaved={(n) => {
            setSuelto(false);
            setResultado(null);
            setAviso(n > 1 ? `Se cargaron ${n} conceptos: el cargo y el reintegro a quien lo pagó.` : 'Se cargó el gasto.');
            router.refresh();
          }}
        />
      )}
      {anulando && (
        <AnularModal
          concepto={anulando}
          onClose={() => setAnulando(null)}
          onDone={(n) => {
            setAnulando(null);
            setAviso(n > 1 ? `Se anularon ${n} conceptos: el cargo y lo que tenía enlazado.` : 'Se anuló el concepto.');
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Regla 19: no se borra, se anula con motivo. Queda a la vista, tachado. */
function AnularModal({ concepto, onClose, onDone }: { concepto: ConceptoDto; onClose: () => void; onDone: (n: number) => void }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    setError(null);
    setEnviando(true);
    try {
      const r = await anularConcepto(await getAccessToken(), concepto.id, motivo);
      onDone(r.anulados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.');
      setEnviando(false);
    }
  }

  return (
    <Modal title="Anular el concepto" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          {lo(concepto)} · {concepto.persona.nombre} · {fmtMoneda(concepto.importe, concepto.moneda)}
        </p>
        <p className="text-sm text-muted">
          No se borra: queda tachado, con el motivo, quién y cuándo.
          {concepto.generado ? ' Generar el mes de nuevo no lo vuelve a crear.' : ''}
        </p>
        <Campo label="Motivo" requerido>
          <input className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={anular} disabled={enviando || motivo.trim().length < 3}>
            {enviando ? 'Anulando…' : 'Anular'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
