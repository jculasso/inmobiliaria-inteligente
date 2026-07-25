'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DESCRIPCION_SEMANA,
  ESTADO_ACCION_LABEL,
  SEMANAS,
  TOTAL_SEMANAS,
  type EstadoAccion,
  type ProtocoloAccionDto,
  type ProtocoloDto,
} from '@vacker/types';
import { fmtUSD } from '../../lib/format';
import { getAccessToken } from '../../lib/supabase/client';
import { generarInformeProtocolo, updateAccion, updateProtocolo } from '../../lib/protocolo-api';
import { AlertaItem, BarraAvance, FotoPropiedad, Pill, porcentaje } from './protocolo-ui';

const ESTADOS: EstadoAccion[] = ['pendiente', 'en_proceso', 'realizada', 'no_corresponde'];

const CLASE_ESTADO: Record<EstadoAccion, string> = {
  pendiente: 'border-line bg-white',
  en_proceso: 'border-warning/40 bg-warning/5',
  realizada: 'border-success/40 bg-success/5',
  no_corresponde: 'border-line bg-surface text-muted',
};

const METRICAS = [
  { key: 'consultas', label: 'Consultas' },
  { key: 'consultasCalificadas', label: 'Calificadas' },
  { key: 'visitas', label: 'Visitas' },
  { key: 'interesadosActivos', label: 'Interesados' },
  { key: 'ofertas', label: 'Ofertas' },
] as const;

const ANALISIS = [
  { key: 'devolucionesMercado', label: 'Devoluciones del mercado', ph: 'Comentarios más frecuentes de compradores y colegas' },
  { key: 'objeciones', label: 'Principales objeciones', ph: 'Precio, estado, ubicación, condiciones…' },
  { key: 'recomendacion', label: 'Recomendación de la inmobiliaria', ph: 'Mantener, reforzar, ajustar precio…' },
  { key: 'decisionPropietario', label: 'Decisión acordada con el propietario', ph: 'Acuerdo y fecha de la decisión' },
  { key: 'proximasAcciones', label: 'Próximas acciones', ph: 'Acciones concretas para la etapa siguiente' },
] as const;

/**
 * Ficha completa del protocolo: cabecera, métricas comerciales, checklist por
 * semana y análisis de cierre. Todo se guarda contra la API y el DTO devuelto
 * reemplaza el estado local, así los cálculos derivados (avance, semana,
 * alertas) llegan siempre del servidor y no se recalculan acá.
 */
