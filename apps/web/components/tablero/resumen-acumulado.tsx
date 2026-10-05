'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgregadoKpi, LadoPunta, RankingItem } from '@vacker/types';
import { Card, KpiCard } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  getAgregadosPorTrimestre,
  getKpisMensual,
  getResumenPeriodo,
  type PeriodoResumen,
} from '../../lib/tablero-api';
import { getOrFetch } from '../../lib/kpi-cache';
import { fmtNum, fmtUSD } from '../../lib/format';
import { ABREV_MES, NOMBRES_MES } from '../../lib/meses';
import { VentasChart } from './ventas-chart';
import { VentasTabla } from './ventas-tabla';
import type { FocoDrill } from '../../lib/drill';
import { DetalleDrillModal } from './detalle-drill-modal';

const TABS: { key: PeriodoResumen; label: string; icono: string }[] = [
  { key: 'anual', label: 'Acumulado Anual', icono: '📅' },
  { key: 'trimestral', label: 'Acumulado Trimestral', icono: '📈' },
  { key: 'mensual', label: 'Acumulado del Mes', icono: '🗓️' },
];

const TRIMESTRES = [
  { q: 1, label: 'Q1 · Ene–Mar' },
  { q: 2, label: 'Q2 · Abr–Jun' },
  { q: 3, label: 'Q3 · Jul–Sep' },
  { q: 4, label: 'Q4 · Oct–Dic' },
];
const ETIQUETAS_TRIMESTRE = TRIMESTRES.map((t) => `Q${t.q}`);

/** Qué se abre en la ventana de detalle: el período, y qué tarjeta se tocó. */
interface Detalle {
  periodo: { trimestre: number } | { mes: number } | Record<string, never>;
  titulo: string;
  foco: FocoDrill;
  lado?: LadoPunta;
}

type Abrir = (titulo: string, foco: FocoDrill, lado?: LadoPunta) => () => void;

/**
 * Las tarjetas del período elegido. Todas abren las operaciones que cuentan,
 * con el mismo criterio que las del dashboard (ver `lib/drill.ts`): hasta el
 * 5/10/2026 solo «Operaciones» abría algo, y solo en el trimestral y el mensual.
 */
function metricas(agg: AgregadoKpi, abrir: Abrir) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label="Volumen operado" value={fmtUSD(agg.volumen)} tone="brand" onClick={abrir('Volumen', 'volumen')} />
      <KpiCard
        label="Ticket promedio"
        value={fmtUSD(agg.ticketPromedio)}
        sub="por punta"
        onClick={abrir('Ticket promedio', 'ticket')}
      />
      <KpiCard
        label="Operaciones"
        value={fmtNum(agg.operaciones)}
        sub={`${fmtNum(agg.puntas)} puntas`}
        onClick={abrir('Operaciones', 'operaciones')}
      />
      <KpiCard label="Puntas totales" value={fmtNum(agg.puntas)} onClick={abrir('Puntas', 'puntas')} />
      <KpiCard
        label="Puntas compradoras"
        value={fmtNum(agg.puntasCompradoras)}
        onClick={abrir('Puntas compradoras', 'puntas', 'compradora')}
      />
      <KpiCard
        label="Puntas vendedoras"
        value={fmtNum(agg.puntasVendedoras)}
        onClick={abrir('Puntas vendedoras', 'puntas', 'vendedora')}
      />
      <KpiCard
        label="Com. comprador"
        value={fmtUSD(agg.comisionCompradora)}
        onClick={abrir('Comisión del comprador', 'comision', 'compradora')}
      />
      <KpiCard
        label="Com. vendedor"
        value={fmtUSD(agg.comisionVendedora)}
        onClick={abrir('Comisión del vendedor', 'comision', 'vendedora')}
      />
      <KpiCard
        label="Comisiones cobradas"
        value={fmtUSD(agg.comision)}
        sub="total generada"
        tone="success"
        onClick={abrir('Comisión', 'comision')}
      />
    </div>
  );
}

interface Props {
  anio: number;
  mesSeleccionado: number;
  /** "Ver solo lo mío": scopea los KPIs al usuario actual. */
  verTodo?: boolean;
  /** Acumulado anual ya resuelto server-side (mismo dato que pide el tab "Acumulado Anual" por defecto) — evita repetir esa consulta al montar. */
  inicial?: { agregado: AgregadoKpi; ranking: RankingItem[] };
}

