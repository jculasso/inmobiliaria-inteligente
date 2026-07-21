'use client';

import { useEffect, useState } from 'react';
import type { EstadoTasacion, RankingCaptacionItem, ResumenTasadorKpi, TasacionDto, TasadorKpiFiltro } from '@vacker/types';
import { EstadoTasacionSchema, ESTADO_TASACION_COLOR } from '@vacker/types';
import { Button, Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  generarInformeReporte,
  getKpisResumenTasador,
  getRankingCaptaciones,
  listTasaciones,
} from '../../lib/tasador-api';
import { fmtUSD } from '../../lib/format';
import { EstadoDistribucion } from './estado-distribucion';
import { RankingCaptaciones } from './ranking-captaciones';
import { KpiCard } from '../tablero/kpi-card';

type Periodo = 'anual' | 'trimestral' | 'mensual';

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'anual', label: 'Anual' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'mensual', label: 'Mensual' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADOS = EstadoTasacionSchema.options;

function detalleEstado(t: TasacionDto): string {
  if (t.estado === 'Captada' && t.exclusividad) {
    return t.exclusividad.tipo === 'exclusiva' ? `Exclusiva ${t.exclusividad.dias} días` : 'No exclusiva';
  }
  if (t.estado === 'No captada' && t.motivoNoCaptada) return t.motivoNoCaptada;
  return '—';
}

export function ReporteView({ anioInicial }: { anioInicial: number }) {
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [anio] = useState(anioInicial);
  const hoy = new Date();
  const [trimestre, setTrimestre] = useState(Math.ceil((hoy.getMonth() + 1) / 3));
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTasacion | 'Todas'>('Todas');

  const [resumen, setResumen] = useState<ResumenTasadorKpi | null>(null);
  const [ranking, setRanking] = useState<RankingCaptacionItem[]>([]);
  const [tasaciones, setTasaciones] = useState<TasacionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtro: TasadorKpiFiltro =
    periodo === 'mensual'
      ? { anio, periodo, mes }
      : periodo === 'trimestral'
        ? { anio, periodo, trimestre }
        : { anio, periodo };

  const periodoLabel =
    periodo === 'mensual' ? `${MESES[mes - 1]} ${anio}` : periodo === 'trimestral' ? `Trimestre ${trimestre} · ${anio}` : `Año ${anio}`;

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    getAccessToken()
      .then((accessToken) =>
        Promise.all([
          getKpisResumenTasador(accessToken, filtro),
          getRankingCaptaciones(accessToken, filtro),
          listTasaciones(accessToken, { anio, mes: periodo === 'mensual' ? mes : undefined }),
        ]),
      )
      .then(([r, rk, t]) => {
        if (cancelado) return;
        setResumen(r);
        setRanking(rk);
        setTasaciones(t);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, periodo, trimestre, mes]);

  async function handleGenerarPdf() {
    setGenerando(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      const { url } = await generarInformeReporte(accessToken, filtro);
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      setGenerando(false);
    }
  }

  const tasacionesFiltradas =
    filtroEstado === 'Todas' ? tasaciones : tasaciones.filter((t) => t.estado === filtroEstado);
  const valorTotal = tasaciones.reduce((s, t) => s + (t.valorRecomendado ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Reporte de tasaciones</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-brand border border-line p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodo(p.key)}
                className={`rounded-brand px-3 py-1.5 text-sm font-semibold transition-colors ${
                  periodo === p.key ? 'bg-brand-red text-white' : 'text-muted hover:bg-surface'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'trimestral' && (
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value))}
              className="h-9 rounded-brand border border-line px-2 text-sm"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Trimestre {q}
                </option>
              ))}
            </select>
          )}
          {periodo === 'mensual' && (
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="h-9 rounded-brand border border-line px-2 text-sm"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <Button type="button" variant="primary" onClick={handleGenerarPdf} disabled={generando || loading}>
            {generando ? 'Generando…' : '🖨 Guardar PDF'}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      {loading || !resumen ? (
        <p className="py-6 text-sm text-muted">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Tasaciones" value={String(resumen.total)} icon="📄" />
            <KpiCard
              label="Captadas"
              value={String(resumen.distribucionEstado.find((d) => d.estado === 'Captada')?.cantidad ?? 0)}
              icon="✅"
              tone="success"
            />
            <KpiCard label="Tasa de captación" value={`${Math.round(resumen.tasaCaptacion * 100)}%`} icon="🎯" />
            <KpiCard label="Valor publicación total" value={fmtUSD(valorTotal)} icon="💵" tone="brand" />
          </div>

          <Card>
            <EstadoDistribucion distribucion={resumen.distribucionEstado} periodoLabel={periodoLabel} />
          </Card>

          <div className="flex flex-wrap gap-1.5">
            {(['Todas', ...ESTADOS] as const).map((op) => {
              const n = op === 'Todas' ? tasaciones.length : tasaciones.filter((t) => t.estado === op).length;
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => setFiltroEstado(op)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    filtroEstado === op
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : 'border-line text-muted hover:border-brand-red/40'
                  }`}
                >
                  {op} <span className="ml-1 text-muted">{n}</span>
                </button>
              );
            })}
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Propiedad</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Vendedor</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Detalle</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {tasacionesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted">
                        Sin tasaciones para {periodoLabel}.
                      </td>
                    </tr>
                  ) : (
                    tasacionesFiltradas.map((t) => (
                      <tr key={t.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">{t.fecha}</td>
                        <td className="px-4 py-2">
                          {t.direccion}
                          {t.barrio ? ` · ${t.barrio}` : ''}
                        </td>
                        <td className="px-4 py-2">{t.cliente}</td>
                        <td className="px-4 py-2">{t.agente.nombre}</td>
                        <td className="px-4 py-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              background: `${ESTADO_TASACION_COLOR[t.estado]}22`,
                              color: ESTADO_TASACION_COLOR[t.estado],
                            }}
                          >
                            {t.estado}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">{detalleEstado(t)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-red">
                          {fmtUSD(t.valorRecomendado)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <RankingCaptaciones ranking={ranking} periodoLabel={periodoLabel} />
          </Card>
        </>
      )}
    </div>
  );
}
