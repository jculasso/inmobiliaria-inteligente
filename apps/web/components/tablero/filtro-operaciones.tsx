'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Filtro de período de Ventas/Alquileres, en un único renglón:
//   Año  ·  [ Anual | Trimestral | Mensual ]  ·  (trimestre o mes según la granularidad)
// El backend filtra por anio + mes | trimestre.

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

const selectClass =
  'h-9 rounded-brand border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-brand-red';

export function FiltroOperaciones({ anio, mes, trimestre }: { anio?: number; mes?: number; trimestre?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoy = new Date();
  const anios = [hoy.getFullYear() + 1, hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2];

  const granularidad: Granularidad = mes ? 'mensual' : trimestre ? 'trimestral' : 'anual';

  function push(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function cambiarAnio(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('anio', value);
    else params.delete('anio');
    push(params);
  }

  function cambiarGranularidad(g: Granularidad) {
    const params = new URLSearchParams(searchParams);
    params.delete('mes');
    params.delete('trimestre');
    if (g === 'trimestral') params.set('trimestre', String(trimestre ?? Math.ceil((hoy.getMonth() + 1) / 3)));
    else if (g === 'mensual') params.set('mes', String(mes ?? hoy.getMonth() + 1));
    push(params);
  }

  function cambiarValor(key: 'mes' | 'trimestre', value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    push(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Año" value={anio ?? ''} onChange={(e) => cambiarAnio(e.target.value)} className={selectClass}>
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
            className={`rounded-[12px] px-2.5 py-1 text-sm font-semibold capitalize transition-colors ${
              granularidad === g ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {granularidad === 'trimestral' && (
        <select
          aria-label="Trimestre"
          value={trimestre ?? 1}
          onChange={(e) => cambiarValor('trimestre', e.target.value)}
          className={selectClass}
        >
          <option value="1">T1 · Ene–Mar</option>
          <option value="2">T2 · Abr–Jun</option>
          <option value="3">T3 · Jul–Sep</option>
          <option value="4">T4 · Oct–Dic</option>
        </select>
      )}

      {granularidad === 'mensual' && (
        <select
          aria-label="Mes"
          value={mes ?? 1}
          onChange={(e) => cambiarValor('mes', e.target.value)}
          className={selectClass}
        >
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
