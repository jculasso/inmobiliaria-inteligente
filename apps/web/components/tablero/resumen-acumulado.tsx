'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgregadoKpi, RankingItem } from '@vacker/types';
import { Card, KpiCard } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { getAgregadosPorTrimestre, getResumenPeriodo, type PeriodoResumen } from '../../lib/tablero-api';
import { getOrFetch } from '../../lib/kpi-cache';
import { fmtNum, fmtUSD } from '../../lib/format';
import { TrimestreChart } from './trimestre-chart';
import { VendedorTotalesTable } from './vendedor-totales-table';

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

function metricas(agg: AgregadoKpi) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label="Volumen operado" value={fmtUSD(agg.volumen)} tone="brand" />
      <KpiCard label="Ticket promedio" value={fmtUSD(agg.ticketPromedio)} sub="por punta" />
      <KpiCard label="Operaciones" value={fmtNum(agg.operaciones)} sub={`${fmtNum(agg.puntas)} puntas`} />
      <KpiCard label="Puntas totales" value={fmtNum(agg.puntas)} />
      <KpiCard label="Puntas compradoras" value={fmtNum(agg.puntasCompradoras)} />
      <KpiCard label="Puntas vendedoras" value={fmtNum(agg.puntasVendedoras)} />
      <KpiCard label="Comisiones cobradas" value={fmtUSD(agg.comision)} sub="total generada" tone="success" />
    </div>
  );
}

interface Props {
  anio: number;
  mesSeleccionado: number;
  /** Acumulado anual ya resuelto server-side (mismo dato que pide el tab "Acumulado Anual" por defecto) — evita repetir esa consulta al montar. */
  inicial?: { agregado: AgregadoKpi; ranking: RankingItem[] };
}

export function ResumenAcumulado({ anio, mesSeleccionado, inicial }: Props) {
  const [tab, setTab] = useState<PeriodoResumen>('anual');
  const [trimestre, setTrimestre] = useState(() => Math.ceil(mesSeleccionado / 3));
  const [datos, setDatos] = useState<{ agregado: AgregadoKpi; ranking: RankingItem[] } | null>(inicial ?? null);
  const [loading, setLoading] = useState(!inicial);
  const [porTrimestre, setPorTrimestre] = useState<AgregadoKpi[] | null>(null);
  const primerRender = useRef(true);

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
        getOrFetch(`resumen:${anio}:${tab}:${mesSeleccionado}:${trimestre}`, () =>
          getResumenPeriodo(accessToken, { anio, periodo: tab, mes: mesSeleccionado, trimestre }),
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
  }, [anio, tab, mesSeleccionado, trimestre]);

  useEffect(() => {
    if (tab !== 'trimestral') return;
    let cancelado = false;
    getAccessToken()
      .then((accessToken) => getAgregadosPorTrimestre(accessToken, anio))
      .then((res) => {
        if (!cancelado) setPorTrimestre(res);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, tab]);

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
        <div className="border-b border-line p-4">
          <TrimestreChart datos={porTrimestre} seleccionado={trimestre} onSelect={setTrimestre} />
        </div>
      )}

      <div className="p-5">
        {loading || !datos ? (
          <p className="py-6 text-sm text-muted">Cargando…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {metricas(datos.agregado)}
            <div>
              <p className="mb-2 text-sm font-bold text-ink">
                👥 Totales por vendedor <span className="text-xs font-normal text-muted">({datos.ranking.length} vendedores)</span>
              </p>
              <div className="rounded-brand border border-line">
                <VendedorTotalesTable items={datos.ranking} anio={anio} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
