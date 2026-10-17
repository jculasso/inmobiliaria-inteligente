import type { CicloDelMes, HitoDelCiclo, TenantConfig } from '@vacker/types';
import {
  diasDelMes,
  esFinDeSemana,
  sumarDiasIso,
  sumarMesesIso,
  vencimientoDelMes,
  vencimientosDelPeriodo,
} from '@vacker/domain';

type DiasDelCiclo = Pick<
  TenantConfig,
  'contratoDiaVencimiento' | 'contratoDiaPagoPropietario' | 'diaAvisoGenerar'
>;

/** El día pedido de un mes, `AAAA-MM-DD`; en un mes más corto, su último día. */
function diaDelMes(mes: string, dia: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return `${mes}-${String(Math.min(dia, diasDelMes(a, m))).padStart(2, '0')}`;
}

const numero = (iso: string) => String(Number(iso.slice(8, 10)));

/** «el 10 y el 11», «el 7, el 8 y el 9». */
function enumerar(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

/**
 * Regla 178: por qué una fecha del mes cayó después del día pedido —«el 10
 * fue sábado y el 12 feriado»—, o `null` si no se corrió.
 *
 * Los días que se saltearon se agrupan: un fin de semana se nombra por su
 * primer día (el domingo después del sábado se sobreentiende) y los feriados
 * seguidos van juntos («el 7 y el 8 fueron feriados»). En pasado si el día
 * pedido ya pasó; si no, en presente («el 25 es domingo»).
 */
export function motivoDelCorrimiento(
  pedido: string,
  fecha: string,
  feriados: ReadonlySet<string>,
  hoy: string,
): string | null {
  if (fecha <= pedido) return null;
  const grupos: { finde: boolean; dias: string[] }[] = [];
  for (let d = pedido; d < fecha; d = sumarDiasIso(d, 1)) {
    // Un feriado en sábado es fin de semana: se nombra como tal.
    const finde = esFinDeSemana(d);
    if (!finde && !feriados.has(d)) continue;
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.finde === finde) ultimo.dias.push(d);
    else grupos.push({ finde, dias: [d] });
  }
  const pasado = pedido < hoy;
  const partes = grupos.map((g, i) => {
    const verbo = (plural: boolean) =>
      i > 0 ? '' : `${plural ? (pasado ? 'fueron' : 'son') : pasado ? 'fue' : 'es'} `;
    if (g.finde) {
      const primero = g.dias[0]!;
      const nombre = new Date(`${primero}T00:00:00Z`).getUTCDay() === 6 ? 'sábado' : 'domingo';
      return `el ${numero(primero)} ${verbo(false)}${nombre}`;
    }
    const dias = enumerar(g.dias.map((d) => `el ${numero(d)}`));
    return g.dias.length === 1
      ? `${dias} ${verbo(false)}feriado`
      : `${dias} ${verbo(true)}feriados`;
  });
  return partes.length ? enumerar(partes) : null;
}

/**
 * Regla 178: la línea del mes en curso —cuándo vencen los alquileres,
 * cuándo se paga a los propietarios y desde cuándo hay que generar el mes
 * siguiente (regla 181)—, con los días de la configuración de la
 * inmobiliaria y corridas al primer día hábil con la MISMA función que el
 * vencimiento de los conceptos (`vencimientosDelPeriodo`, regla 100): el
 * pago a los propietarios tampoco va antes del vencimiento (regla 112).
 */
export function cicloDelMes(
  hoy: string,
  dias: DiasDelCiclo,
  feriados: ReadonlySet<string>,
): CicloDelMes {
  const mes = hoy.slice(0, 7);
  const { inquilino, propietario } = vencimientosDelPeriodo(
    mes,
    `${mes}-01`,
    dias.contratoDiaVencimiento,
    dias.contratoDiaPagoPropietario,
    feriados,
  );
  const hito = (dia: number, fecha: string): HitoDelCiclo => ({
    dia,
    fecha,
    motivo: motivoDelCorrimiento(diaDelMes(mes, dia), fecha, feriados, hoy),
  });
  // El pago puede correrse además por el vencimiento: no se le paga al
  // propietario antes de que venza el alquiler del inquilino (regla 112).
  const pagoHabil = vencimientoDelMes(mes, dias.contratoDiaPagoPropietario, feriados);
  const pago = hito(dias.contratoDiaPagoPropietario, propietario);
  return {
    mes,
    vencimiento: hito(dias.contratoDiaVencimiento, inquilino),
    pagoPropietarios:
      propietario > pagoHabil
        ? { ...pago, motivo: 'no se paga antes del vencimiento de los alquileres' }
        : pago,
    generarSiguiente: {
      ...hito(dias.diaAvisoGenerar, vencimientoDelMes(mes, dias.diaAvisoGenerar, feriados)),
      mes: sumarMesesIso(`${mes}-01`, 1).slice(0, 7),
    },
  };
}
