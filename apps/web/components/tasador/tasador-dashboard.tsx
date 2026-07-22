'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthPrincipal, RankingCaptacionItem, ResumenTasadorKpi, TasacionResumenDto } from '@vacker/types';
import { Button, Card, KpiCard } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarInforme, getKpisResumenTasador, getRankingCaptaciones } from '../../lib/tasador-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { ETIQUETA_ROL, rolPrincipal } from '../../lib/rbac';
import { CambiarEstadoModal } from './cambiar-estado-modal';
import { EstadoDistribucion } from './estado-distribucion';
import { RankingCaptacionesCards } from './ranking-captaciones-cards';
import { TasacionFila } from './tasacion-fila';
import { TasacionesDrillModal } from './tasaciones-drill-modal';
import { TendenciaBars, type TendenciaBar } from './tendencia-bars';

const MESES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const DESCRIPCION_ALCANCE: Partial<Record<string, string>> = {
  direccion: 've todas las tasaciones de la inmobiliaria',
  admin_tenant: 've todas las tasaciones de la inmobiliaria',
  team_leader: 've sus tasaciones y las de su equipo',
  vendedor: 've únicamente sus tasaciones',
};

type Vista = 'mensual' | 'trimestral' | 'anual';

interface Drill {
  titulo: string;
  subtitulo?: string;
  tasaciones: TasacionResumenDto[];
}

