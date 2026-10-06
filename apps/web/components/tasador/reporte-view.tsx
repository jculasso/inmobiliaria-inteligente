'use client';

import { useEffect, useState } from 'react';
import type {
  EstadoTasacion,
  RankingCaptacionItem,
  ResumenTasadorKpi,
  TasacionResumenDto,
  TasadorKpiFiltro,
} from '@vacker/types';
import { EstadoTasacionSchema } from '@vacker/types';
import { Button, Card, KpiCard } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  generarInformeReporte,
  getKpisResumenTasador,
  getRankingCaptaciones,
  listTasacionesResumen,
} from '../../lib/tasador-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtUSD } from '../../lib/format';
import { detalleEstado, tonoEstadoTasacion } from '../../lib/tasacion-estado';
import {
  CLASE_FOCO,
  CLASE_TH,
  EncabezadoPagina,
  Insignia,
  MensajeError,
  Segmentado,
} from '../piezas';
import { ToggleVerTodo } from '../tablero/toggle-ver-todo';
import { EstadoDistribucion } from './estado-distribucion';
import { RankingCaptaciones } from './ranking-captaciones';

type Periodo = 'anual' | 'trimestral' | 'mensual';

const PERIODOS: readonly (readonly [Periodo, string])[] = [
  ['anual', 'Anual'],
  ['trimestral', 'Trimestral'],
  ['mensual', 'Mensual'],
];

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const ESTADOS = EstadoTasacionSchema.options;

/**
 * `verTodo` llega desde la URL (lo pone `ToggleVerTodo`) y NO es estado local:
 * así el reporte comparte el mismo mecanismo que el resto de las pantallas y
 * un enlace copiado conserva lo que se estaba mirando.
 *
 * Sin esto, el reporte pedía siempre el alcance por defecto —lo propio— y un
 * usuario de dirección que no fuera admin veía solo SUS tasaciones, sin ninguna
 * forma de expandir. Es la única pantalla del Tasador que no tenía el check.
 */