export function DetalleProtocolo({ inicial }: { inicial: ProtocoloDto }) {
  const [p, setP] = useState(inicial);
  const [semana, setSemana] = useState(inicial.semanaActual);
  const [guardando, setGuardando] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Genera el PDF y lo abre en otra pestaña (la URL firmada es de vida corta). */
  async function generarInforme() {
    setGenerandoInforme(true);
    setError(null);
    try {
      const { url } = await generarInformeProtocolo(await getAccessToken(), p.id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el informe.');
    } finally {
      setGenerandoInforme(false);
    }
  }

  /**
   * Guarda con UI optimista: `local` se aplica al instante y recién después se
   * llama a la API. Con Render y Supabase en regiones distintas, esperar la
   * respuesta para pintar el cambio hacía sentir la pantalla trabada.
   *
   * La respuesta del server reemplaza el estado (trae los derivados: avance,
   * semana, alertas) pero se conserva la foto ya firmada, porque las mutaciones
   * devuelven la key cruda para ahorrarse el round trip a Storage.
   */
  async function guardar(local: (prev: ProtocoloDto) => ProtocoloDto, fn: (token: string) => Promise<ProtocoloDto>) {
    const previo = p;
    setP(local);
    setGuardando(true);
    setError(null);
    try {
      const fresco = await fn(await getAccessToken());
      setP({ ...fresco, propiedad: { ...fresco.propiedad, fotoUrl: previo.propiedad.fotoUrl } });
    } catch (err) {
      setP(previo); // revierte: el cambio no llegó a la base
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  const cambiarAccion = (accionId: string, campos: Parameters<typeof updateAccion>[3]) =>
    guardar(
      (prev) => ({
        ...prev,
        acciones: prev.acciones.map((a) => (a.id === accionId ? { ...a, ...campos } : a)),
      }),
      (t) => updateAccion(t, p.id, accionId, campos),
    );

  const cambiarFicha = (campos: Parameters<typeof updateProtocolo>[2]) =>
    guardar(
      (prev) => ({ ...prev, ...campos, embudo: { ...prev.embudo, ...campos } }),
      (t) => updateProtocolo(t, p.id, campos),
    );

  const deLaSemana = p.acciones.filter((a) => a.semana === semana);
  const archivada = p.estado === 'archivada';

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 rounded-brand border border-line bg-white p-4 sm:flex-row sm:items-center">
        <FotoPropiedad
          url={p.propiedad.fotoUrl}
          alt={p.propiedad.direccion}
          className="h-32 w-full shrink-0 rounded-brand sm:h-24 sm:w-32"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight text-ink sm:text-xl">{p.propiedad.direccion}</h2>
          <p className="text-sm text-muted">
            {p.propiedad.tipoPropiedad} ·{' '}
            {p.precioPublicado != null ? fmtUSD(p.precioPublicado) : 'Precio no informado'} · Propietario:{' '}
            {p.propietarioNombre ?? 'No informado'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tono={archivada ? 'neutro' : 'rojo'}>
              {archivada ? 'Archivada' : `Semana ${p.semanaActual} de ${TOTAL_SEMANAS}`}
            </Pill>
            <Pill>{p.diasPublicada} días en comercialización</Pill>
            <Pill tono={p.avance === 1 ? 'verde' : 'neutro'}>{porcentaje(p.avance)} completado</Pill>
            <Pill>{p.agente.nombre}</Pill>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/protocolo"
            className="flex-1 rounded-brand border border-line px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-surface sm:flex-none"
          >
            ← Volver
          </Link>
          <button
            type="button"
            onClick={() => void generarInforme()}
            disabled={generandoInforme}
            className="flex-1 rounded-brand bg-brand-red px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60 sm:flex-none"
          >
            {generandoInforme ? 'Generando…' : '📄 Informe'}
          </button>
        </div>
      </div>

      {p.alertas.length > 0 && (
        <div className="flex flex-col gap-2">
          {p.alertas.map((a, i) => (
            <AlertaItem key={i} alerta={a} />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-brand bg-brand-red/10 px-3 py-2 text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      {/* Aviso flotante: los cambios se ven al instante, así que sin esto no
          habría señal de que todavía se están guardando. */}
      {guardando && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/90 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Guardando…
        </div>
      )}

      {/* Resultados comerciales */}
      <section className="rounded-brand border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-ink">Resultados comerciales</h3>
            <p className="text-xs text-muted">
              Se guardan al salir del campo y alimentan el informe del propietario.
            </p>
          </div>
          <span className="rounded-full bg-brand-red/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-red-dark">
            Alimenta el informe
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {METRICAS.map((m) => (
            <label key={m.key} className="rounded-brand border border-line px-3 py-2">
              <span className="block text-[10px] font-extrabold uppercase tracking-wide text-muted">
                {m.label}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                defaultValue={p.embudo[m.key]}
                disabled={archivada}
                onBlur={(e) => {
                  const valor = Math.max(0, Number(e.target.value) || 0);
                  if (valor !== p.embudo[m.key]) void cambiarFicha({ [m.key]: valor });
                }}
                className="w-full border-0 bg-transparent p-0 text-xl font-extrabold text-ink outline-none disabled:text-muted sm:text-2xl"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Conversión a visita: <strong className="text-ink">{porcentaje(p.embudo.conversionVisita)}</strong> ·
          Conversión visita → oferta:{' '}
          <strong className="text-ink">{porcentaje(p.embudo.conversionOferta)}</strong>
        </p>
      </section>

      {/* Semanas */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SEMANAS.map((n) => {
          const acciones = p.acciones.filter((a) => a.semana === n && a.estado !== 'no_corresponde');
          const hechas = acciones.filter((a) => a.estado === 'realizada').length;
          const completa = acciones.length > 0 && hechas === acciones.length;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setSemana(n)}
              className={`shrink-0 rounded-brand border px-3.5 py-2 text-sm font-bold transition-colors ${
                semana === n
                  ? 'border-ink bg-ink text-white'
                  : completa
                    ? 'border-success/40 text-success hover:bg-surface'
                    : 'border-line text-muted hover:bg-surface'
              }`}
            >
              Semana {n} · {acciones.length === 0 ? '—' : `${Math.round((hechas / acciones.length) * 100)}%`}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-brand border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-bold text-ink">Semana {semana}</h3>
          <p className="text-xs text-muted">{DESCRIPCION_SEMANA[semana]}</p>
        </div>

        <div className="divide-y divide-line">
          {deLaSemana.map((a) => (
            <AccionFila
              key={a.id}
              accion={a}
              deshabilitada={archivada}
              onCambio={(campos) => void cambiarAccion(a.id, campos)}
            />
          ))}
        </div>

        {semana === TOTAL_SEMANAS && (
          <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
            {ANALISIS.map((campo) => (
              <label key={campo.key} className={campo.key === 'proximasAcciones' ? 'sm:col-span-2' : ''}>
                <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted">
                  {campo.label}
                </span>
                <textarea
                  defaultValue={p[campo.key] ?? ''}
                  placeholder={campo.ph}
                  disabled={archivada}
                  onBlur={(e) => {
                    const valor = e.target.value.trim() || null;
                    if (valor !== p[campo.key]) void cambiarFicha({ [campo.key]: valor });
                  }}
                  className="min-h-[76px] w-full rounded-brand border border-line px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface"
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 text-xs text-muted">
        <BarraAvance valor={p.avance} />
        <span className="shrink-0 font-bold text-ink">{porcentaje(p.avance)}</span>
      </div>
    </div>
  );
}

/** Una acción del checklist: estado, fechas y (desplegable) notas. */
function AccionFila({
  accion,
  deshabilitada,
  onCambio,
}: {
  accion: ProtocoloAccionDto;
  deshabilitada: boolean;
  onCambio: (campos: Parameters<typeof updateAccion>[3]) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const atrasada =
    accion.estado !== 'realizada' &&
    accion.estado !== 'no_corresponde' &&
    accion.fechaPrevista != null &&
    accion.fechaPrevista < new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <p className="flex-1 text-sm font-bold text-ink">
          {accion.titulo}
          {atrasada && (
            <span className="ml-2 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-red">
              Atrasada
            </span>
          )}
        </p>

        <label className="flex-1 sm:w-40 sm:flex-none">
          <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted">
            Estado
          </span>
          <select
            value={accion.estado}
            disabled={deshabilitada}
            onChange={(e) => onCambio({ estado: e.target.value as EstadoAccion })}
            className={`h-9 w-full rounded-brand border px-2 text-sm text-ink outline-none focus:border-brand-red ${CLASE_ESTADO[accion.estado]}`}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_ACCION_LABEL[e]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1 sm:w-36 sm:flex-none">
          <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted">
            Realizada
          </span>
          <input
            type="date"
            defaultValue={accion.fechaRealizada ?? ''}
            disabled={deshabilitada}
            onChange={(e) => onCambio({ fechaRealizada: e.target.value || null })}
            className="h-9 w-full rounded-brand border border-line px-2 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface"
          />
        </label>

        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          className="shrink-0 px-2 py-2 text-sm font-bold text-brand-red hover:underline"
        >
          {abierta ? 'Ocultar' : 'Detalles'}
        </button>
      </div>

      {abierta && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {(
            [
              { key: 'observaciones', label: 'Observaciones', ph: 'Qué se hizo, incidencias o contexto' },
              { key: 'resultado', label: 'Resultado', ph: 'Consultas, respuestas o resultado obtenido' },
              { key: 'evidencia', label: 'Enlace / evidencia', ph: 'URL de la publicación, carpeta, video…' },
            ] as const
          ).map((campo) => (
            <label key={campo.key}>
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted">
                {campo.label}
              </span>
              <textarea
                defaultValue={accion[campo.key] ?? ''}
                placeholder={campo.ph}
                disabled={deshabilitada}
                onBlur={(e) => {
                  const valor = e.target.value.trim() || null;
                  if (valor !== accion[campo.key]) onCambio({ [campo.key]: valor });
                }}
                className="min-h-[64px] w-full rounded-brand border border-line px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
