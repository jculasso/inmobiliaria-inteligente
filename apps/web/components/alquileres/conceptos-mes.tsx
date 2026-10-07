'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LIMITE_CONCEPTOS_MES,
  recortarAlLimite,
  type ConceptoDto,
  type ContratoResumenDto,
  type EstadoConcepto,
  type MonedaAlquiler,
  type ResultadoGeneracionDto,
  type TipoConcepto,
} from '@vacker/types';
import { mesLargo } from '@vacker/domain';
import { Button, KpiCard } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularConcepto, generarPeriodo } from '../../lib/alquileres-api';
import { cantidad, fmtFecha, fmtMoneda } from '../../lib/format';
import { useRefrescar } from '../../lib/refrescar';
import { AnularModal } from './anular-modal';
import { ConceptoSueltoModal } from './concepto-suelto-modal';
import {
  AccionFila,
  CLASE_FOCO,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  EncabezadoPagina,
  Insignia,
  NavegadorMes,
  TituloSeccion,
  type TonoInsignia,
} from './piezas';

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
  comision: 'Comisión inicial',
  informe: 'Informe de garantía',
  deposito: 'Depósito en garantía',
  sellado: 'Sellado',
};

const mesDe = (periodo: string) => mesLargo(`${periodo}-01`);
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
    {
      titulo: 'A cobrar',
      icono: '📥',
      tono: 'brand' as const,
      detalle: 'todo lo que deben inquilinos y propietarios',
      valores: porMoneda((c) => c.sentido === 'a_cobrar'),
    },
    {
      titulo: 'A pagar',
      icono: '📤',
      tono: 'default' as const,
      detalle: 'alquileres y reintegros a propietarios',
      valores: porMoneda((c) => c.sentido === 'a_pagar'),
    },
    {
      titulo: 'Para la inmobiliaria',
      icono: '🏢',
      tono: 'success' as const,
      detalle: 'honorarios, gastos, comisiones e informes',
      valores: porMoneda((c) =>
        ['honorarios', 'gastos_adm', 'comision', 'informe'].includes(c.tipo),
      ),
    },
  ];
}

const ESTADO: Record<EstadoConcepto, { texto: string; tono: TonoInsignia }> = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  parcial: { texto: 'Cobrado en parte', tono: 'aviso' },
  cobrado: { texto: 'Cobrado', tono: 'exito' },
  pagado: { texto: 'Pagado', tono: 'exito' },
  liquidado: { texto: 'Liquidado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
};

/**
 * A quién va cada concepto, dicho como se dice en la inmobiliaria (punto 4 de
 * Javier): al inquilino se le cobra; al propietario se le paga lo suyo y se le
 * descuentan honorarios y gastos.
 */
function aQuien(c: ConceptoDto): string {
  if (c.sentido === 'a_pagar') return 'Pagar a';
  return c.papel === 'propietario' ? 'Descontar a' : 'Cobrar a';
}

interface Grupo {
  clave: string;
  contrato: ConceptoDto['contrato'];
  conceptos: ConceptoDto[];
  /** Por moneda: lo que paga el inquilino, lo que recibe el propietario y lo de la inmobiliaria. */
  inquilino: [MonedaAlquiler, number][];
  propietario: [MonedaAlquiler, number][];
  inmobiliaria: [MonedaAlquiler, number][];
}

/** Un grupo por contrato, en orden de número; los sueltos sin contrato, al final. */
function agrupar(conceptos: ConceptoDto[]): Grupo[] {
  const mapa = new Map<string, ConceptoDto[]>();
  for (const c of conceptos)
    mapa.set(c.contrato?.id ?? '', [...(mapa.get(c.contrato?.id ?? '') ?? []), c]);
  const suma = (xs: ConceptoDto[], f: (c: ConceptoDto) => number): [MonedaAlquiler, number][] => {
    const m = new Map<MonedaAlquiler, number>();
    for (const c of xs.filter((x) => !x.anulado))
      m.set(c.moneda, Math.round(((m.get(c.moneda) ?? 0) + f(c)) * 100) / 100);
    return [...m].filter(([, v]) => v !== 0);
  };
  return [...mapa]
    .map(([clave, xs]) => ({
      clave,
      contrato: xs[0]!.contrato,
      conceptos: xs,
      inquilino: suma(xs, (c) =>
        c.sentido === 'a_cobrar' && c.papel !== 'propietario' ? c.importe : 0,
      ),
      propietario: suma(xs, (c) =>
        c.papel === 'propietario' ? (c.sentido === 'a_pagar' ? c.importe : -c.importe) : 0,
      ),
      inmobiliaria: suma(xs, (c) =>
        ['honorarios', 'gastos_adm', 'comision', 'informe'].includes(c.tipo) ? c.importe : 0,
      ),
    }))
    .sort((a, b) =>
      !a.contrato
        ? 1
        : !b.contrato
          ? -1
          : a.contrato.codigo.localeCompare(b.contrato.codigo, 'es', { numeric: true }),
    );
}

