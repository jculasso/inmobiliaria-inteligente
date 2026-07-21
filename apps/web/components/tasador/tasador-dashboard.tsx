'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EstadoTasacionSchema, type AuthPrincipal, type TasacionDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarInforme, listTasaciones } from '../../lib/tasador-api';
import { fmtUSD } from '../../lib/format';
import { ETIQUETA_ROL, rolPrincipal } from '../../lib/rbac';
import { detalleEstado, estadoClass } from '../../lib/tasacion-estado';
import { CambiarEstadoModal } from './cambiar-estado-modal';
import { EstadoDistribucion } from './estado-distribucion';
import { RankingCaptacionesCards } from './ranking-captaciones-cards';
import { TendenciaBars, type TendenciaBar } from './tendencia-bars';

const MESES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ESTADOS = EstadoTasacionSchema.options;

const DESCRIPCION_ALCANCE: Partial<Record<string, string>> = {
  direccion: 've todas las tasaciones del tenant',
  admin_tenant: 've todas las tasaciones del tenant',
  team_leader: 've sus tasaciones y las de su equipo',
  vendedor: 've únicamente sus tasaciones',
};

type Vista = 'mensual' | 'trimestral' | 'anual';

interface Drill {
  full: string;
  titulo: string;
  tasaciones: TasacionDto[];
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

export function TasadorDashboard({ principal }: { principal: AuthPrincipal }) {
  const router = useRouter();
  const [tasaciones, setTasaciones] = useState<TasacionDto[] | null>(null);
  const [vista, setVista] = useState<Vista>('mensual');
  const [drill, setDrill] = useState<Drill | null>(null);
  const [modalEstado, setModalEstado] = useState<TasacionDto | null>(null);
  const [generandoId, setGenerandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getAccessToken()
      .then((accessToken) => listTasaciones(accessToken, {}))
      .then((r) => {
        if (!cancelado) setTasaciones(r);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudieron cargar las tasaciones.');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const rol = rolPrincipal(principal.roles);

  async function handleGenerarInforme(id: string) {
    setGenerandoId(id);
    try {
      const accessToken = await getAccessToken();
      const { url } = await generarInforme(accessToken, id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el informe.');
    } finally {
      setGenerandoId(null);
    }
  }

  const now = useMemo(() => new Date(), []);
  const curMonthKey = now.getFullYear() * 12 + now.getMonth();
  const curQuarter = Math.floor(now.getMonth() / 3);
  const curYear = now.getFullYear();

  const total = tasaciones?.length ?? 0;
  const inMonth = tasaciones?.filter((t) => claveMes(t.fecha) === curMonthKey).length ?? 0;
  const inQuarter =
    tasaciones?.filter((t) => anioDe(t.fecha) === curYear && trimestreDe(t.fecha) === curQuarter).length ?? 0;
  const captadas = tasaciones?.filter((t) => t.estado === 'Captada').length ?? 0;
  const tasaCaptacion = total ? Math.round((captadas / total) * 100) : 0;

  const buckets: TendenciaBar[] = useMemo(() => {
    if (!tasaciones) return [];
    if (vista === 'mensual') {
      return Array.from({ length: 6 }, (_, idx) => {
        const i = 5 - idx;
        const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = dt.getFullYear() * 12 + dt.getMonth();
        const recs = tasaciones.filter((t) => claveMes(t.fecha) === key);
        return { label: MESES_ABBR[dt.getMonth()]!, full: `${MESES_ABBR[dt.getMonth()]} ${dt.getFullYear()}`, total: recs.length };
      });
    }
    if (vista === 'trimestral') {
      return [0, 1, 2, 3].map((q) => {
        const recs = tasaciones.filter((t) => anioDe(t.fecha) === curYear && trimestreDe(t.fecha) === q);
        return { label: `T${q + 1}`, full: `Trimestre ${q + 1} · ${curYear}`, total: recs.length };
      });
    }
    const years = Array.from(new Set(tasaciones.map((t) => anioDe(t.fecha)))).sort();
    return years.map((y) => {
      const recs = tasaciones.filter((t) => anioDe(t.fecha) === y);
      return { label: String(y), full: `Año ${y} (acumulado)`, total: recs.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasaciones, vista]);

  function bucketTasaciones(full: string): TasacionDto[] {
    if (!tasaciones) return [];
    if (vista === 'mensual') {
      const [mesLbl, anioStr] = full.split(' ');
      const mesIdx = MESES_ABBR.indexOf(mesLbl!);
      const key = Number(anioStr) * 12 + mesIdx;
      return tasaciones.filter((t) => claveMes(t.fecha) === key);
    }
    if (vista === 'trimestral') {
      const q = Number(full.match(/Trimestre (\d)/)![1]) - 1;
      return tasaciones.filter((t) => anioDe(t.fecha) === curYear && trimestreDe(t.fecha) === q);
    }
    const y = Number(full.match(/Año (\d+)/)![1]);
    return tasaciones.filter((t) => anioDe(t.fecha) === y);
  }

  const ranking = useMemo(() => {
    if (!tasaciones) return [];
    const porAgente = new Map<string, { usuarioId: string; nombre: string; captadas: number }>();
    for (const t of tasaciones) {
      if (t.estado !== 'Captada') continue;
      const item = porAgente.get(t.agenteId) ?? { usuarioId: t.agenteId, nombre: t.agente.nombre, captadas: 0 };
      item.captadas += 1;
      porAgente.set(t.agenteId, item);
    }
    return [...porAgente.values()].sort((a, b) => b.captadas - a.captadas);
  }, [tasaciones]);

  const distribucionEstado = useMemo(
    () =>
      ESTADOS.map((estado) => ({
        estado,
        cantidad: tasaciones?.filter((t) => t.estado === estado).length ?? 0,
      })),
    [tasaciones],
  );

  const listaActual = drill ? drill.tasaciones : (tasaciones ?? []).slice(0, 10);

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

      {tasaciones === null ? (
        <p className="py-6 text-sm text-muted">Cargando…</p>
      ) : total === 0 ? (
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
            <div className="rounded-brand border border-line bg-white p-4 shadow-sm">
              <div className="text-2xl font-extrabold leading-none text-ink">{inMonth}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Este mes</div>
            </div>
            <div className="rounded-brand border border-line bg-white p-4 shadow-sm">
              <div className="text-2xl font-extrabold leading-none text-ink">{inQuarter}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Este trimestre</div>
            </div>
            <div className="rounded-brand border border-line bg-white p-4 shadow-sm">
              <div className="text-2xl font-extrabold leading-none text-ink">{total}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Total tasaciones</div>
            </div>
            <div className="rounded-brand border border-line bg-white p-4 shadow-sm">
              <div className="text-2xl font-extrabold leading-none text-success">{tasaCaptacion}%</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Tasa de captación</div>
            </div>
          </div>

          <div className="inline-flex w-fit gap-1 rounded-[10px] bg-surface p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
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
                onClick={() => {
                  setVista(v);
                  setDrill(null);
                }}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  vista === v ? 'bg-white text-brand-red shadow-sm' : 'text-muted hover:text-brand-red'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <div className="rounded-brand border border-line bg-white p-5 shadow-sm">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">
                Tasaciones · {vista === 'anual' ? 'anual acumuladas' : vista}
              </p>
              <TendenciaBars
                datos={buckets}
                seleccionado={drill?.full ?? null}
                onSelect={(b) =>
                  setDrill(
                    b.total > 0
                      ? { full: b.full, titulo: `Tasaciones de ${b.full}`, tasaciones: bucketTasaciones(b.full) }
                      : null,
                  )
                }
              />
            </div>
            <div className="rounded-brand border border-line bg-white p-5 shadow-sm">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Ranking de captaciones por vendedor</p>
              <RankingCaptacionesCards
                ranking={ranking}
                seleccionado={drill?.full.startsWith('Captaciones de ') ? drill.full.replace('Captaciones de ', '') : null}
                onSelect={(r) =>
                  setDrill({
                    full: `Captaciones de ${r.nombre}`,
                    titulo: `Captaciones de ${r.nombre}`,
                    tasaciones: (tasaciones ?? []).filter((t) => t.estado === 'Captada' && t.agenteId === r.usuarioId),
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-brand border border-line bg-white p-5 shadow-sm">
            <EstadoDistribucion
              titulo="Tasaciones por estado"
              periodoLabel="hacé clic para ver el detalle"
              distribucion={distribucionEstado}
              onSelect={(estado) =>
                setDrill({
                  full: `estado:${estado}`,
                  titulo: `Tasaciones · ${estado}`,
                  tasaciones: (tasaciones ?? []).filter((t) => t.estado === estado),
                })
              }
            />
          </div>

          <div className="rounded-brand border border-line bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between pb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {drill ? `${drill.titulo} (${drill.tasaciones.length})` : 'Últimas tasaciones'}
              </p>
              {drill ? (
                <button type="button" onClick={() => setDrill(null)} className="text-xs font-bold text-brand-red hover:underline">
                  × Quitar filtro
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/tasador/tasaciones')}
                  className="text-xs font-bold text-brand-red hover:underline"
                >
                  Ver historial completo →
                </button>
              )}
            </div>
            <div className="flex flex-col">
              {listaActual.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Sin tasaciones para mostrar.</p>
              ) : (
                listaActual.map((t) => {
                  const det = detalleEstado(t);
                  return (
                    <div
                      key={t.id}
                      className="grid grid-cols-[2fr_1fr_130px_auto] items-center gap-3.5 border-t border-surface py-3 first:border-t-0"
                    >
                      <div>
                        <div className="text-sm font-bold text-ink">{t.direccion}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {t.cliente} · {t.tipoPropiedad} · {t.agente.nombre}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-brand-red">{fmtUSD(t.valorRecomendado)}</div>
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setModalEstado(t)}
                          className={`w-full rounded-full px-2 py-1 text-center text-xs font-bold ${estadoClass(t.estado)}`}
                        >
                          {t.estado}
                        </button>
                        {det && (
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${estadoClass(t.estado)}`}>
                            {det}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => router.push(`/tasador/tasaciones/${t.id}/editar`)}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand-red hover:text-brand-red"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerarInforme(t.id)}
                          disabled={generandoId === t.id}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand-red hover:text-brand-red disabled:opacity-50"
                        >
                          {generandoId === t.id ? '…' : 'Ver'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {modalEstado && (
        <CambiarEstadoModal
          tasacion={modalEstado}
          onClose={() => setModalEstado(null)}
          onSaved={() => {
            setModalEstado(null);
            getAccessToken()
              .then((accessToken) => listTasaciones(accessToken, {}))
              .then(setTasaciones);
          }}
        />
      )}
    </div>
  );
}
