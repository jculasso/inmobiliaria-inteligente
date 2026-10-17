import { Prisma } from '@prisma/client';
import type { DetalleTableroQuery, Indicador } from '@vacker/types';
import { toDate } from '../../tablero/tablero.util';
import { carteraAl } from './cartera';
import { cobranzaDe, sqlAlquileres, unirFinales, type FilaAlquiler } from './cobranza';
import { porCantidad, porImporte, primeroDelSiguiente, type Tx } from './comun';
import { fichas, ORDEN_CONTRATOS, SELECT_CONTRATO, type ContratoLeido } from './fichas';
import {
  filaIngreso,
  PARTE_DE_TIPO,
  sqlMovimientosIngresos,
  type MovimientoIngreso,
} from './ingresos';
import { moraAl, morosidadDe, sqlSaldosAlCierre, type FilaMora } from './morosidad';

/**
 * El detalle de un número (regla 79), dentro de la transacción de
 * `withTenant`. `cierre` es el de `hasta` (regla 77): las fotos son a esa
 * fecha. Ver `TableroAlquileresService.detalle`.
 */
export async function detalleDeUnNumero(
  tx: Tx,
  q: DetalleTableroQuery,
  cierre: string,
  hoy: string,
): Promise<Indicador> {
  const { indicador, desde, hasta, tipo, moneda } = q;
  const delTipo = (t: string | null) => tipo === 'todos' || t === tipo;
  const contratosDe = (ids: (string | null)[]) => {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    return unicos.length
      ? tx.alqContrato.findMany({
          where: { id: { in: unicos } },
          select: SELECT_CONTRATO,
          orderBy: ORDEN_CONTRATOS,
        })
      : Promise.resolve([] as ContratoLeido[]);
  };

  switch (indicador) {
    case 'emitidos':
    case 'cobrados':
    case 'importeEmitido':
    case 'importeCobrado': {
      const rows = unirFinales(
        await tx.$queryRaw<FilaAlquiler[]>(sqlAlquileres(desde, hasta)),
      ).filter((r) => delTipo(r.tipo_contrato));
      const f = fichas(await contratosDe(rows.map((r) => r.contrato_id)), hoy);
      return cobranzaDe(rows, f, hoy, moneda)[indicador];
    }
    case 'ingresos':
    case 'honorarios':
    case 'gastos':
    case 'punitorios':
    case 'comisiones': {
      const rows = (
        await tx.$queryRaw<MovimientoIngreso[]>(
          Prisma.sql`SELECT * FROM (${sqlMovimientosIngresos(`${desde}-01`, primeroDelSiguiente(hasta))}) m ORDER BY m.fecha, m.id`,
        )
      ).filter(
        (m) =>
          delTipo(m.tipo_contrato) &&
          m.moneda === moneda &&
          (indicador === 'ingresos' || PARTE_DE_TIPO[m.tipo] === indicador),
      );
      const f = fichas(await contratosDe(rows.map((m) => m.contrato_id)), hoy);
      return porImporte(rows.map((m) => filaIngreso(m, f)));
    }
    case 'vigentes':
    case 'alquilerMensual': {
      const contratos = (
        await tx.alqContrato.findMany({
          where: {
            estado: { notIn: ['borrador', 'anulado'] },
            inicio: { lte: toDate(cierre)! },
            OR: [{ estado: 'vigente' }, { fin: { gte: toDate(cierre)! } }],
          },
          select: SELECT_CONTRATO,
          orderBy: ORDEN_CONTRATOS,
        })
      ).filter((c) => delTipo(c.tipo));
      const f = fichas(contratos, hoy);
      const cartera = carteraAl(contratos, cierre, hoy);
      if (indicador === 'vigentes')
        return porCantidad(cartera.vigentes.map((c) => f.filaContrato(c)));
      return porImporte(
        (cartera.alquilerMensual.find((a) => a.moneda === moneda)?.contratos ?? []).map(
          ({ c, importe }) => f.filaContrato(c, { importe }),
        ),
      );
    }
    case 'mora': {
      const rows = (await tx.$queryRaw<FilaMora[]>(sqlSaldosAlCierre([cierre]))).filter((m) =>
        delTipo(m.tipo_contrato),
      );
      const f = fichas(await contratosDe(rows.map((m) => m.contrato_id)), hoy);
      const m = morosidadDe(moraAl(rows, cierre, f)).find((x) => x.moneda === moneda);
      if (!m) return { valor: 0, filas: [] };
      return q.tramo ? m.tramos.find((x) => x.tramo === q.tramo)!.indicador : m.total;
    }
  }
}
