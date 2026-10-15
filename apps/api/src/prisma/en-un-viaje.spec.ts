import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { enUnViaje, filasEnUnViaje, sqlEnUnViaje } from './en-un-viaje';

const partes = {
  alquileres: {
    sql: Prisma.sql`SELECT k.id, k.importe, k.vencimiento FROM alq_concepto k WHERE k.periodo = ${'2026-10'} ORDER BY k.vencimiento`,
    decimales: ['importe'],
    fechas: ['vencimiento'],
  },
  ingresos: {
    sql: Prisma.sql`SELECT ${'x'}::text AS tipo, 1.5::numeric AS importe`,
    decimales: ['importe'],
  },
};

describe('enUnViaje: varias consultas en una sentencia', () => {
  it('una sola sentencia, con los parámetros de cada parte en orden', () => {
    const sql = sqlEnUnViaje(partes);
    expect(sql.sql.match(/\bSELECT\b/g)).toHaveLength(5);
    expect(sql.sql).toContain(') AS alquileres');
    expect(sql.sql).toContain(') AS ingresos');
    // Los importes viajan como texto: exactos.
    expect(sql.sql).toContain("jsonb_build_object('importe', x.importe::text)");
    expect(sql.values).toEqual(['2026-10', 'x']);
  });

  it('rearma cada fila con los tipos de Prisma: Decimal exacto y la fecha a la medianoche UTC', () => {
    const filas = filasEnUnViaje(partes, {
      alquileres: [
        { id: 'a', importe: '1234567890.12', vencimiento: '2026-10-05' },
        { id: 'b', importe: null, vencimiento: null },
      ],
      ingresos: [],
    });
    const [a, b] = filas.alquileres;
    expect(a!.importe).toBeInstanceOf(Prisma.Decimal);
    expect(String(a!.importe)).toBe('1234567890.12');
    expect((a!.vencimiento as Date).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(b).toEqual({ id: 'b', importe: null, vencimiento: null });
    expect(filas.ingresos).toEqual([]);
  });

  it('un nombre que no es un identificador no entra en el SQL', () => {
    expect(() => sqlEnUnViaje({ 'x; DROP TABLE y': { sql: Prisma.sql`SELECT 1` } })).toThrow(
      /no es un nombre/,
    );
    expect(() =>
      sqlEnUnViaje({ x: { sql: Prisma.sql`SELECT 1`, decimales: ["a', 1)--"] } }),
    ).toThrow(/no es un nombre/);
  });

  it('es una consulta: un viaje', async () => {
    const $queryRaw = vi
      .fn()
      .mockResolvedValue([{ alquileres: [], ingresos: [{ tipo: 'x', importe: '1.5' }] }]);
    const r = await enUnViaje({ $queryRaw } as unknown as Prisma.TransactionClient, partes);
    expect($queryRaw).toHaveBeenCalledTimes(1);
    expect(String(r.ingresos[0]!.importe)).toBe('1.5');
  });
});
