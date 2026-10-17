import { Prisma } from '@prisma/client';
import type { FilaTablero, MonedaAlquiler, ParteIngresos } from '@vacker/types';
import { redondear2 } from '@vacker/domain';
import { decToNum, fromDate, toDate } from '../../tablero/tablero.util';
import { aContrato } from './comun';
import type { Fichas } from './fichas';

/** Un movimiento que es ingreso de la inmobiliaria (regla 30). */
export interface MovimientoIngreso {
  id: string;
  fecha: Date;
  moneda: string;
  contrato_id: string;
  tipo_contrato: string | null;
  tipo: string;
  importe: Prisma.Decimal;
  descripcion: string | null;
  persona_id: string;
  nombre: string;
}

/** Los ingresos de un mes por tipo de concepto, como los suma `sqlIngresosPorMes`. */
export interface FilaIngresoMes {
  mes: string;
  moneda: string;
  tipo_contrato: string | null;
  tipo: string;
  importe: Prisma.Decimal;
}

/**
 * Regla 30: lo que gana la inmobiliaria. Gastos administrativos, punitorios,
 * comisiones e informes cobrados (por la fecha del cobro) y honorarios
 * descontados (por la fecha de la liquidación), entre `desde` y `hasta`
 * (excluido). El tablero lo agrega por mes; el detalle lo lista.
 */
export function sqlMovimientosIngresos(desde: string, hasta: string) {
  return Prisma.sql`
    SELECT im.id, re.fecha, k.moneda, c.id AS contrato_id, c.tipo AS tipo_contrato, k.tipo, im.importe,
           k.descripcion, p.id AS persona_id, p.nombre
      FROM alq_imputacion im
      JOIN alq_concepto k ON k.id = im.concepto_id
      JOIN alq_contrato c ON c.id = k.contrato_id
      JOIN alq_persona p ON p.id = k.persona_id
      JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
      JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
     WHERE k.tipo IN ('gastos_adm', 'punitorio', 'comision', 'informe')
       AND re.fecha >= ${toDate(desde)} AND re.fecha < ${toDate(hasta)}
     UNION ALL
    SELECT k.id, l.fecha, k.moneda, c.id, c.tipo, k.tipo, k.importe, k.descripcion, p.id, p.nombre
      FROM alq_concepto k
      JOIN alq_contrato c ON c.id = k.contrato_id
      JOIN alq_liquidacion l ON l.id = k.liquidacion_id AND l.anulado_en IS NULL
      JOIN alq_persona p ON p.id = l.persona_id
     WHERE k.tipo = 'honorarios' AND l.fecha >= ${toDate(desde)} AND l.fecha < ${toDate(hasta)}
     UNION ALL
    -- Regla 134: el espejo de una liquidación final negativa resta del ingreso
    -- que ajusta. Los gastos que se le devuelven al inquilino, cuando se
    -- compensan en un cobro; los honorarios que se le devuelven al dueño,
    -- cuando se liquidan.
    SELECT im.id, re.fecha, k.moneda, c.id, c.tipo, 'gastos_adm', -im.importe, k.descripcion, p.id, p.nombre
      FROM alq_imputacion im
      JOIN alq_concepto k ON k.id = im.concepto_id
      JOIN alq_contrato c ON c.id = k.contrato_id
      JOIN alq_persona p ON p.id = k.persona_id
      JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
      JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
     WHERE k.etapa = 'final' AND k.tipo = 'otro' AND k.clave_generacion LIKE '%|gastos_adm|a_cobrar|%'
       AND re.fecha >= ${toDate(desde)} AND re.fecha < ${toDate(hasta)}
     UNION ALL
    SELECT k.id, l.fecha, k.moneda, c.id, c.tipo, 'honorarios', -k.importe, k.descripcion, p.id, p.nombre
      FROM alq_concepto k
      JOIN alq_contrato c ON c.id = k.contrato_id
      JOIN alq_liquidacion l ON l.id = k.liquidacion_id AND l.anulado_en IS NULL
      JOIN alq_persona p ON p.id = l.persona_id
     WHERE k.etapa = 'final' AND k.tipo = 'otro' AND k.clave_generacion LIKE '%|honorarios|a_cobrar|%'
       AND l.fecha >= ${toDate(desde)} AND l.fecha < ${toDate(hasta)}`;
}

/** Los ingresos de cada mes, sumados en la base por tipo de concepto: no crecen con los movimientos. */
export function sqlIngresosPorMes(desde: string, hasta: string) {
  return Prisma.sql`
    SELECT to_char(m.fecha, 'YYYY-MM') AS mes, m.moneda, m.tipo_contrato, m.tipo, SUM(m.importe) AS importe
      FROM (${sqlMovimientosIngresos(desde, hasta)}) m
     GROUP BY 1, 2, 3, 4
     ORDER BY 1, 2`;
}

/** Regla 30: a qué parte de los ingresos va cada tipo de concepto. */
export const PARTE_DE_TIPO: Record<string, ParteIngresos> = {
  honorarios: 'honorarios',
  gastos_adm: 'gastos',
  punitorio: 'punitorios',
  comision: 'comisiones',
  informe: 'comisiones',
};
const NOMBRE_TIPO_INGRESO: Record<string, string> = {
  honorarios: 'Honorarios',
  gastos_adm: 'Gastos administrativos',
  punitorio: 'Punitorio',
  comision: 'Comisión',
  informe: 'Informe de garantía',
};

/** Los movimientos de ingresos como filas del detalle. */
export function filaIngreso(m: MovimientoIngreso, f: Fichas): FilaTablero {
  const nombre = NOMBRE_TIPO_INGRESO[m.tipo] ?? m.tipo;
  return f.filaDe(m.contrato_id, {
    id: m.id,
    href: aContrato(m.contrato_id),
    persona: m.nombre,
    moneda: m.moneda as MonedaAlquiler,
    detalle: m.descripcion ? `${nombre} · ${m.descripcion}` : nombre,
    fecha: fromDate(m.fecha),
    importe: redondear2(decToNum(m.importe)),
  });
}

/** Ingresos por mes (regla 30): cada tipo de concepto a su parte. */
export function ingresosPorMes(filas: FilaIngresoMes[]) {
  const porMes = new Map<string, Record<ParteIngresos, number> & { mes: string; moneda: string }>();
  for (const i of filas) {
    const parte = PARTE_DE_TIPO[i.tipo];
    if (!parte) continue;
    const clave = `${i.mes}|${i.moneda}`;
    const previo = porMes.get(clave) ?? {
      mes: i.mes,
      moneda: i.moneda,
      honorarios: 0,
      gastos: 0,
      punitorios: 0,
      comisiones: 0,
    };
    previo[parte] = redondear2(previo[parte] + decToNum(i.importe));
    porMes.set(clave, previo);
  }
  return [...porMes.values()]
    .sort((a, b) => (a.mes + a.moneda < b.mes + b.moneda ? -1 : 1))
    .map((i) => ({
      mes: i.mes,
      moneda: i.moneda as MonedaAlquiler,
      honorarios: i.honorarios,
      gastos: i.gastos,
      punitorios: i.punitorios,
      comisiones: i.comisiones,
    }));
}
