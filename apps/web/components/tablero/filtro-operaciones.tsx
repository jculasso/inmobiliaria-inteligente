'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Filtro de período de Ventas/Alquileres en un renglón:
//   Año · [ Anual | Trimestral | Mensual ] · (Q1–Q4 o mes según granularidad)
// Usa estado OPTIMISTA + useTransition: como el navigate hace un round-trip al
// server (con la latencia de Render), sin esto la selección tardaba en marcarse.
// Así se resalta al instante y un spinner indica que está actualizando.

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

type Granularidad = 'anual' | 'trimestral' | 'mensual';
interface Sel {
  anio?: number;
  mes?: number;
  trimestre?: number;
}

const selectClass =
  'h-9 rounded-brand border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-brand-red';
const segBtn = 'rounded-[12px] px-2.5 py-1 text-sm font-semibold capitalize transition-colors';

export function FiltroOperaciones({ anio, mes, trimestre }: Sel) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Estado optimista: se actualiza al instante al clickear; se re-sincroniza
  // con las props cuando el server termina de renderizar.
  const [sel, setSel] = useState<Sel>({ anio, mes, trimestre });
  useEffect(() => {
    setSel({ anio, mes, trimestre });
  }, [anio, mes, trimestre]);

  const hoy = new Date();
  const anios = [hoy.getFullYear() + 1, hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2];
  const granularidad: Granularidad = sel.mes ? 'mensual' : sel.trimestre ? 'trimestral' : 'anual';

  function aplicar(nuevo: Sel) {
    setSel(nuevo); // resalta al instante
    const params = new URLSearchParams(searchParams);
    const setOrDel = (k: string, v?: number) => (v != null ? params.set(k, String(v)) : params.delete(k));
    setOrDel('anio', nuevo.anio);
    setOrDel('mes', nuevo.mes);
    setOrDel('trimestre', nuevo.trimestre);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function cambiarGranularidad(g: Granularidad) {
    if (g === 'anual') aplicar({ anio: sel.anio });
    else if (g === 'trimestral')
      aplicar({ anio: sel.anio, trimestre: sel.trimestre ?? Math.ceil((hoy.getMonth() + 1) / 3) });
    else aplicar({ anio: sel.anio, mes: sel.mes ?? hoy.getMonth() + 1 });
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <select
        aria-label="Año"
        value={sel.anio ?? ''}
        onChange={(e) => aplicar({ ...sel, anio: e.target.value ? Number(e.target.value) : undefined })}
        className={selectClass}
      >
        <option value="">Todos los años</option>
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <div className="inline-flex rounded-brand border border-line bg-white p-0.5">
        {(['anual', 'trimestral', 'mensual'] as Granularidad[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => cambiarGranularidad(g)}
            className={`${segBtn} ${granularidad === g ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`}
          >
            {g}
          </button>
        ))}
      </div>

      {granularidad === 'trimestral' && (
        <div className="inline-flex rounded-brand border border-line bg-white p-0.5">
          {[1, 2, 3, 4].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => aplicar({ anio: sel.anio, trimestre: t })}
              className={`${segBtn} ${sel.trimestre === t ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`}
            >
              Q{t}
            </button>
          ))}
        </div>
      )}

      {granularidad === 'mensual' && (
        <select
          aria-label="Mes"
          value={sel.mes ?? 1}
          onChange={(e) => aplicar({ anio: sel.anio, mes: Number(e.target.value) })}
          className={selectClass}
        >
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      )}

      {isPending && (
        <span
          aria-label="Actualizando"
          className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-red"
        />
      )}
    </div>
  );
}
