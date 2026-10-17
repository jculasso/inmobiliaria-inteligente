import { Prisma } from '@prisma/client';
import type { FilaTablero, Indicador, MonedaAlquiler } from '@vacker/types';
import { claveParcialDeFinal, redondear2 } from '@vacker/domain';
import { decToNum, fromDate } from '../../tablero/tablero.util';
import { plata } from '../historial';
import { aPersona, enDias, porCantidad, porImporte, sumar } from './comun';
import type { Fichas } from './fichas';

/** Un alquiler del lado del inquilino, con lo cobrado hasta hoy y al cierre de su mes. */
export interface FilaAlquiler {
  id: string;
  periodo: string;
  moneda: string;
  importe: Prisma.Decimal;
  vencimiento: Date;
  descripcion: string | null;
  contrato_id: string | null;
  tipo_contrato: string | null;
  persona_id: string;
  nombre: string;
  cobrado: Prisma.Decimal;
  cobrado_al_cierre: Prisma.Decimal;
  /** La clave de generación: une la liquidación final con su parcial (regla 139). */
  clave?: string | null;
  sentido?: string;
}

/**
 * Los alquileres de los meses `desde`…`hasta` (y, si se pide, uno más suelto),
 * uno por fila. `cobrado` es lo aplicado hasta hoy; `cobrado_al_cierre`, lo
 * aplicado hasta el último día de su mes (regla 29). Las dos sin lo de cobros
 * anulados: el mismo filtro que `IMPUTACION_ACTIVA`, escrito en SQL.
 *
 * Lo leen el tablero, que lo suma por mes, y el detalle, que lo lista: la
 * misma consulta en los dos lados (regla 79).
 */
export function sqlAlquileres(desde: string, hasta: string, ademas: string | null = null) {
  // Además del alquiler del inquilino, el espejo de una liquidación final
  // negativa —el reintegro a su favor, regla 134—, que `unirFinales` le resta
  // a su parcial. La clave conserva el tipo y el sentido del concepto que
  // ajusta: así se distingue del reintegro de un gasto.
  return Prisma.sql`
    SELECT k.id, k.periodo, k.moneda, k.importe, k.vencimiento, k.descripcion,
           k.clave_generacion AS clave, k.sentido,
           k.contrato_id, c.tipo AS tipo_contrato, p.id AS persona_id, p.nombre,
           COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) AS cobrado,
           COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL
                                              AND re.fecha < (to_date(k.periodo, 'YYYY-MM') + INTERVAL '1 month')), 0) AS cobrado_al_cierre
      FROM alq_concepto k
      JOIN alq_persona p ON p.id = k.persona_id
      LEFT JOIN alq_contrato c ON c.id = k.contrato_id
      LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
      LEFT JOIN alq_cobro co ON co.id = im.cobro_id
      LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
     WHERE (k.tipo = 'alquiler' AND k.sentido = 'a_cobrar'
            OR k.etapa = 'final' AND k.tipo = 'otro' AND k.sentido = 'a_pagar'
               AND k.clave_generacion LIKE '%|alquiler|a_cobrar|%')
       AND k.anulado_en IS NULL
       AND (k.periodo BETWEEN ${desde} AND ${hasta}${ademas ? Prisma.sql` OR k.periodo = ${ademas}` : Prisma.empty})
     GROUP BY k.id, c.tipo, p.id
     ORDER BY k.vencimiento, k.id`;
}

/**
 * Regla 139: la liquidación final es la diferencia del MISMO alquiler, no un
 * alquiler más. Cada final se suma a su parcial —el importe, lo cobrado hasta
 * hoy y lo cobrado al cierre—: emitidos cuenta un alquiler, y el importe es el
 * definitivo. El espejo de una final negativa (un reintegro al inquilino) le
 * resta al importe; lo cobrado no puede pasar lo que se debía.
 *
 * Una final cuya parcial no está (anulada, o de otro período) queda sola si es
 * un cargo y se descarta si es un reintegro: sola no es un alquiler.
 */
export function unirFinales(rows: FilaAlquiler[]): FilaAlquiler[] {
  const porClave = new Map(rows.filter((r) => r.clave).map((r) => [r.clave!, r]));
  const unidas = new Map<string, FilaAlquiler>();
  const salida: FilaAlquiler[] = [];
  for (const r of rows) {
    const base = claveParcialDeFinal(r.clave ?? null);
    const parcial = base ? porClave.get(base) : undefined;
    if (!base) {
      salida.push(r);
      continue;
    }
    if (!parcial) {
      if (r.sentido !== 'a_pagar') salida.push(r);
      continue;
    }
    const previa = unidas.get(base) ?? {
      ...parcial,
      descripcion: `${(parcial.descripcion ?? 'Alquiler').split(' — ')[0]} — liquidación parcial y final`,
    };
    const signo = r.sentido === 'a_pagar' ? -1 : 1;
    const importe = new Prisma.Decimal(previa.importe).add(
      new Prisma.Decimal(r.importe).mul(signo),
    );
    const tope = (x: Prisma.Decimal) => (x.greaterThan(importe) ? importe : x);
    const mas = (a: Prisma.Decimal, b: Prisma.Decimal) =>
      signo > 0 ? new Prisma.Decimal(a).add(b) : new Prisma.Decimal(a);
    unidas.set(base, {
      ...previa,
      importe,
      cobrado: tope(mas(previa.cobrado, r.cobrado)),
      cobrado_al_cierre: tope(mas(previa.cobrado_al_cierre, r.cobrado_al_cierre)),
    });
  }
  return salida.map((r) => (r.clave && unidas.get(r.clave)) || r);
}

