'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Filtro de período de Ventas/Alquileres: Año + Período (todo el año / trimestre
// / mes) en un único renglón. El backend filtra por anio + mes|trimestre.

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

const TRIMESTRES = [
  { v: 't1', label: 'T1 · Ene–Mar' },
  { v: 't2', label: 'T2 · Abr–Jun' },
  { v: 't3', label: 'T3 · Jul–Sep' },
  { v: 't4', label: 'T4 · Oct–Dic' },
];

const selectClass =
  'h-9 rounded-brand border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-brand-red';

export function FiltroOperaciones({ anio, mes, trimestre }: { anio?: number; mes?: number; trimestre?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoy = new Date().getFullYear();
  const anios = [hoy + 1, hoy, hoy - 1, hoy - 2];

  // El valor del select de período: un mes (1..12), un trimestre ("t1".."t4") o "" (todo el año).
  const periodoValue = mes ? String(mes) : trimestre ? `t${trimestre}` : '';

  function push(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function cambiarAnio(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('anio', value);
    else params.delete('anio');
    push(params);
  }

  function cambiarPeriodo(value: string) {
    const params = new URLSearchParams(searchParams);
    params.delete('mes');
    params.delete('trimestre');
    if (value.startsWith('t')) params.set('trimestre', value.slice(1));
    else if (value) params.set('mes', value);
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
      <select
        aria-label="Período"
        value={periodoValue}
        onChange={(e) => cambiarPeriodo(e.target.value)}
        className={selectClass}
      >
        <option value="">Todo el año</option>
        {TRIMESTRES.map((t) => (
          <option key={t.v} value={t.v}>
            {t.label}
          </option>
        ))}
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
