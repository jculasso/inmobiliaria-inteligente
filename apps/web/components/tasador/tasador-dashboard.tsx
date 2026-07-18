'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RankingCaptacionItem, ResumenTasadorKpi } from '@vacker/types';
import { Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { getKpisResumenTasador, getRankingCaptaciones } from '../../lib/tasador-api';
import { fmtNum } from '../../lib/format';
import { KpiCard } from '../tablero/kpi-card';

type Periodo = 'anual' | 'trimestral' | 'mensual';

const TABS: { key: Periodo; label: string; icono: string }[] = [
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

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

/** Query params de drill-down hacia `/tasador/tasaciones`: la lista no tiene
 * filtro de trimestre, así que en ese tab el drill-down cae en el año completo. */
function paramsBase(anio: number, tab: Periodo, mes: number): string {
  const p = new URLSearchParams({ anio: String(anio) });
  if (tab === 'mensual') p.set('mes', String(mes));
  return p.toString();
}

export function TasadorDashboard({ anioInicial }: { anioInicial: number }) {
  const [anio] = useState(anioInicial);
  const [tab, setTab] = useState<Periodo>('anual');
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [trimestre, setTrimestre] = useState(() => Math.ceil((hoy.getMonth() + 1) / 3));
  const [resumen, setResumen] = useState<ResumenTasadorKpi | null>(null);
  const [ranking, setRanking] = useState<RankingCaptacionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    const filtro = { anio, periodo: tab, mes, trimestre };
    getAccessToken()
      .then((accessToken) =>
        Promise.all([getKpisResumenTasador(accessToken, filtro), getRankingCaptaciones(accessToken, filtro)]),
      )
      .then(([r, rk]) => {
        if (cancelado) return;
        setResumen(r);
        setRanking(rk);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, tab, mes, trimestre]);

  const drill = paramsBase(anio, tab, mes);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Dashboard</h2>
      </div>

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

        {tab === 'mensual' && (
          <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMes(m)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  mes === m ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          {loading || !resumen ? (
            <p className="py-6 text-sm text-muted">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <KpiCard label="Total tasaciones" value={fmtNum(resumen.total)} icon="🏠" tone="brand" />
                <KpiCard
                  label="Tasa de captación"
                  value={fmtPct(resumen.tasaCaptacion)}
                  icon="🎯"
                  tone="success"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Distribución por estado</p>
                <div className="flex flex-wrap gap-2">
                  {resumen.distribucionEstado.map((d) => (
                    <Link
                      key={d.estado}
                      href={`/tasador/tasaciones?${drill}&estado=${encodeURIComponent(d.estado)}`}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand-red hover:text-brand-red"
                    >
                      {d.estado} <span className="text-muted">· {fmtNum(d.cantidad)}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">
                  🏆 Ranking de captaciones{' '}
                  <span className="text-xs font-normal text-muted">({ranking.length} agentes)</span>
                </p>
                <div className="overflow-x-auto rounded-brand border border-line bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-2">Agente</th>
                        <th className="px-4 py-2">Captadas</th>
                        <th className="px-4 py-2">Total</th>
                        <th className="px-4 py-2">Tasa</th>
                        <th className="px-4 py-2">Participación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-muted">
                            Sin datos para mostrar.
                          </td>
                        </tr>
                      ) : (
                        ranking.map((r) => (
                          <tr key={r.usuarioId} className="border-b border-line last:border-0">
                            <td className="px-4 py-2">
                              <Link
                                href={`/tasador/tasaciones?${drill}&agenteId=${r.usuarioId}`}
                                className="font-medium text-ink hover:text-brand-red hover:underline"
                              >
                                {r.nombre}
                              </Link>
                            </td>
                            <td className="px-4 py-2">{fmtNum(r.captadas)}</td>
                            <td className="px-4 py-2 text-muted">{fmtNum(r.total)}</td>
                            <td className="px-4 py-2">{fmtPct(r.tasaCaptacion)}</td>
                            <td className="px-4 py-2 text-muted">{fmtPct(r.peso)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
