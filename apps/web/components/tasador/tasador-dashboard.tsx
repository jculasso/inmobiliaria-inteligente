'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RankingCaptacionItem, ResumenTasadorKpi, TasacionFiltro, TasadorKpiFiltro } from '@vacker/types';
import { Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { getKpisMensualTasador, getKpisResumenTasador, getRankingCaptaciones } from '../../lib/tasador-api';
import { fmtNum } from '../../lib/format';
import { KpiCard } from '../tablero/kpi-card';
import { EstadoDistribucion } from './estado-distribucion';
import { RankingCaptaciones } from './ranking-captaciones';
import { TasacionDrillModal } from './tasacion-drill-modal';
import { TasacionTendenciaChart, type TendenciaBar } from './tasacion-tendencia-chart';

type Vista = 'mensual' | 'trimestral' | 'anual';

const VISTAS: { key: Vista; label: string; icono: string }[] = [
  { key: 'mensual', label: 'Vista Mensual', icono: '🗓️' },
  { key: 'trimestral', label: 'Vista Trimestral', icono: '📈' },
  { key: 'anual', label: 'Vista Anual', icono: '📅' },
];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

/** Suma varios ResumenTasadorKpi recalculando la tasa de captación desde la distribución (no es promediable). */
function sumarResumen(lista: ResumenTasadorKpi[]): ResumenTasadorKpi {
  const distribucion = new Map<string, number>();
  let total = 0;
  for (const r of lista) {
    total += r.total;
    for (const d of r.distribucionEstado) {
      distribucion.set(d.estado, (distribucion.get(d.estado) ?? 0) + d.cantidad);
    }
  }
  const captadas = distribucion.get('Captada') ?? 0;
  return {
    total,
    tasaCaptacion: total ? captadas / total : 0,
    distribucionEstado: [...distribucion.entries()].map(([estado, cantidad]) => ({
      estado: estado as ResumenTasadorKpi['distribucionEstado'][number]['estado'],
      cantidad,
    })),
  };
}

interface Drill {
  titulo: string;
  subtitulo: string;
  filtro: TasacionFiltro;
}

/**
 * El listado de tasaciones no tiene filtro de trimestre (`TasacionFiltro` no
 * lo soporta) — en la vista trimestral, el drill-down cae en el año completo.
 */
function filtroDrill(filtroSel: TasadorKpiFiltro): TasacionFiltro {
  return { anio: filtroSel.anio, ...(filtroSel.periodo === 'mensual' ? { mes: filtroSel.mes } : {}) };
}

export function TasadorDashboard({ anioInicial }: { anioInicial: number }) {
  const [anio] = useState(anioInicial);
  const [vista, setVista] = useState<Vista>('mensual');
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const trimestreActual = Math.ceil(mesActual / 3);
  const [seleccion, setSeleccion] = useState(mesActual - 1);
  const [mensual, setMensual] = useState<ResumenTasadorKpi[] | null>(null);
  const [resumenSel, setResumenSel] = useState<ResumenTasadorKpi | null>(null);
  const [ranking, setRanking] = useState<RankingCaptacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<Drill | null>(null);

  // Al cambiar de vista, la selección arranca en el período "actual" de esa vista.
  useEffect(() => {
    setSeleccion(vista === 'mensual' ? mesActual - 1 : vista === 'trimestral' ? trimestreActual - 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  useEffect(() => {
    let cancelado = false;
    getAccessToken()
      .then((accessToken) => getKpisMensualTasador(accessToken, anio))
      .then((r) => {
        if (!cancelado) setMensual(r);
      });
    return () => {
      cancelado = true;
    };
  }, [anio]);

  const filtroSel: TasadorKpiFiltro = useMemo(() => {
    if (vista === 'mensual') return { anio, periodo: 'mensual', mes: seleccion + 1 };
    if (vista === 'trimestral') return { anio, periodo: 'trimestral', trimestre: seleccion + 1 };
    return { anio, periodo: 'anual' };
  }, [anio, vista, seleccion]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    getAccessToken()
      .then((accessToken) =>
        Promise.all([getKpisResumenTasador(accessToken, filtroSel), getRankingCaptaciones(accessToken, filtroSel)]),
      )
      .then(([r, rk]) => {
        if (cancelado) return;
        setResumenSel(r);
        setRanking(rk);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtroSel]);

  // 4 KPIs simultáneos, derivados de mensual() sin llamadas extra.
  const kpiEsteMes = mensual?.[mesActual - 1];
  const kpiEsteTrimestre = mensual
    ? sumarResumen(mensual.slice((trimestreActual - 1) * 3, trimestreActual * 3))
    : undefined;
  const kpiTotal = mensual ? sumarResumen(mensual) : undefined;

  const tendenciaDatos: TendenciaBar[] = useMemo(() => {
    if (!mensual) return [];
    if (vista === 'mensual') return mensual.map((r, i) => ({ label: MESES[i]!, total: r.total }));
    if (vista === 'trimestral') {
      return [1, 2, 3, 4].map((q) => ({
        label: `Q${q}`,
        total: sumarResumen(mensual.slice((q - 1) * 3, q * 3)).total,
      }));
    }
    return [{ label: String(anio), total: sumarResumen(mensual).total }];
  }, [mensual, vista, anio]);

  const periodoLabel =
    vista === 'mensual' ? `${MESES[seleccion]} ${anio}` : vista === 'trimestral' ? `Q${seleccion + 1} ${anio}` : `año ${anio}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Dashboard</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Este mes" value={fmtNum(kpiEsteMes?.total ?? 0)} icon="🗓️" />
        <KpiCard label="Este trimestre" value={fmtNum(kpiEsteTrimestre?.total ?? 0)} icon="📈" />
        <KpiCard label="Total tasaciones" value={fmtNum(kpiTotal?.total ?? 0)} icon="🏠" tone="brand" />
        <KpiCard label="Tasa de captación" value={fmtPct(kpiTotal?.tasaCaptacion ?? 0)} icon="🎯" tone="success" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap gap-1 border-b border-line p-2">
          {VISTAS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVista(v.key)}
              className={`rounded-brand px-3 py-2 text-sm font-semibold transition-colors ${
                vista === v.key ? 'bg-brand-red text-white' : 'text-muted hover:bg-surface'
              }`}
            >
              <span aria-hidden>{v.icono}</span> {v.label}
            </button>
          ))}
        </div>

        <div className="border-b border-line p-4">
          {tendenciaDatos.length > 0 && (
            <TasacionTendenciaChart datos={tendenciaDatos} seleccionado={seleccion} onSelect={setSeleccion} />
          )}
        </div>

        <div className="p-5">
          {loading || !resumenSel ? (
            <p className="py-6 text-sm text-muted">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-5">
              <EstadoDistribucion
                distribucion={resumenSel.distribucionEstado}
                periodoLabel={periodoLabel}
                onSelect={(estado) =>
                  setDrill({ titulo: estado, subtitulo: periodoLabel, filtro: { ...filtroDrill(filtroSel), estado } })
                }
              />

              <RankingCaptaciones
                ranking={ranking}
                periodoLabel={periodoLabel}
                onSelectAgente={(usuarioId, nombre) =>
                  setDrill({ titulo: nombre, subtitulo: periodoLabel, filtro: { ...filtroDrill(filtroSel), agenteId: usuarioId } })
                }
              />
            </div>
          )}
        </div>
      </Card>

      {drill && (
        <TasacionDrillModal
          titulo={drill.titulo}
          subtitulo={drill.subtitulo}
          filtro={drill.filtro}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