export function ReporteView({
  anioInicial,
  verTodo = false,
  puedeVerTodo = false,
}: {
  anioInicial: number;
  verTodo?: boolean;
  puedeVerTodo?: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [anio] = useState(anioInicial);
  const hoy = new Date();
  const [trimestre, setTrimestre] = useState(Math.ceil((hoy.getMonth() + 1) / 3));
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTasacion | 'Todas'>('Todas');

  const [resumen, setResumen] = useState<ResumenTasadorKpi | null>(null);
  const [ranking, setRanking] = useState<RankingCaptacionItem[]>([]);
  const [tasaciones, setTasaciones] = useState<TasacionResumenDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `verTodo` va DENTRO del filtro y no aparte: el mismo objeto alimenta las
  // tres consultas y el PDF, así que la pantalla y el informe descargado no
  // pueden terminar mostrando alcances distintos.
  const filtro: TasadorKpiFiltro =
    periodo === 'mensual'
      ? { anio, periodo, mes, verTodo }
      : periodo === 'trimestral'
        ? { anio, periodo, trimestre, verTodo }
        : { anio, periodo, verTodo };

  const periodoLabel =
    periodo === 'mensual'
      ? `${MESES[mes - 1]} ${anio}`
      : periodo === 'trimestral'
        ? `Trimestre ${trimestre} · ${anio}`
        : `Año ${anio}`;

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    getAccessToken()
      .then((accessToken) =>
        Promise.all([
          getKpisResumenTasador(accessToken, filtro),
          getRankingCaptaciones(accessToken, filtro),
          listTasacionesResumen(accessToken, {
            anio,
            mes: periodo === 'mensual' ? mes : undefined,
            verTodo,
          }),
        ]),
      )
      .then(([r, rk, t]) => {
        if (cancelado) return;
        setResumen(r);
        setRanking(rk);
        setTasaciones(t);
      })
      .catch((err) => {
        if (!cancelado)
          setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, periodo, trimestre, mes, verTodo]);

  async function handleGenerarPdf() {
    setGenerando(true);
    setError(null);
    await abrirPdfEnPestana(async () => generarInformeReporte(await getAccessToken(), filtro), {
      titulo: 'Generando reporte de tasaciones',
      onError: setError,
    });
    setGenerando(false);
  }

  const tasacionesFiltradas =
    filtroEstado === 'Todas' ? tasaciones : tasaciones.filter((t) => t.estado === filtroEstado);
  const valorTotal = tasaciones.reduce((s, t) => s + (t.valorRecomendado ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Reporte de tasaciones">
        {puedeVerTodo && <ToggleVerTodo />}
        <Segmentado etiqueta="Período" opciones={PERIODOS} valor={periodo} onCambio={setPeriodo} />
        {periodo === 'trimestral' && (
          <select
            aria-label="Trimestre"
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
            aria-label="Mes"
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
        <Button
          type="button"
          variant="primary"
          onClick={handleGenerarPdf}
          disabled={generando || loading}
        >
          {generando ? 'Generando…' : '📄 Descargar PDF'}
        </Button>
      </EncabezadoPagina>

      <MensajeError>{error}</MensajeError>

      {!resumen ? (
        <p className="py-6 text-sm text-muted">Cargando…</p>
      ) : (
        // Se mantienen los datos del período anterior (atenuados) mientras se
        // recarga el nuevo, en vez de colapsar todo a "Cargando…" y volver a
        // montar — eso hacía "saltar" el layout al cambiar Anual/Trimestral/Mensual.
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Tasaciones" value={String(resumen.total)} icon="📄" />
            <KpiCard
              label="Captadas"
              value={String(
                resumen.distribucionEstado.find((d) => d.estado === 'Captada')?.cantidad ?? 0,
              )}
              icon="✅"
              tone="success"
            />
            <KpiCard
              label="Tasa de captación"
              value={`${Math.round(resumen.tasaCaptacion * 100)}%`}
              icon="🎯"
            />
            <KpiCard
              label="Valor publicación total"
              value={fmtUSD(valorTotal)}
              icon="💵"
              tone="brand"
            />
          </div>

          <Card>
            <EstadoDistribucion
              distribucion={resumen.distribucionEstado}
              periodoLabel={periodoLabel}
            />
          </Card>

          <div className="flex flex-wrap gap-1.5">
            {(['Todas', ...ESTADOS] as const).map((op) => {
              const n =
                op === 'Todas'
                  ? tasaciones.length
                  : tasaciones.filter((t) => t.estado === op).length;
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => setFiltroEstado(op)}
                  aria-pressed={filtroEstado === op}
                  className={`${CLASE_FOCO} rounded-full border px-3 py-1.5 text-xs ${
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
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={CLASE_TH}>Fecha</th>
                    <th className={CLASE_TH}>Propiedad</th>
                    <th className={CLASE_TH}>Cliente</th>
                    <th className={CLASE_TH}>Vendedor</th>
                    <th className={CLASE_TH}>Estado</th>
                    <th className={CLASE_TH}>Detalle</th>
                    <th className={`${CLASE_TH} text-right`}>Valor</th>
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
                        {/*
                          `whitespace-nowrap` además del formato: la columna es
                          angosta y el navegador partía `2026-08-07` por el
                          guión, dejando la fecha en dos líneas y desalineando
                          toda la fila.
                        */}
                        <td className="whitespace-nowrap px-4 py-2">{fmtFecha(t.fecha)}</td>
                        <td className="px-4 py-2">
                          {t.direccion}
                          {t.barrio ? ` · ${t.barrio}` : ''}
                        </td>
                        <td className="px-4 py-2">{t.cliente}</td>
                        <td className="px-4 py-2">{t.agente.nombre}</td>
                        <td className="px-4 py-2">
                          <Insignia tono={tonoEstadoTasacion(t.estado)}>{t.estado}</Insignia>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">{detalleEstado(t) ?? '—'}</td>
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
        </div>
      )}
    </div>
  );
}
