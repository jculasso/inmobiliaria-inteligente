import { NOMBRES_MES } from './meses';

/**
 * El período del Dashboard de Alquileres (regla 74, Javier, 7/10/2026: «el mes
 * actual, el acumulado anual y la vista de Q1, Q2, Q3 y Q4 en cada uno de los
 * indicadores»). Un solo selector para toda la pantalla.
 *
 * Vive fuera del componente, que es `'use client'`: la página del servidor lo
 * usa para leer la dirección, y una función de un módulo cliente no se puede
 * llamar desde el servidor (ver `server-imports.test.ts`).
 */
export type PeriodoTablero =
  { por: 'mes'; mes: number } | { por: 'trimestre'; q: number } | { por: 'anio' };

/** Al entrar, el mes en curso; en un año que ya pasó, diciembre. */
export function periodoPorDefecto(hoy: string, anio: number): { por: 'mes'; mes: number } {
  return { por: 'mes', mes: anio === Number(hoy.slice(0, 4)) ? Number(hoy.slice(5, 7)) : 12 };
}

const entre = (x: number, desde: number, hasta: number) =>
  Number.isInteger(x) && x >= desde && x <= hasta;

/**
 * El período de la dirección: `?periodo=mes&mes=10`, `?periodo=trimestre&q=3`
 * o `?periodo=anio`. Lo que no se entiende es el período por defecto: una
 * dirección vieja o tocada a mano no rompe la pantalla.
 */
export function leerPeriodo(
  params: { periodo?: string; mes?: string; q?: string },
  hoy: string,
  anio: number,
  porDefecto: { por: 'mes'; mes: number } = periodoPorDefecto(hoy, anio),
): PeriodoTablero {
  if (params.periodo === 'anio') return { por: 'anio' };
  if (params.periodo === 'trimestre') {
    const q = Number(params.q);
    return { por: 'trimestre', q: entre(q, 1, 4) ? q : Math.ceil(porDefecto.mes / 3) };
  }
  if (params.periodo === 'mes') {
    const mes = Number(params.mes);
    if (entre(mes, 1, 12)) return { por: 'mes', mes };
  }
  return porDefecto;
}

/** Lo que el período escribe en la dirección; el de por defecto, nada. */
export function parametrosDelPeriodo(
  p: PeriodoTablero,
  hoy: string,
  anio: number,
  porDefecto: { por: 'mes'; mes: number } = periodoPorDefecto(hoy, anio),
): [string, string][] {
  if (p.por === 'anio') return [['periodo', 'anio']];
  if (p.por === 'trimestre')
    return [
      ['periodo', 'trimestre'],
      ['q', String(p.q)],
    ];
  return p.mes === porDefecto.mes
    ? []
    : [
        ['periodo', 'mes'],
        ['mes', String(p.mes)],
      ];
}

/** Los meses del período, del 1 al 12. */
export function mesesDelPeriodo(p: PeriodoTablero): number[] {
  if (p.por === 'mes') return [p.mes];
  if (p.por === 'trimestre') return [p.q * 3 - 2, p.q * 3 - 1, p.q * 3];
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

const aPeriodo = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`;

/** El primer y el último mes del período, `AAAA-MM`: lo que pide el detalle de un número. */
export function rangoDelPeriodo(p: PeriodoTablero, anio: number) {
  const meses = mesesDelPeriodo(p);
  return { desde: aPeriodo(anio, meses[0]!), hasta: aPeriodo(anio, meses.at(-1)!) };
}

/** «octubre 2026», «Q3 2026», «2026». */
export function nombreDelPeriodo(p: PeriodoTablero, anio: number): string {
  if (p.por === 'mes') return `${NOMBRES_MES[p.mes - 1]!.toLowerCase()} ${anio}`;
  if (p.por === 'trimestre') return `Q${p.q} ${anio}`;
  return String(anio);
}

// --- El informe al propietario (regla 84) ------------------------------------------

/** El período del informe: el año y, dentro de él, el mes, el trimestre o el año entero. */
export interface PeriodoInforme {
  anio: number;
  periodo: PeriodoTablero;
}

/**
 * El mes del informe por defecto en un año: el anterior al de hoy, que ya
 * cerró (regla 84; el Dashboard, en cambio, abre en el mes en curso). En un
 * año que ya pasó, diciembre; en enero del año en curso, enero mismo.
 */
export function mesInformePorDefecto(hoy: string, anio: number): { por: 'mes'; mes: number } {
  if (anio < Number(hoy.slice(0, 4))) return { por: 'mes', mes: 12 };
  return { por: 'mes', mes: Math.max(1, Number(hoy.slice(5, 7)) - 1) };
}

/** Al entrar al informe: el mes anterior; en enero, diciembre del año anterior. */
export function informePorDefecto(hoy: string): PeriodoInforme {
  const anio = Number(hoy.slice(0, 4));
  return hoy.slice(5, 7) === '01'
    ? { anio: anio - 1, periodo: { por: 'mes', mes: 12 } }
    : { anio, periodo: mesInformePorDefecto(hoy, anio) };
}

/**
 * El período del informe en la dirección: `?anio=2026&periodo=mes&mes=8`, como
 * el Dashboard. Un año que no está entre los que ofrece el selector —este y
 * los dos anteriores— o un período que no se entiende vuelven al de por defecto.
 */
export function leerPeriodoInforme(
  params: { anio?: string; periodo?: string; mes?: string; q?: string },
  hoy: string,
): PeriodoInforme {
  const porDefecto = informePorDefecto(hoy);
  const actual = Number(hoy.slice(0, 4));
  const pedido = Number(params.anio);
  const anio = entre(pedido, actual - 2, actual) ? pedido : porDefecto.anio;
  return { anio, periodo: leerPeriodo(params, hoy, anio, mesInformePorDefecto(hoy, anio)) };
}

/** Lo que el período del informe escribe en la dirección; el de por defecto, nada. */
export function parametrosDelInforme(p: PeriodoInforme, hoy: string): [string, string][] {
  const anio: [string, string][] =
    p.anio === informePorDefecto(hoy).anio ? [] : [['anio', String(p.anio)]];
  return [
    ...anio,
    ...parametrosDelPeriodo(p.periodo, hoy, p.anio, mesInformePorDefecto(hoy, p.anio)),
  ];
}