const montos = (xs: [MonedaAlquiler, number][]) =>
  xs.length ? xs.map(([m, v]) => fmtMoneda(v, m)).join(' · ') : '—';

/** Un contrato del mes: su cabecera con lo que deja, y sus conceptos con estado. */
function GrupoContrato({
  grupo: g,
  onAnular,
}: {
  grupo: Grupo;
  onAnular: (c: ConceptoDto) => void;
}) {
  const anulable = (c: ConceptoDto) => !c.anulado && !c.aplicado;
  return (
    <section
      className="overflow-hidden rounded-brand border border-line bg-white shadow-sm"
      aria-label={g.contrato ? `Contrato ${g.contrato.codigo}` : 'Sin contrato'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line bg-surface/40 px-4 py-3">
        {g.contrato ? (
          <Link
            href={`/alquileres/contratos/${g.contrato.id}`}
            className={`rounded text-sm font-bold text-ink hover:text-brand-red hover:underline ${CLASE_FOCO}`}
          >
            <span aria-hidden>🏠 </span>
            {g.contrato.codigo} · {g.contrato.direccion}
          </Link>
        ) : (
          <span className="text-sm font-bold text-ink">Sin contrato</span>
        )}
        <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
          <div className="flex gap-1">
            <dt className="text-muted">Paga el inquilino</dt>
            <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
              {montos(g.inquilino)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Recibe el propietario</dt>
            <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
              {montos(g.propietario)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Para la inmobiliaria</dt>
            <dd className="whitespace-nowrap font-semibold tabular-nums text-success">
              {montos(g.inmobiliaria)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Teléfono: un renglón por concepto. */}
      <ul className="divide-y divide-line text-sm sm:hidden">
        {g.conceptos.map((c) => (
          <li key={c.id} className="px-4 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span
                  className={`block font-semibold ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}
                >
                  {lo(c)}
                </span>
                <span className="block text-xs text-muted">
                  {aQuien(c)} {c.persona.nombre} · vence {fmtFecha(c.vencimiento)}
                </span>
                {c.registrado?.por && !c.anulado && (
                  <span className="block text-xs text-muted">Cargó {c.registrado.por}</span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span
                  className={`block whitespace-nowrap font-semibold tabular-nums ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}
                >
                  {c.sentido === 'a_pagar' ? 'A pagar ' : 'A cobrar '}
                  {fmtMoneda(c.importe, c.moneda)}
                </span>
                <Insignia tono={ESTADO[c.estado].tono}>{ESTADO[c.estado].texto}</Insignia>
                {c.adelantadoPorInmobiliaria && !c.anulado && (
                  <Insignia tono="aviso">Adelantado</Insignia>
                )}
                {c.estado === 'parcial' && (
                  <span className="text-xs text-muted">falta {fmtMoneda(c.saldo, c.moneda)}</span>
                )}
              </span>
            </div>
            {c.anulado && (
              <p className="mt-1 text-xs text-muted">
                Anulado{c.anulado.por ? ` por ${c.anulado.por}` : ''}: {c.anulado.motivo}
              </p>
            )}
            {anulable(c) && (
              <div className="mt-1 flex justify-end">
                <AccionFila
                  icono="🚫"
                  texto="Anular"
                  etiqueta={`Anular ${lo(c)}`}
                  onClick={() => onAnular(c)}
                  tarjeta
                  peligro
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Escritorio: la tabla, con «A cobrar» y «A pagar» en columnas separadas en vez de un signo. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={CLASE_TH}>Concepto</th>
              <th className={CLASE_TH}>A quién</th>
              <th className={CLASE_TH}>Vence</th>
              <th className={`${CLASE_TH} text-right`}>A cobrar</th>
              <th className={`${CLASE_TH} text-right`}>A pagar</th>
              <th className={CLASE_TH}>Estado</th>
              <th className={CLASE_TH_ACCIONES} />
            </tr>
          </thead>
          <tbody>
            {g.conceptos.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <span className={c.anulado ? 'text-muted line-through' : 'text-ink'}>
                    {lo(c)}
                  </span>
                  {c.adelantadoPorInmobiliaria && !c.anulado && (
                    <span className="ml-2">
                      <Insignia tono="aviso">Adelantado</Insignia>
                    </span>
                  )}
                  {c.anulado && (
                    <span className="block text-xs text-muted">
                      Anulado{c.anulado.por ? ` por ${c.anulado.por}` : ''}: {c.anulado.motivo}
                    </span>
                  )}
                  {c.registrado?.por && !c.anulado && (
                    <span className="block text-xs text-muted">Cargó {c.registrado.por}</span>
                  )}
                </td>
                <td className={`${CLASE_TD} text-muted`}>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{aQuien(c)}</span>{' '}
                  {c.persona.nombre}
                </td>
                <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(c.vencimiento)}</td>
                <td
                  className={`${CLASE_TD} text-right font-semibold tabular-nums ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}
                >
                  {c.sentido === 'a_cobrar' ? fmtMoneda(c.importe, c.moneda) : ''}
                </td>
                <td
                  className={`${CLASE_TD} text-right tabular-nums ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}
                >
                  {c.sentido === 'a_pagar' ? fmtMoneda(c.importe, c.moneda) : ''}
                </td>
                <td className={CLASE_TD}>
                  <Insignia tono={ESTADO[c.estado].tono}>{ESTADO[c.estado].texto}</Insignia>
                  {c.estado === 'parcial' && (
                    <span className="ml-1 text-xs text-muted">
                      falta {fmtMoneda(c.saldo, c.moneda)}
                    </span>
                  )}
                </td>
                <td className={CLASE_TD_ACCIONES}>
                  {anulable(c) && (
                    <AccionFila
                      icono="🚫"
                      texto="Anular"
                      etiqueta={`Anular ${lo(c)} de ${c.persona.nombre}`}
                      title="Anular este concepto"
                      onClick={() => onAnular(c)}
                      peligro
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Lo que hizo «Generar», dicho con lo que se sabe: cuántos conceptos nuevos,
 * cuántos ya estaban y cuántos contratos se revisaron. Antes decía «Se
 * generaron 11 conceptos de 11 contratos» cuando los nuevos eran de 3: la
 * respuesta no dice de cuántos contratos son los nuevos, así que no se afirma.
 */
export function textoGeneracion(r: ResultadoGeneracionDto): string {
  const revisados = `se ${r.contratos === 1 ? 'revisó' : 'revisaron'} ${cantidad(r.contratos, 'contrato')}`;
  if (r.creados === 0) return `No había nada nuevo para generar: ${revisados}.`;
  const nuevos = `Se ${r.creados === 1 ? 'generó' : 'generaron'} ${cantidad(r.creados, 'concepto nuevo', 'conceptos nuevos')}`;
  return r.existentes > 0
    ? `${nuevos}. ${cantidad(r.existentes, 'ya estaba', 'ya estaban')} (${revisados}).`
    : `${nuevos} (${revisados}).`;
}

/**
 * Los conceptos de un mes y la generación del período (reglas 9 a 14).
 * «Generar» se puede apretar las veces que haga falta: la segunda vez solo
 * crea lo que falte (regla 10), por ejemplo un contrato cargado después.
 */
export function ConceptosMes({
  periodo,
  conceptos,
  contratos,
}: {
  periodo: string;
  conceptos: ConceptoDto[];
  contratos: ContratoResumenDto[];
}) {
  const { refrescar, refrescando } = useRefrescar();
  const [resultado, setResultado] = useState<ResultadoGeneracionDto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [suelto, setSuelto] = useState(false);
  const [anulando, setAnulando] = useState<ConceptoDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(conceptos, LIMITE_CONCEPTOS_MES);
  const grupos = agrupar(visibles);

  async function generar() {
    setError(null);
    setAviso(null);
    setGenerando(true);
    try {
      setResultado(await generarPeriodo(await getAccessToken(), periodo));
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el mes.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Conceptos">
        <NavegadorMes periodo={periodo} />
        <Button variant="secondary" size="sm" onClick={() => setSuelto(true)}>
          ＋ Gasto suelto
        </Button>
        <Button variant="primary" size="sm" onClick={generar} disabled={generando}>
          {refrescando && generando
            ? 'Actualizando…'
            : generando
              ? 'Generando…'
              : `⚙️ Generar ${mesDe(periodo).split(' ')[0]}`}
        </Button>
      </EncabezadoPagina>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {resultado && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink"
        >
          <p>{textoGeneracion(resultado)}</p>
          {resultado.sinIndexar.length > 0 && (
            <p>
              Sin generar, porque el tramo no está indexado:{' '}
              {resultado.sinIndexar
                .map(
                  (s) =>
                    `${s.codigo} (${fmtFecha(s.desde).slice(0, 5)} al ${fmtFecha(s.hasta).slice(0, 5)})`,
                )
                .join(', ')}
              .{' '}
              <Link
                href="/alquileres/indexaciones"
                className="font-semibold text-brand-red hover:underline"
              >
                Ir a indexar
              </Link>
            </p>
          )}
        </div>
      )}
      {aviso && (
        <p
          role="status"
          className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink"
        >
          {aviso}
        </p>
      )}

      {conceptos.length === 0 ? (
        <div className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted shadow-sm">
          <p className="font-semibold text-ink">Todavía no hay conceptos de {mesDe(periodo)}.</p>
          <p className="mt-1">
            «Generar» crea el alquiler, los gastos administrativos y los honorarios de cada contrato
            del mes.
          </p>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <TituloSeccion icono="📊">Resumen del mes</TituloSeccion>
            <div className="grid gap-3 sm:grid-cols-3">
              {totales(conceptos).map((t) => (
                <KpiCard
                  key={t.titulo}
                  label={t.titulo}
                  value={
                    t.valores.length === 0
                      ? '—'
                      : t.valores.map(([m, v]) => fmtMoneda(v, m)).join(' · ')
                  }
                  sub={t.detalle}
                  icon={t.icono}
                  tone={t.tono}
                />
              ))}
            </div>
          </section>

          {hayMas && (
            <p role="status" className="text-sm text-muted">
              Se muestran los primeros {LIMITE_CONCEPTOS_MES} conceptos.
            </p>
          )}

          <TituloSeccion
            icono="🧾"
            detalle={`${grupos.length} ${grupos.length === 1 ? 'contrato' : 'contratos'} · ${cantidad(visibles.length, 'concepto')}`}
          >
            Conceptos de {mesDe(periodo)}, por contrato
          </TituloSeccion>
          {grupos.map((g) => (
            <GrupoContrato key={g.clave} grupo={g} onAnular={setAnulando} />
          ))}
        </>
      )}

      {suelto && (
        <ConceptoSueltoModal
          contratos={contratos}
          periodo={periodo}
          onClose={() => setSuelto(false)}
          onSaved={async (n) => {
            await refrescar();
            setSuelto(false);
            setResultado(null);
            setAviso(
              n > 1
                ? `Se cargaron ${n} conceptos: el cargo y el reintegro a quien lo pagó.`
                : 'Se cargó el gasto.',
            );
          }}
        />
      )}
      {anulando && (
        <AnularModal
          titulo="Anular el concepto"
          detalle={
            <>
              <p className="text-ink">
                {lo(anulando)} · {anulando.persona.nombre} ·{' '}
                {fmtMoneda(anulando.importe, anulando.moneda)}
              </p>
              <p>
                No se borra: queda tachado, con el motivo, quién y cuándo.
                {anulando.generado ? ' Generar el mes de nuevo no lo vuelve a crear.' : ''}
              </p>
            </>
          }
          anular={async (motivo) =>
            (await anularConcepto(await getAccessToken(), anulando.id, motivo)).anulados
          }
          onClose={() => setAnulando(null)}
          onDone={async (n) => {
            await refrescar();
            setAnulando(null);
            setAviso(
              n > 1
                ? `Se anularon ${n} conceptos: el cargo y lo que tenía enlazado.`
                : 'Se anuló el concepto.',
            );
          }}
        />
      )}
    </div>
  );
}