// --- Las definiciones: un número y su lista salen de acá --------------------------

export type IndicadorCobranza = 'emitidos' | 'cobrados' | 'importeEmitido' | 'importeCobrado';

const importeDe = (r: FilaAlquiler) => decToNum(r.importe);
const cobradoDe = (r: FilaAlquiler) => redondear2(decToNum(r.cobrado));

/**
 * Reglas 28 y 75: qué alquileres cuenta cada número de la cobranza y con qué
 * importe. Uno pagado en parte no cuenta como cobrado, pero suma lo pagado.
 * El tablero suma cada mes con esto y el detalle lista con esto: no pueden
 * contradecirse.
 */
const COBRANZA: Record<
  IndicadorCobranza,
  { entra: (r: FilaAlquiler) => boolean; importe: (r: FilaAlquiler) => number; cuenta: boolean }
> = {
  emitidos: { entra: () => true, importe: importeDe, cuenta: true },
  cobrados: { entra: (r) => cobradoDe(r) >= importeDe(r), importe: importeDe, cuenta: true },
  importeEmitido: { entra: () => true, importe: importeDe, cuenta: false },
  importeCobrado: { entra: (r) => cobradoDe(r) > 0, importe: cobradoDe, cuenta: false },
};

/** Cada número de la cobranza de unos alquileres de una moneda, con su lista. */
export function cobranzaDe(
  rows: FilaAlquiler[],
  f: Fichas,
  hoy: string,
  moneda: MonedaAlquiler,
): Record<IndicadorCobranza, Indicador> {
  const estadoDe = (k: FilaAlquiler) => {
    const c = cobradoDe(k);
    const total = importeDe(k);
    if (c >= total) return 'Cobrado';
    if (c > 0) return `Pagó ${plata(c, moneda)}, falta ${plata(redondear2(total - c), moneda)}`;
    const vence = fromDate(k.vencimiento)!;
    return vence < hoy ? `Vencido hace ${enDias(-f.diasHasta(vence))}` : 'Pendiente';
  };
  const fila = (k: FilaAlquiler, importe: number): FilaTablero =>
    f.filaDe(k.contrato_id, {
      id: k.id,
      href: aPersona(k.persona_id),
      inquilino: k.nombre,
      persona: k.nombre,
      moneda,
      detalle: k.descripcion ?? 'Alquiler',
      fecha: fromDate(k.vencimiento),
      importe,
      estado: estadoDe(k),
    });
  const ks = rows.filter((k) => k.moneda === moneda);
  const indicador = (i: IndicadorCobranza) => {
    const def = COBRANZA[i];
    const filas = ks.filter(def.entra).map((k) => fila(k, def.importe(k)));
    return def.cuenta ? porCantidad(filas) : porImporte(filas);
  };
  return {
    emitidos: indicador('emitidos'),
    cobrados: indicador('cobrados'),
    importeEmitido: indicador('importeEmitido'),
    importeCobrado: indicador('importeCobrado'),
  };
}

/**
 * Cobranza del mes en curso (regla 28), por moneda.
 * La pantalla de hoy suma `evolucion`; esto queda por el orden de despliegue.
 */
export function cobranzaDelMes(alquileres: FilaAlquiler[], mes: string, f: Fichas, hoy: string) {
  const delMes = alquileres.filter((k) => k.periodo === mes);
  return [...new Set(delMes.map((k) => k.moneda))].sort().map((moneda) => ({
    moneda: moneda as MonedaAlquiler,
    ...cobranzaDe(delMes, f, hoy, moneda as MonedaAlquiler),
  }));
}

/** Los meses del año, sumados con las mismas definiciones que el detalle (reglas 29 y 75). */
export function evolucionDelAnio(alquileres: FilaAlquiler[], meses: string[]) {
  return meses.flatMap((m) => {
    const delMesM = alquileres.filter((k) => k.periodo === m);
    return [...new Set(delMesM.map((k) => k.moneda))].sort().map((moneda) => {
      const ks = delMesM.filter((k) => k.moneda === moneda);
      const total = (i: IndicadorCobranza) =>
        sumar(ks.filter(COBRANZA[i].entra).map(COBRANZA[i].importe));
      const cuantos = (i: IndicadorCobranza) => ks.filter(COBRANZA[i].entra).length;
      return {
        mes: m,
        moneda: moneda as MonedaAlquiler,
        emitido: total('importeEmitido'),
        cobrado: sumar(ks.map((k) => decToNum(k.cobrado_al_cierre))),
        emitidos: cuantos('emitidos'),
        cobrados: cuantos('cobrados'),
        cobradoHoy: total('importeCobrado'),
      };
    });
  });
}