/** Fecha de una tasación (solo día, sin hora) — se lee en UTC para no correrse un día según el huso horario del browser. */
function claveMes(fecha: string): number {
  const d = new Date(fecha);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
function anioDe(fecha: string): number {
  return new Date(fecha).getUTCFullYear();
}
function trimestreDe(fecha: string): number {
  return Math.floor(new Date(fecha).getUTCMonth() / 3);
}

/** Datos iniciales resueltos por SSR (ver app/tasador/page.tsx). */
export interface InicialTasador {
  kpisMensual: ResumenTasadorKpi[];
  resumenAnual: ResumenTasadorKpi;
  rankingAnual: RankingCaptacionItem[];
  tasaciones: TasacionResumenDto[];
}

export function TasadorDashboard({
  principal,
  inicial,
}: {
  principal: AuthPrincipal;
  inicial: InicialTasador;
}) {
  const router = useRouter();
  const anio = useMemo(() => new Date().getFullYear(), []);

  // Datos ya agregados en el servidor (1 query cada uno) y traídos por SSR —
  // el componente arranca con datos, sin "Cargando…" ni la cascada
  // getAccessToken→4 fetches client-side sobre el hop lento hacia la base.
  const [kpisMensual] = useState<ResumenTasadorKpi[]>(inicial.kpisMensual);
  const [resumenAnual, setResumenAnual] = useState<ResumenTasadorKpi>(inicial.resumenAnual);
  const [rankingAnual, setRankingAnual] = useState<RankingCaptacionItem[]>(inicial.rankingAnual);
  // Liviano (sin comparables/fotos/análisis) y acotado al año — alcanza para
  // "últimas tasaciones" y el drill-down de cualquier período/estado/vendedor
  // del año en curso, sin pedir el historial completo del tenant.
  const [tasaciones, setTasaciones] = useState<TasacionResumenDto[]>(inicial.tasaciones);

  const [vista, setVista] = useState<Vista>('mensual');
  const [drill, setDrill] = useState<Drill | null>(null);
  const [modalEstado, setModalEstado] = useState<TasacionResumenDto | null>(null);
  const [generandoId, setGenerandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Un cambio de estado no afecta `kpisMensual` (totales del mes no cambian)
   * ni requiere volver a pedir `tasaciones` (se patchea localmente en
   * `onSaved`) — solo `resumenAnual`/`rankingAnual` dependen del estado.
   */
  function refrescarResumenYRanking(): void {
    getAccessToken()
      .then((accessToken) =>
        Promise.all([
          getKpisResumenTasador(accessToken, { anio, periodo: 'anual' }),
          getRankingCaptaciones(accessToken, { anio, periodo: 'anual' }),
        ]),
      )
      .then(([resumen, ranking]) => {
        setResumenAnual(resumen);
        setRankingAnual(ranking);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las tasaciones.');
      });
  }

  const rol = rolPrincipal(principal.roles);

  async function handleGenerarInforme(id: string) {
    setGenerandoId(id);
    setError(null);
    await abrirPdfEnPestana(async () => generarInforme(await getAccessToken(), id), {
      titulo: 'Generando informe de tasación',
      onError: setError,
    });
    setGenerandoId(null);
  }

  const now = useMemo(() => new Date(), []);
  const curMonth = now.getMonth();
  const curQuarter = Math.floor(curMonth / 3);

  const total = resumenAnual?.total ?? 0;
  const inMonth = kpisMensual?.[curMonth]?.total ?? 0;
  const inQuarter = kpisMensual
    ? kpisMensual.slice(curQuarter * 3, curQuarter * 3 + 3).reduce((acc, k) => acc + k.total, 0)
    : 0;
  const tasaCaptacion = resumenAnual ? Math.round(resumenAnual.tasaCaptacion * 100) : 0;

  const buckets: TendenciaBar[] = useMemo(() => {
    if (!kpisMensual) return [];
    if (vista === 'mensual') {
      return kpisMensual.map((k, i) => ({ label: MESES_ABBR[i]!, full: `${MESES_ABBR[i]} ${anio}`, total: k.total }));
    }
    if (vista === 'trimestral') {
      return [0, 1, 2, 3].map((q) => {
        const total3 = kpisMensual.slice(q * 3, q * 3 + 3).reduce((acc, k) => acc + k.total, 0);
        return { label: `T${q + 1}`, full: `Trimestre ${q + 1} · ${anio}`, total: total3 };
      });
    }
    return [{ label: String(anio), full: `Año ${anio}`, total: resumenAnual?.total ?? 0 }];
  }, [kpisMensual, resumenAnual, vista, anio]);

  function bucketTasaciones(full: string): TasacionResumenDto[] {
    if (!tasaciones) return [];
    if (vista === 'mensual') {
      const [mesLbl, anioStr] = full.split(' ');
      const mesIdx = MESES_ABBR.indexOf(mesLbl!);
      const key = Number(anioStr) * 12 + mesIdx;
      return tasaciones.filter((t) => claveMes(t.fecha) === key);
    }
    if (vista === 'trimestral') {
      const q = Number(full.match(/Trimestre (\d)/)![1]) - 1;
      return tasaciones.filter((t) => anioDe(t.fecha) === anio && trimestreDe(t.fecha) === q);
    }
    return tasaciones;
  }

  const distribucionEstado = resumenAnual?.distribucionEstado ?? [];
  const ultimasTasaciones = (tasaciones ?? []).slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Dashboard de tasaciones</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Resumen de la actividad de tasación y seguimiento de captación. Hacé clic en un período para ver sus
            tasaciones.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => router.push('/tasador/tasaciones/nueva')}>
            ＋ Nueva tasación
          </Button>
          <Button variant="secondary" onClick={() => router.push('/tasador/reporte')}>
            ⤓ Reporte de tasaciones
          </Button>
        </div>
      </div>

      {rol && (
        <div className="flex flex-wrap items-center gap-2 rounded-brand border border-line border-l-4 border-l-brand-red bg-white px-3.5 py-2.5 text-xs text-ink">
          <span className="rounded-full bg-brand-red px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {ETIQUETA_ROL[rol]}
          </span>
          <span>
            {principal.email} · {principal.tenant.nombre} —{' '}
          </span>
          <span className="text-muted">{DESCRIPCION_ALCANCE[rol]}</span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      {total === 0 ? (
        <div className="rounded-brand border border-dashed border-line bg-white p-14 text-center">
          <div className="text-3xl">🏷️</div>
          <h3 className="mt-3 text-base font-bold text-ink">Todavía no hay tasaciones</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Al generar tu primer informe, acá vas a ver el resumen mensual y trimestral, los estados y las últimas
            tasaciones.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => router.push('/tasador/tasaciones/nueva')}>
            Crear primera tasación
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Este mes"
              value={String(inMonth)}
              onClick={() =>
                setDrill({
                  titulo: `Tasaciones de ${MESES_ABBR[curMonth]} ${anio}`,
                  tasaciones: (tasaciones ?? []).filter((t) => claveMes(t.fecha) === curMonth + anio * 12),
                })
              }
            />
            <KpiCard
              label="Este trimestre"
              value={String(inQuarter)}
              onClick={() =>
                setDrill({
                  titulo: `Tasaciones · Trimestre ${curQuarter + 1} · ${anio}`,
                  tasaciones: (tasaciones ?? []).filter(
                    (t) => anioDe(t.fecha) === anio && trimestreDe(t.fecha) === curQuarter,
                  ),
                })
              }
            />
            <KpiCard
              label={`Total tasaciones · ${anio}`}
              value={String(total)}
              onClick={() => setDrill({ titulo: `Tasaciones · ${anio}`, tasaciones: tasaciones ?? [] })}
            />
            <KpiCard
              label="Tasa de captación"
              value={`${tasaCaptacion}%`}
              tone="success"
              onClick={() =>
                setDrill({
                  titulo: `Tasaciones captadas · ${anio}`,
                  tasaciones: (tasaciones ?? []).filter((t) => t.estado === 'Captada'),
                })
              }
            />
          </div>

          <div className="inline-flex w-full flex-wrap gap-1 rounded-[10px] bg-surface p-1 shadow-[inset_0_0_0_1px_var(--color-line)] sm:w-fit sm:flex-nowrap">
            {(
              [
                ['mensual', 'Mensual'],
                ['trimestral', 'Trimestral'],
                ['anual', 'Anual acumuladas'],
              ] as [Vista, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  vista === v ? 'bg-white text-brand-red shadow-sm' : 'text-muted hover:text-brand-red'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Card>
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">
                Tasaciones · {vista === 'anual' ? 'anual acumuladas' : vista}
              </p>
              <TendenciaBars
                datos={buckets}
                seleccionado={null}
                onSelect={(b) => {
                  if (b.total === 0) return;
                  setDrill({ titulo: `Tasaciones de ${b.full}`, tasaciones: bucketTasaciones(b.full) });
                }}
              />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Ranking de captaciones por vendedor</p>
              <RankingCaptacionesCards
                ranking={rankingAnual ?? []}
                seleccionado={null}
                onSelect={(r) =>
                  setDrill({
                    titulo: `Captaciones de ${r.nombre}`,
                    tasaciones: (tasaciones ?? []).filter((t) => t.estado === 'Captada' && t.agenteId === r.usuarioId),
                  })
                }
              />
            </Card>
          </div>

          <Card>
            <EstadoDistribucion
              titulo="Tasaciones por estado"
              periodoLabel="hacé clic para ver el detalle"
              distribucion={distribucionEstado}
              onSelect={(estado) =>
                setDrill({
                  titulo: `Tasaciones · ${estado}`,
                  tasaciones: (tasaciones ?? []).filter((t) => t.estado === estado),
                })
              }
            />
          </Card>

          <Card className="px-5 py-4">
            <div className="flex items-center justify-between pb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Últimas tasaciones</p>
              <button
                type="button"
                onClick={() => router.push('/tasador/tasaciones')}
                className="text-xs font-bold text-brand-red hover:underline"
              >
                Ver historial completo →
              </button>
            </div>
            <div className="flex flex-col">
              {ultimasTasaciones.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Sin tasaciones para mostrar.</p>
              ) : (
                ultimasTasaciones.map((t) => (
                  <TasacionFila
                    key={t.id}
                    tasacion={t}
                    onEstado={() => setModalEstado(t)}
                    onVer={() => handleGenerarInforme(t.id)}
                    generando={generandoId === t.id}
                  />
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {drill && (
        <TasacionesDrillModal
          titulo={drill.titulo}
          subtitulo={drill.subtitulo}
          tasaciones={drill.tasaciones}
          onClose={() => setDrill(null)}
        />
      )}

      {modalEstado && (
        <CambiarEstadoModal
          tasacion={modalEstado}
          onClose={() => setModalEstado(null)}
          onSaved={(patch) => {
            const id = modalEstado.id;
            setModalEstado(null);
            setTasaciones((prev) => prev?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? prev);
            refrescarResumenYRanking();
          }}
        />
      )}
    </div>
  );
}
