'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@vacker/ui';
import type { TodoEventoDto, TodoEventosDto, TodoVista } from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { desconectarTodo, getTodoConnectUrl, getTodoEstado, getTodoEventos } from '../../lib/todo-api';

const TZ = 'America/Argentina/Buenos_Aires';
const VISTAS: { key: TodoVista; label: string }[] = [
  { key: 'dia', label: 'Día' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
];

type Estado = 'cargando' | 'desconectado' | 'conectado';

export function TodoView() {
  const params = useSearchParams();
  const googleParam = params.get('google');
  const [estado, setEstado] = useState<Estado>('cargando');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [vista, setVista] = useState<TodoVista>('semana');
  const [fecha, setFecha] = useState<string>(() => hoyArg());
  const [data, setData] = useState<TodoEventosDto | null>(null);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [error, setError] = useState<string | null>(googleParam === 'error' ? 'No se pudo conectar tu Google. Reintentá.' : null);
  const [ocupado, setOcupado] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const e = await getTodoEstado(token);
      setEstado(e.conectado ? 'conectado' : 'desconectado');
      setGoogleEmail(e.googleEmail);
    } catch (err) {
      setEstado('desconectado');
      setError(mensaje(err));
    }
  }, []);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado]);

  const cargarEventos = useCallback(async () => {
    setCargandoEventos(true);
    setError(null);
    try {
      const token = await getAccessToken();
      setData(await getTodoEventos(token, vista, fecha));
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setCargandoEventos(false);
    }
  }, [vista, fecha]);

  useEffect(() => {
    if (estado === 'conectado') void cargarEventos();
  }, [estado, cargarEventos]);

  async function conectar() {
    setOcupado(true);
    try {
      const token = await getAccessToken();
      const { url } = await getTodoConnectUrl(token);
      window.location.href = url;
    } catch (err) {
      setError(mensaje(err));
      setOcupado(false);
    }
  }

  async function desconectar() {
    setOcupado(true);
    try {
      const token = await getAccessToken();
      await desconectarTodo(token);
      setData(null);
      await cargarEstado();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setOcupado(false);
    }
  }

  if (estado === 'cargando') {
    return <p className="text-sm text-muted">Cargando…</p>;
  }

  if (estado === 'desconectado') {
    return (
      <div className="rounded-brand border border-line bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10 text-2xl">🗓️</div>
        <h2 className="mt-4 text-lg font-bold text-ink">Conectá tu Google Calendar</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Vas a ver acá tus eventos del calendario (solo lectura), en vistas por día, semana y mes. No modificamos nada de tu agenda.
        </p>
        {error && <p className="mt-3 text-sm font-medium text-brand-red">{error}</p>}
        <div className="mt-5">
          <Button variant="primary" onClick={conectar} disabled={ocupado}>
            {ocupado ? 'Redirigiendo…' : 'Conectar Google'}
          </Button>
        </div>
      </div>
    );
  }

  // Conectado
  return (
    <div className="flex flex-col gap-4">
      {googleParam === 'conectado' && (
        <p className="rounded-brand bg-success/10 px-3 py-2 text-sm font-medium text-success">
          ✓ Tu Google Calendar quedó conectado.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-brand border border-line bg-white p-1">
          {VISTAS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVista(v.key)}
              className={`rounded-[12px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                vista === v.key ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setFecha((f) => desplazar(f, vista, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-brand border border-line text-ink hover:bg-surface"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setFecha(hoyArg())}
            className="rounded-brand border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface"
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => setFecha((f) => desplazar(f, vista, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-brand border border-line text-ink hover:bg-surface"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">{capFirst(labelRango(vista, fecha))}</h2>
        {googleEmail && (
          <span className="text-xs text-muted">
            {googleEmail} ·{' '}
            <button type="button" onClick={desconectar} disabled={ocupado} className="font-semibold text-brand-red hover:underline">
              desconectar
            </button>
          </span>
        )}
      </div>

      {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

      {cargandoEventos ? (
        <p className="text-sm text-muted">Cargando eventos…</p>
      ) : (
        <Agenda data={data} />
      )}
    </div>
  );
}

function Agenda({ data }: { data: TodoEventosDto | null }) {
  if (!data || data.eventos.length === 0) {
    return (
      <div className="rounded-brand border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
        No hay eventos en este período.
      </div>
    );
  }

  const grupos = agruparPorDia(data.eventos);
  return (
    <div className="flex flex-col gap-5">
      {grupos.map(({ dia, eventos }) => (
        <div key={dia}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted capitalize">{fmtDiaLargo(dia)}</p>
          <div className="flex flex-col gap-2">
            {eventos.map((ev) => (
              <EventoFila key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventoFila({ ev }: { ev: TodoEventoDto }) {
  const inicio = fmtHora(ev.inicio);
  const fin = fmtHora(ev.fin);
  const contenido = (
    <div className="flex items-stretch overflow-hidden rounded-brand border border-line bg-white shadow-sm">
      <div className="w-1 shrink-0 bg-brand-red" aria-hidden />
      <div className="flex flex-1 items-center gap-3 py-2.5 pl-3 pr-3">
        <div className="w-12 shrink-0 text-right">
          {ev.todoElDia ? (
            <span className="text-[11px] font-semibold leading-tight text-muted">Todo el día</span>
          ) : (
            <>
              <div className="text-sm font-bold tabular-nums text-ink">{inicio}</div>
              {fin && fin !== inicio && <div className="text-xs tabular-nums text-muted">{fin}</div>}
            </>
          )}
        </div>
        <div className="h-9 w-px shrink-0 bg-line" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{ev.titulo}</p>
          {ev.ubicacion && <p className="truncate text-xs text-muted">📍 {ev.ubicacion}</p>}
        </div>
      </div>
    </div>
  );
  return ev.htmlLink ? (
    <a href={ev.htmlLink} target="_blank" rel="noreferrer" className="block transition-opacity hover:opacity-80">
      {contenido}
    </a>
  ) : (
    contenido
  );
}

// --- helpers de fecha (Argentina, offset fijo -03:00) ---

function hoyArg(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function desplazar(fecha: string, vista: TodoVista, dir: number): string {
  if (vista === 'mes') {
    const y = Number(fecha.slice(0, 4));
    const m = Number(fecha.slice(5, 7));
    const total = y * 12 + (m - 1) + dir;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, '0')}-01`;
  }
  const paso = vista === 'semana' ? 7 : 1;
  return addDias(fecha, dir * paso);
}

function addDias(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function labelRango(vista: TodoVista, fecha: string): string {
  if (vista === 'dia') return fmtFecha(fecha, { weekday: 'long', day: 'numeric', month: 'long' });
  if (vista === 'mes') return fmtFecha(`${fecha.slice(0, 7)}-01`, { month: 'long', year: 'numeric' });
  const dow = new Date(`${fecha}T12:00:00-03:00`).getUTCDay();
  const lunes = addDias(fecha, -((dow + 6) % 7));
  const domingo = addDias(lunes, 6);
  return `${fmtFecha(lunes, { day: 'numeric', month: 'short' })} – ${fmtFecha(domingo, { day: 'numeric', month: 'short' })}`;
}

function agruparPorDia(eventos: TodoEventoDto[]): { dia: string; eventos: TodoEventoDto[] }[] {
  const mapa = new Map<string, TodoEventoDto[]>();
  for (const ev of eventos) {
    const dia = ev.todoElDia ? ev.inicio.slice(0, 10) : diaKeyDe(ev.inicio);
    const arr = mapa.get(dia) ?? [];
    arr.push(ev);
    mapa.set(dia, arr);
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, eventos]) => ({ dia, eventos }));
}

function diaKeyDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

function fmtHora(iso: string): string {
  // 24h (Argentina): "12:00" / "13:30" — más prolijo y sin el "p. m." que corta el layout.
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtFecha(dia: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...opts }).format(new Date(`${dia}T12:00:00-03:00`));
}

function fmtDiaLargo(dia: string): string {
  return fmtFecha(dia, { weekday: 'long', day: 'numeric', month: 'long' });
}

function mensaje(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error.';
}
