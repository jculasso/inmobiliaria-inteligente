'use client';

import { useEffect, useRef, useState } from 'react';
import type { TodoEventoDto, TodoEventosDto, TodoVista } from '@vacker/types';

/** Callback para abrir el detalle de un evento dentro de la app. */
type OnSelect = (ev: TodoEventoDto) => void;

// Grilla tipo Google Calendar para el To Do List (día/semana con eje horario y
// bloques posicionados; mes con grilla clásica). Todo en hora de Argentina.

const TZ = 'America/Argentina/Buenos_Aires';
const HOUR_H = 48; // px por hora en las vistas día/semana
const SCROLL_TO_HOUR = 7; // al abrir, arranca ~7:00

export function CalendarioTodo({ vista, fecha, data }: { vista: TodoVista; fecha: string; data: TodoEventosDto | null }) {
  const eventos = data?.eventos ?? [];
  // El detalle se muestra dentro de la app (no se abre Google Calendar): el
  // espejo es de solo lectura y, además, el enlace de Google abriría la cuenta
  // que el navegador tenga logueada, no necesariamente la del calendario.
  const [sel, setSel] = useState<TodoEventoDto | null>(null);

  const grilla =
    vista === 'mes' ? (
      <VistaMes fecha={fecha} eventos={eventos} onSelect={setSel} />
    ) : vista === 'semana' ? (
      <GrillaHoraria dias={diasSemana(fecha)} eventos={eventos} onSelect={setSel} />
    ) : (
      <GrillaHoraria dias={[fecha]} eventos={eventos} onSelect={setSel} />
    );

  return (
    <>
      {grilla}
      {sel && <DetalleEvento ev={sel} onClose={() => setSel(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Día / Semana: eje horario a la izquierda + una columna por día con bloques.
// ---------------------------------------------------------------------------

function GrillaHoraria({ dias, eventos, onSelect }: { dias: string[]; eventos: TodoEventoDto[]; onSelect: OnSelect }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_H;
  }, []);

  const hoy = hoyArg();
  const soloDia = dias.length === 1;
  const hayAllDay = dias.some((d) => eventos.some((e) => cubreDia(e, d) && e.todoElDia));

  return (
    <div className="overflow-x-auto rounded-brand border border-line bg-white">
      <div className={soloDia ? '' : 'min-w-[640px]'}>
        {/* Encabezado de días */}
        <div className="flex border-b border-line">
          <div className="w-14 shrink-0" />
          {dias.map((d) => (
            <div key={d} className={`flex-1 py-2 text-center ${d === hoy ? 'bg-brand-red/5' : ''}`}>
              <div className="text-[11px] font-semibold uppercase text-muted">{fmtDiaCorto(d)}</div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  d === hoy ? 'bg-brand-red text-white' : 'text-ink'
                }`}
              >
                {Number(d.slice(8, 10))}
              </div>
            </div>
          ))}
        </div>

        {/* Fila de "todo el día" (solo si hay) */}
        {hayAllDay && (
          <div className="flex border-b border-line bg-surface/40">
            <div className="flex w-14 shrink-0 items-center justify-end pr-2 text-[10px] uppercase text-muted">Todo el día</div>
            {dias.map((d) => (
              <div key={d} className="flex-1 space-y-1 border-l border-line p-1">
                {eventos
                  .filter((e) => e.todoElDia && cubreDia(e, d))
                  .map((e) => (
                    <BloqueChip key={e.id + d} ev={e} onSelect={onSelect} />
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* Grilla horaria scrolleable */}
        <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
          <div className="flex">
            {/* Eje de horas */}
            <div className="w-14 shrink-0">
              {HORAS.map((h) => (
                <div key={h} className="relative border-b border-line" style={{ height: HOUR_H }}>
                  <span className="absolute -top-2 right-2 text-[10px] text-muted">{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
                </div>
              ))}
            </div>
            {/* Columnas de días */}
            {dias.map((d) => (
              <div key={d} className="relative flex-1 border-l border-line">
                {HORAS.map((h) => (
                  <div key={h} className="border-b border-line" style={{ height: HOUR_H }} />
                ))}
                {empaquetar(eventos.filter((e) => !e.todoElDia && diaKeyArg(e.inicio) === d)).map((c) => (
                  <BloqueEvento key={c.ev.id} c={c} onSelect={onSelect} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BloqueEvento({ c, onSelect }: { c: Colocado; onSelect: OnSelect }) {
  const alto = Math.max(((c.finMin - c.inicioMin) / 60) * HOUR_H - 2, 16);
  return (
    <button
      type="button"
      onClick={() => onSelect(c.ev)}
      className="absolute block overflow-hidden rounded-md bg-brand-red px-1.5 py-0.5 text-left text-white shadow-sm transition-opacity hover:opacity-90"
      style={{
        top: (c.inicioMin / 60) * HOUR_H,
        height: alto,
        left: `calc(${(c.lane / c.lanes) * 100}% + 2px)`,
        width: `calc(${100 / c.lanes}% - 4px)`,
      }}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">{c.ev.titulo}</p>
      {alto > 26 && <p className="truncate text-[10px] leading-tight opacity-90">{fmtHora(c.ev.inicio)}</p>}
    </button>
  );
}

function BloqueChip({ ev, onSelect }: { ev: TodoEventoDto; onSelect: OnSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(ev)}
      className="block w-full truncate rounded bg-brand-red/15 px-1.5 py-0.5 text-left text-[11px] font-semibold text-brand-red-dark hover:opacity-80"
    >
      {ev.titulo}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mes: grilla clásica (semanas x 7 días) con chips de eventos por celda.
// ---------------------------------------------------------------------------

function VistaMes({ fecha, eventos, onSelect }: { fecha: string; eventos: TodoEventoDto[]; onSelect: OnSelect }) {
  const primero = `${fecha.slice(0, 7)}-01`;
  const mesNum = fecha.slice(5, 7);
  const inicioGrilla = lunesDeLaSemana(primero);
  const celdas: string[] = [];
  for (let i = 0; i < 42; i++) celdas.push(addDias(inicioGrilla, i));
  // recortar la última semana si queda entera fuera del mes
  while (celdas.length > 35 && celdas[celdas.length - 7]!.slice(5, 7) !== mesNum) celdas.splice(-7);

  const porDia = new Map<string, TodoEventoDto[]>();
  for (const e of eventos) {
    const clave = e.todoElDia ? e.inicio.slice(0, 10) : diaKeyArg(e.inicio);
    (porDia.get(clave) ?? porDia.set(clave, []).get(clave)!).push(e);
  }
  for (const arr of porDia.values()) arr.sort((a, b) => a.inicio.localeCompare(b.inicio));

  const hoy = hoyArg();
  return (
    <div className="overflow-hidden rounded-brand border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d) => {
          const delMes = d.slice(5, 7) === mesNum;
          const evs = porDia.get(d) ?? [];
          return (
            <div key={d} className={`min-h-[92px] border-b border-r border-line p-1 ${delMes ? '' : 'bg-surface/40'}`}>
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  d === hoy ? 'bg-brand-red text-white' : delMes ? 'text-ink' : 'text-muted'
                }`}
              >
                {Number(d.slice(8, 10))}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e) => (
                  <ChipMes key={e.id} ev={e} onSelect={onSelect} />
                ))}
                {evs.length > 3 && <div className="px-1 text-[10px] font-semibold text-muted">+{evs.length - 3} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChipMes({ ev, onSelect }: { ev: TodoEventoDto; onSelect: OnSelect }) {
  const texto = ev.todoElDia ? ev.titulo : `${fmtHora(ev.inicio)} ${ev.titulo}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(ev)}
      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight hover:bg-surface"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" aria-hidden />
      <span className="truncate text-ink">{texto}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detalle del evento (dentro de la app, sin abrir Google Calendar).
// ---------------------------------------------------------------------------

function DetalleEvento({ ev, onClose }: { ev: TodoEventoDto; onClose: () => void }) {
  // Cerrar con Escape (además del click en el fondo y el botón ✕).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-brand bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold leading-snug text-ink">{ev.titulo}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <span aria-hidden>🕑</span>
          {rangoFecha(ev)}
        </p>

        {ev.ubicacion && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
            <span aria-hidden>📍</span>
            <span>{ev.ubicacion}</span>
          </p>
        )}

        {ev.descripcion && (
          <p className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-sm text-ink">{ev.descripcion}</p>
        )}
      </div>
    </div>
  );
}

/** Rango legible de fecha/hora de un evento (hora Argentina). */
function rangoFecha(ev: TodoEventoDto): string {
  if (ev.todoElDia) {
    return `${fmtFechaLarga(ev.inicio.slice(0, 10))} · todo el día`;
  }
  const dia = capFirst(fmtFechaLarga(diaKeyArg(ev.inicio)));
  const desde = fmtHora(ev.inicio);
  const finMin = minutosDelDia(ev.fin);
  const iniMin = minutosDelDia(ev.inicio);
  const hasta = finMin > iniMin && diaKeyArg(ev.fin) === diaKeyArg(ev.inicio) ? ` – ${fmtHora(ev.fin)}` : '';
  return `${dia} · ${desde}${hasta}`;
}

function fmtFechaLarga(dia: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${dia}T12:00:00-03:00`),
  );
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Empaquetado de eventos solapados en columnas (lane packing).
// ---------------------------------------------------------------------------

interface Colocado {
  ev: TodoEventoDto;
  inicioMin: number;
  finMin: number;
  lane: number;
  lanes: number;
}

function empaquetar(eventos: TodoEventoDto[]): Colocado[] {
  const items: Colocado[] = eventos
    .map((ev) => {
      const inicioMin = minutosDelDia(ev.inicio);
      let finMin = minutosDelDia(ev.fin);
      if (finMin <= inicioMin) finMin = inicioMin + 30; // sin fin o cruza medianoche → mínimo 30'
      return { ev, inicioMin, finMin, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.inicioMin - b.inicioMin || a.finMin - b.finMin);

  const resultado: Colocado[] = [];
  let cluster: Colocado[] = [];
  let clusterFin = -1;

  const cerrar = () => {
    const laneFin: number[] = [];
    for (const it of cluster) {
      let ubicado = false;
      for (let i = 0; i < laneFin.length; i++) {
        if (it.inicioMin >= laneFin[i]!) {
          it.lane = i;
          laneFin[i] = it.finMin;
          ubicado = true;
          break;
        }
      }
      if (!ubicado) {
        it.lane = laneFin.length;
        laneFin.push(it.finMin);
      }
    }
    for (const it of cluster) it.lanes = laneFin.length;
    resultado.push(...cluster);
    cluster = [];
    clusterFin = -1;
  };

  for (const it of items) {
    if (cluster.length && it.inicioMin >= clusterFin) cerrar();
    cluster.push(it);
    clusterFin = Math.max(clusterFin, it.finMin);
  }
  if (cluster.length) cerrar();
  return resultado;
}

// ---------------------------------------------------------------------------
// Helpers de fecha/hora (Argentina, offset fijo -03:00).
// ---------------------------------------------------------------------------

const HORAS = Array.from({ length: 24 }, (_, i) => i);
const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

function hoyArg(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Minutos desde medianoche (hora Argentina) de un ISO. */
function minutosDelDia(iso: string): number {
  const arg = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return arg.getUTCHours() * 60 + arg.getUTCMinutes();
}

/** Día YYYY-MM-DD (hora Argentina) al que pertenece un ISO. */
function diaKeyArg(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDias(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function lunesDeLaSemana(s: string): string {
  const dow = new Date(`${s}T12:00:00-03:00`).getUTCDay();
  return addDias(s, -((dow + 6) % 7));
}

function diasSemana(fecha: string): string[] {
  const lunes = lunesDeLaSemana(fecha);
  return Array.from({ length: 7 }, (_, i) => addDias(lunes, i));
}

/** Un evento (all-day o no) "cubre" un día dado. Para all-day el fin es exclusivo. */
function cubreDia(ev: TodoEventoDto, dia: string): boolean {
  if (ev.todoElDia) {
    const desde = ev.inicio.slice(0, 10);
    const hasta = ev.fin.slice(0, 10); // exclusivo
    return dia >= desde && dia < hasta;
  }
  return diaKeyArg(ev.inicio) === dia;
}

function fmtDiaCorto(dia: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short' }).format(new Date(`${dia}T12:00:00-03:00`));
}

function fmtHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
