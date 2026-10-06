'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@vacker/ui';
import type { TodoEventosDto, TodoVista } from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { hoyIso } from '../../lib/format';
import {
  desconectarTodo,
  getTodoConnectUrl,
  getTodoEstado,
  getTodoEventos,
} from '../../lib/todo-api';
import { CLASE_FOCO, MensajeError, Segmentado } from '../piezas';
import { CalendarioTodo } from './todo-calendar';

const TZ = 'America/Argentina/Buenos_Aires';
const VISTAS: readonly (readonly [TodoVista, string])[] = [
  ['dia', 'Día'],
  ['semana', 'Semana'],
  ['mes', 'Mes'],
];

/** Lo que se le dice a la persona cuando Google no terminó de conectar (`?google=error`). */
export const MENSAJE_GOOGLE_ERROR =
  'No se pudo conectar tu Google Calendar. Probá de nuevo; si vuelve a fallar, avisale a la administración de tu inmobiliaria.';

type Estado = 'cargando' | 'desconectado' | 'conectado';

export function TodoView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // El resultado de la vuelta de Google se lee UNA vez y se saca de la
  // dirección: si quedaba, recargar volvía a mostrar «quedó conectado» (o el
  // error) días después.
  const [avisoGoogle] = useState<'conectado' | 'error' | null>(() => {
    const g = params.get('google');
    return g === 'conectado' || g === 'error' ? g : null;
  });
  const [estado, setEstado] = useState<Estado>('cargando');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [vista, setVista] = useState<TodoVista>('semana');
  const [fecha, setFecha] = useState<string>(() => hoyIso());
  const [data, setData] = useState<TodoEventosDto | null>(null);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** Para qué vista y fecha son los eventos que hay en pantalla. */
  const cargadoPara = useRef<string | null>(null);
  const vistaFecha = useRef({ vista, fecha });
  vistaFecha.current = { vista, fecha };

  useEffect(() => {
    if (params.get('google')) router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * El estado de la conexión y los eventos, EN PARALELO: antes se pedía el
   * estado, se esperaba, y recién después los eventos — dos idas y vueltas a
   * Render en cada entrada. Si no está conectado, los eventos fallan y se
   * descartan.
   */
  const cargarEstado = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const { vista: v, fecha: f } = vistaFecha.current;
      const [e, eventos] = await Promise.all([
        getTodoEstado(token),
        getTodoEventos(token, v, f).catch(() => null),
      ]);
      setGoogleEmail(e.googleEmail);
      if (e.conectado && eventos) {
        setData(eventos);
        cargadoPara.current = `${v}|${f}`;
      }
      setEstado(e.conectado ? 'conectado' : 'desconectado');
    } catch (err) {
      setEstado('desconectado');
      setError(mensaje(err));
    }
  }, []);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado]);

  /*
   * Instalada como app (PWA), «Conectar Google» abre Google y la app queda en
   * segundo plano con «Redirigiendo…» clavado: al volver no hay recarga. Al
   * volver a verse (o al salir del caché de «atrás») se libera el botón y se
   * vuelve a mirar si la conexión quedó hecha.
   */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      setOcupado(false);
      void cargarEstado();
    };
    const alMostrar = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setOcupado(false);
      void cargarEstado();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('pageshow', alMostrar);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('pageshow', alMostrar);
    };
  }, [cargarEstado]);

  const cargarEventos = useCallback(async () => {
    setCargandoEventos(true);
    setError(null);
    try {
      const token = await getAccessToken();
      setData(await getTodoEventos(token, vista, fecha));
      cargadoPara.current = `${vista}|${fecha}`;
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setCargandoEventos(false);
    }
  }, [vista, fecha]);

  useEffect(() => {
    // Los de esta vista ya llegaron junto con el estado: no se piden otra vez.
    if (estado === 'conectado' && cargadoPara.current !== `${vista}|${fecha}`) {
      void cargarEventos();
    }
  }, [estado, vista, fecha, cargarEventos]);

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
      cargadoPara.current = null;
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10 text-2xl">
          🗓️
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">Conectá tu Google Calendar</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Vas a ver acá tus eventos del calendario (solo lectura), en vistas por día, semana y mes.
          No modificamos nada de tu agenda.
        </p>
        {avisoGoogle === 'error' && (
          <MensajeError className="mx-auto mt-3 max-w-md">{MENSAJE_GOOGLE_ERROR}</MensajeError>
        )}
        <MensajeError className="mt-3">{error}</MensajeError>
        <div className="mt-5">
          <Button variant="primary" onClick={conectar} disabled={ocupado}>
            {ocupado ? 'Redirigiendo…' : avisoGoogle === 'error' ? 'Reintentar' : 'Conectar Google'}
          </Button>
        </div>
      </div>
    );
  }

  // Conectado
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {avisoGoogle === 'conectado' && (
        <p className="rounded-brand bg-success/10 px-3 py-2 text-sm font-medium text-success">
          ✓ Tu Google Calendar quedó conectado.
        </p>
      )}
      {avisoGoogle === 'error' && <MensajeError>{MENSAJE_GOOGLE_ERROR}</MensajeError>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentado etiqueta="Qué vista" opciones={VISTAS} valor={vista} onCambio={setVista} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setFecha((f) => desplazar(f, vista, -1))}
            className={`flex h-10 w-10 items-center justify-center rounded-brand border border-line text-ink hover:bg-surface ${CLASE_FOCO}`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setFecha(hoyIso())}
            className={`h-10 rounded-brand border border-line px-3 text-sm font-semibold text-ink hover:bg-surface ${CLASE_FOCO}`}
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => setFecha((f) => desplazar(f, vista, 1))}
            className={`flex h-10 w-10 items-center justify-center rounded-brand border border-line text-ink hover:bg-surface ${CLASE_FOCO}`}
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">{capFirst(labelRango(vista, fecha))}</h2>
        {googleEmail && (
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="truncate">{googleEmail}</span>
            <Button variant="secondary" size="sm" onClick={desconectar} disabled={ocupado}>
              Desconectar
            </Button>
          </span>
        )}
      </div>

      <MensajeError>{error}</MensajeError>
      {data?.truncado && (
        // Google devuelve los eventos de a páginas; si ni así entraron todos, se avisa en vez de callar.
        <p className="text-xs text-muted">
          Este período tiene muchísimos eventos: se muestran los primeros. Mirá una semana o un día
          para ver todo.
        </p>
      )}

      {cargandoEventos ? (
        <p className="text-sm text-muted">Cargando eventos…</p>
      ) : (
        <CalendarioTodo
          vista={vista}
          fecha={fecha}
          data={data}
          onIrADia={(d) => {
            setFecha(d);
            setVista('dia');
          }}
        />
      )}
    </div>
  );
}

// --- helpers de fecha (Argentina, offset fijo -03:00) ---

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
  if (vista === 'mes')
    return fmtFecha(`${fecha.slice(0, 7)}-01`, { month: 'long', year: 'numeric' });
  const dow = new Date(`${fecha}T12:00:00-03:00`).getUTCDay();
  const lunes = addDias(fecha, -((dow + 6) % 7));
  const domingo = addDias(lunes, 6);
  return `${fmtFecha(lunes, { day: 'numeric', month: 'short' })} – ${fmtFecha(domingo, { day: 'numeric', month: 'short' })}`;
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtFecha(dia: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...opts }).format(
    new Date(`${dia}T12:00:00-03:00`),
  );
}

function mensaje(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error.';
}