export function ResumenAcumulado({ anio, mesSeleccionado, verTodo, inicial }: Props) {
  const [tab, setTab] = useState<PeriodoResumen>('anual');
  const [trimestre, setTrimestre] = useState(() => Math.ceil(mesSeleccionado / 3));
  const [mes, setMes] = useState(mesSeleccionado);
  const [datos, setDatos] = useState<{ agregado: AgregadoKpi; ranking: RankingItem[] } | null>(inicial ?? null);
  const [loading, setLoading] = useState(!inicial);
  const [porTrimestre, setPorTrimestre] = useState<AgregadoKpi[] | null>(null);
  const [porMes, setPorMes] = useState<AgregadoKpi[] | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const primerRender = useRef(true);

  // Si cambia el mes de arriba del tablero, el trimestre y el mes elegidos acá
  // lo siguen. Sin esto, cambiar de mes arriba dejaba el cuadro mirando otro.
  useEffect(() => {
    setMes(mesSeleccionado);
    setTrimestre(Math.ceil(mesSeleccionado / 3));
  }, [mesSeleccionado]);

  useEffect(() => {
    // El tab por defecto ('anual') ya viene resuelto desde el servidor junto
    // con la página — nos ahorramos repetir la misma consulta al montar.
    if (primerRender.current) {
      primerRender.current = false;
      if (inicial && tab === 'anual') return;
    }
    let cancelado = false;
    setLoading(true);
    getAccessToken()
      .then((accessToken) =>
        getOrFetch(`resumen:${anio}:${tab}:${mes}:${trimestre}:${verTodo ? 1 : 0}`, () =>
          getResumenPeriodo(accessToken, { anio, periodo: tab, mes, trimestre, verTodo }),
        ),
      )
      .then((res) => {
        if (!cancelado) setDatos(res);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, tab, mes, trimestre, verTodo]);

  useEffect(() => {
    if (tab !== 'trimestral') return;
    let cancelado = false;
    getAccessToken()
      .then((accessToken) => getAgregadosPorTrimestre(accessToken, anio, verTodo))
      .then((res) => {
        if (!cancelado) setPorTrimestre(res);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, tab, verTodo]);

  useEffect(() => {
    if (tab !== 'mensual') return;
    let cancelado = false;
    getAccessToken()
      .then((accessToken) => getKpisMensual(accessToken, anio, verTodo))
      .then((res) => {
        if (!cancelado) setPorMes(res);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, tab, verTodo]);

  const nombrePeriodo =
    tab === 'trimestral' ? `Q${trimestre} ${anio}` : tab === 'mensual' ? `${NOMBRES_MES[mes - 1]} ${anio}` : `Año ${anio}`;
  const abrir: Abrir = (titulo, foco, lado) => () =>
    setDetalle({
      periodo: tab === 'trimestral' ? { trimestre } : tab === 'mensual' ? { mes } : {},
      titulo,
      foco,
      lado,
    });

  return (
    <Card className="p-0">
      <div className="flex flex-wrap gap-1 border-b border-line p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-brand px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-brand-red text-white' : 'text-muted hover:bg-surface'
            }`}
          >
            <span aria-hidden>{t.icono}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'trimestral' && (
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
          {TRIMESTRES.map((t) => (
            <button
              key={t.q}
              type="button"
              onClick={() => setTrimestre(t.q)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                trimestre === t.q ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'trimestral' && porTrimestre && (
        <div className="flex flex-col gap-4 border-b border-line p-4">
          <VentasChart
            anio={anio}
            datos={porTrimestre}
            etiquetas={ETIQUETAS_TRIMESTRE}
            unidad="trimestre"
            seleccionado={trimestre}
            onSelect={setTrimestre}
          />
          {/*
            El cuadro completo va DEBAJO del gráfico. El gráfico muestra la
            tendencia con dos series; las nueve filas de la planilla adentro de
            un gráfico no se leerían.
          */}
          <VentasTabla
            datos={porTrimestre}
            etiquetas={ETIQUETAS_TRIMESTRE}
            seleccionado={trimestre}
            onSelect={setTrimestre}
          />
        </div>
      )}

      {/*
        El mensual es el mismo cuadro que el trimestral, con los doce meses en
        vez de los cuatro trimestres — así lo pidió Vacker el 25/09/2026. No
        lleva la fila de botones de arriba: doce botones no entran en el
        teléfono, y el mes ya se elige tocando la barra o la columna.
      */}
      {tab === 'mensual' && porMes && (
        <div className="flex flex-col gap-4 border-b border-line p-4">
          <VentasChart anio={anio} datos={porMes} etiquetas={ABREV_MES} unidad="mes" seleccionado={mes} onSelect={setMes} />
          <VentasTabla datos={porMes} etiquetas={ABREV_MES} seleccionado={mes} onSelect={setMes} />
        </div>
      )}

      <div className="p-5">
        {loading || !datos ? (
          <p className="py-6 text-sm text-muted">Cargando…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {/*
              Acá abajo estaba la tabla «Totales por vendedor», siguiendo las
              pestañas de arriba. Se mudó a su propia sección, con su propio
              selector: ver `TotalesVendedores`, que cuenta por qué.
            */}
            {metricas(datos.agregado, abrir)}
          </div>
        )}
      </div>

      {/*
        Las operaciones del período. El listado ya filtraba por trimestre y por
        mes, así que acá no hubo que inventar nada, solo pedirlo.

        Se acota a VENTAS ESCRITURADAS porque es exactamente lo que cuenta la
        tarjeta: el agregado sale de `ventas(tx, anio, 'escriturada')`. Sin esos
        dos filtros, la lista traería alquileres y señadas que la tarjeta nunca
        contó, y los números no coincidirían.
      */}
      {detalle !== null && (
        <DetalleDrillModal
          titulo={detalle.titulo}
          subtitulo={`Ventas escrituradas · ${nombrePeriodo}`}
          filtro={{
            anio,
            ...detalle.periodo,
            tipo: 'venta',
            estado: 'escriturada',
            verTodo,
          }}
          foco={detalle.foco}
          lado={detalle.lado}
          onClose={() => setDetalle(null)}
        />
      )}
    </Card>
  );
}
