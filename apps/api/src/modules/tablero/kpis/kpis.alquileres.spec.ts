import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Rol } from '@vacker/types';
import { ROLES_KEY } from '../../../auth/decorators';
import { alquileresPorMes, type AlquilerRow } from './kpis.calc';
import { KpisController } from './kpis.controller';

/**
 * La sección Alquileres del tablero, pedida por Vacker el 25/09/2026.
 *
 * Los alquileres se cargan sin puntas: son de la inmobiliaria, no de un
 * vendedor. Por eso no los rige el alcance de «Ver todo» sino el rol.
 */

describe('alquileres — quién puede pedirlos', () => {
  function rolesDe(metodo: keyof KpisController): Rol[] {
    const roles = Reflect.getMetadata(ROLES_KEY, KpisController.prototype[metodo]) as
      Rol[] | undefined;
    if (!roles) throw new Error(`El handler ${String(metodo)} no declara @Roles.`);
    return roles;
  }

  it('solo dirección y el administrador de la inmobiliaria', () => {
    expect([...rolesDe('alquileres')].sort()).toEqual(['admin_tenant', 'direccion']);
  });

  /*
   * Ocultar la sección en la pantalla no alcanza: el endpoint tiene que negar.
   * Si alguien agrega 'vendedor' acá creyendo que «total, no la ve», un
   * vendedor puede pedir las comisiones de toda la inmobiliaria a mano.
   */
  it('un vendedor, un team leader o un publicador reciben 403, no ceros', () => {
    const roles = rolesDe('alquileres');
    expect(roles).not.toContain('vendedor');
    expect(roles).not.toContain('team_leader');
    expect(roles).not.toContain('publicador');
  });
});

describe('alquileres — el reparto en meses', () => {
  const fila = (mes: number | null, comision: number, valorMensual: number): AlquilerRow => ({
    mes,
    comision,
    valorMensual,
  });

  it('devuelve siempre los doce meses, aunque estén vacíos', () => {
    const meses = alquileresPorMes([]);
    expect(meses).toHaveLength(12);
    expect(meses.map((m) => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(meses.every((m) => m.firmados === 0)).toBe(true);
  });

  it('cuenta, suma la comisión y suma el valor mensual de cada mes', () => {
    const meses = alquileresPorMes([fila(3, 100, 400), fila(3, 50, 600), fila(7, 80, 300)]);
    expect(meses[2]).toEqual({ mes: 3, firmados: 2, comision: 150, valorMensualSuma: 1000 });
    expect(meses[6]).toEqual({ mes: 7, firmados: 1, comision: 80, valorMensualSuma: 300 });
    expect(meses[0]!.firmados).toBe(0);
  });

  /*
   * El valor mensual viaja SUMADO para que el promedio de un trimestre sea el
   * de sus alquileres y no el de sus meses. Con 1 alquiler de 1.000 en enero y
   * 9 de 100 en febrero, el promedio real es 190; promediando los meses daría
   * 550, que es el precio de nadie.
   */
  it('entrega sumas, para que el promedio de un período sea exacto', () => {
    const meses = alquileresPorMes([
      fila(1, 0, 1000),
      ...Array.from({ length: 9 }, () => fila(2, 0, 100)),
    ]);
    const firmados = meses[0]!.firmados + meses[1]!.firmados;
    const suma = meses[0]!.valorMensualSuma + meses[1]!.valorMensualSuma;
    expect(suma / firmados).toBe(190);
  });

  it('no inventa un mes para una fila sin mes', () => {
    const meses = alquileresPorMes([fila(null, 999, 999), fila(13, 999, 999)]);
    expect(meses.reduce((s, m) => s + m.firmados, 0)).toBe(0);
  });
});

/**
 * La tarjeta «Alquileres firmados» de arriba del tablero.
 *
 * Hasta el 25/09/2026 dependía de `scope.mode === 'tenant'`, o sea de tener
 * tildado «Ver todo». Un director sin tildarlo veía 0 mientras la inmobiliaria
 * tenía 35 — y con la sección nueva debajo mostrando 35, la pantalla se habría
 * contradicho a sí misma. Ahora la rige el rol, igual que la sección.
 */
describe('alquileres — la tarjeta de arriba sigue la misma regla', () => {
  async function resumenCon(roles: Rol[], verTodo: boolean) {
    const { KpisService } = await import('./kpis.service');
    const alquileres = [
      { comTotal: 100, valorMensual: 400 },
      { comTotal: 200, valorMensual: 600 },
    ];
    const tx = {
      operacion: {
        findMany: async ({ where }: { where: { tipo: string } }) =>
          where.tipo === 'alquiler' ? alquileres : [],
      },
      usuario: { findMany: async () => [] },
    };
    const db = { withTenant: async (fn: (t: unknown) => unknown) => fn(tx) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new KpisService(db as any);
    return service.resumen({ anio: 2026, verTodo }, { tenantId: 't1', userId: 'u1', roles });
  }

  it('un director SIN «Ver todo» ve los alquileres de la inmobiliaria', async () => {
    const r = await resumenCon(['direccion'], false);
    expect(r.alquileres).toEqual({ firmados: 2, comision: 300, valorMensualPromedio: 500 });
  });

  it('el administrador los ve', async () => {
    expect((await resumenCon(['admin_tenant'], false)).alquileres.firmados).toBe(2);
  });

  it('un vendedor no, y un team leader tampoco aunque tilde «Ver todo»', async () => {
    expect((await resumenCon(['vendedor'], false)).alquileres.firmados).toBe(0);
    expect((await resumenCon(['team_leader'], true)).alquileres.firmados).toBe(0);
  });
});
