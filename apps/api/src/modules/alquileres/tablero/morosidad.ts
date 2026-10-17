import { Prisma } from '@prisma/client';
import { TRAMOS_MORA, type MonedaAlquiler, type TramoMora } from '@vacker/types';
import { diasInclusive, tramoDeMora } from '@vacker/domain';
import { decToNum, fromDate } from '../../tablero/tablero.util';
import { aPersona, porImporte } from './comun';
import type { Fichas } from './fichas';

/** Un concepto con saldo vencido a una fecha de cierre (regla 77). */
export interface FilaMora {
  cierre: string;
  id: string;
  moneda: string;
  vencimiento: Date;
  descripcion: string | null;
  tipo: string;
  saldo: Prisma.Decimal;
  contrato_id: string | null;
  codigo: string | null;
  persona_id: string;
  nombre: string;
  tipo_contrato: string | null;
}

/**
 * Deuda vencida de inquilinos a cada fecha de `cierres` (reglas 29 y 77): lo
 * vencido antes de esa fecha menos lo cobrado hasta esa fecha, sin cobros
 * anulados. Solo lo que tiene saldo. Lo de un propietario en su contrato se
 * descuenta al liquidar, no es mora.
 *
 * Una sola consulta para todas las fechas: el tablero pide los cierres del
 * año y hoy; el detalle, un cierre. El informe al propietario la pide a hoy y
 * solo de sus contratos (regla 89): la misma deuda que el Dashboard.
 */
export function sqlSaldosAlCierre(cierres: string[], contratos?: string[]) {
  return Prisma.sql`
    SELECT * FROM (
      SELECT to_char(x.cierre, 'YYYY-MM-DD') AS cierre, k.id, k.moneda, k.vencimiento, k.descripcion, k.tipo,
             k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL
                                                           AND re.fecha <= x.cierre), 0) AS saldo,
             c.id AS contrato_id, c.codigo, c.tipo AS tipo_contrato, p.id AS persona_id, p.nombre
        FROM unnest(${cierres}::date[]) AS x(cierre)
        JOIN alq_concepto k ON k.vencimiento < x.cierre
        JOIN alq_persona p ON p.id = k.persona_id
        LEFT JOIN alq_contrato c ON c.id = k.contrato_id
        LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
        LEFT JOIN alq_cobro co ON co.id = im.cobro_id
        LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
       WHERE k.sentido = 'a_cobrar' AND k.anulado_en IS NULL AND k.liquidacion_id IS NULL
         AND k.tipo <> 'honorarios'
         ${contratos ? Prisma.sql`AND k.contrato_id = ANY(${contratos}::uuid[])` : Prisma.empty}
         AND NOT EXISTS (SELECT 1 FROM alq_contrato_parte pp
                          WHERE pp.contrato_id = k.contrato_id AND pp.persona_id = k.persona_id AND pp.papel = 'propietario')
       GROUP BY x.cierre, k.id, c.id, p.id
    ) s
     WHERE s.saldo > 0
     ORDER BY s.cierre, s.vencimiento, s.id`;
}

/** La deuda vencida a un cierre, concepto por concepto, con su antigüedad a esa fecha. */
export function moraAl(rows: FilaMora[], cierre: string, f: Fichas) {
  return rows
    .filter((m) => m.cierre === cierre)
    .map((m) => {
      const vence = fromDate(m.vencimiento)!;
      const dias = diasInclusive(vence, cierre) - 1;
      return {
        moneda: m.moneda as MonedaAlquiler,
        tramo: tramoDeMora(dias),
        dias,
        personaId: m.persona_id,
        fila: f.filaDe(m.contrato_id, {
          id: m.id,
          href: aPersona(m.persona_id),
          inquilino: m.nombre,
          persona: m.nombre,
          moneda: m.moneda as MonedaAlquiler,
          detalle: m.descripcion ?? m.tipo,
          fecha: vence,
          dias,
          importe: decToNum(m.saldo),
        }),
      };
    });
}

/** Regla 29: la deuda por moneda y por antigüedad. */
export function morosidadDe(items: ReturnType<typeof moraAl>) {
  return [...new Set(items.map((x) => x.moneda))].sort().map((moneda) => {
    const fs = items.filter((x) => x.moneda === moneda);
    return {
      moneda: moneda as MonedaAlquiler,
      total: porImporte(fs.map((x) => x.fila)),
      inquilinos: new Set(fs.map((x) => x.personaId)).size,
      tramos: TRAMOS_MORA.map((tramo: TramoMora) => ({
        tramo,
        indicador: porImporte(fs.filter((x) => x.tramo === tramo).map((x) => x.fila)),
      })),
    };
  });
}

/** La foto de la deuda a un cierre (regla 77): solo los números, sin las listas. */
export function moraDelCierre(mora: FilaMora[], cierre: string, f: Fichas) {
  return morosidadDe(moraAl(mora, cierre, f)).map((x) => ({
    moneda: x.moneda,
    valor: x.total.valor,
    conceptos: x.total.filas.length,
    inquilinos: x.inquilinos,
    tramos: x.tramos.map((t) => ({
      tramo: t.tramo,
      valor: t.indicador.valor,
      conceptos: t.indicador.filas.length,
    })),
  }));
}
