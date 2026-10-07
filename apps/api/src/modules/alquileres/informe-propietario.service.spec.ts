import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InformePeriodoQuerySchema, type InformePropietarioDto } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { InformePropietarioService } from './informe-propietario.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
const HOY = '2026-10-07';
const SEPT = { desde: '2026-09', hasta: '2026-09' };
const DUENA = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const INQ = '33333333-3333-4333-8333-333333333333';
const L1 = '44444444-4444-4444-8444-444444444444';
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function contrato(id: string, codigo: string, dueno = DUENA, moneda = 'ARS') {
  return {
    id,
    codigo,
    moneda,
    estado: 'vigente',
    inicio: d('2025-03-01'),
    fin: d('2028-02-29'),
    rescindidoEl: null,
    pagoGarantizado: false,
    propiedad: { direccion: `Córdoba ${codigo}`, unidad: '3° B' },
    partes: [
      {
        personaId: dueno,
        papel: 'propietario',
        porcentaje: dec(100),
        persona: { nombre: dueno === DUENA ? 'Dueña' : 'Otro' },
      },
      {
        personaId: INQ,
        papel: 'inquilino',
        porcentaje: null,
        persona: { nombre: 'Ana Inquilina' },
      },
    ],
    tramos: [
      { numero: 1, desde: d('2025-03-01'), importe: dec(800_000) },
      { numero: 2, desde: d('2026-03-01'), importe: dec(1_000_000) },
      { numero: 3, desde: d('2027-03-01'), importe: null },
    ],
  };
}

const LIQ = {
  id: L1,
  numero: 12,
  fecha: d('2026-09-10'),
  medio: 'transferencia',
  moneda: 'ARS',
  neto: dec(853_200),
};

/** Un concepto del propietario, como lo devuelve la consulta del informe. */
function concepto(
  c: string,
  tipo: string,
  sentido: 'a_cobrar' | 'a_pagar',
  importe: number,
  over: Record<string, unknown> = {},
) {
  const id = uuid();
  return {
    id,
    personaId: DUENA,
    contratoId: c,
    periodo: '2026-09',
    moneda: 'ARS',
    tipo,
    sentido,
    importe: dec(importe),
    descripcion: `${tipo} septiembre 2026`,
    claveGeneracion: `alq|${c}|2026-09|2026-09-01|${tipo}|${sentido}|${DUENA}`,
    claveOrigen: c,
    origenId: null,
    liquidacionId: null as string | null,
    liquidacion: null as typeof LIQ | null,
    imputaciones: [] as { importe: Prisma.Decimal }[],
    ...over,
  };
}
const liquidado = { liquidacionId: L1, liquidacion: LIQ };

/** Septiembre de un contrato en pesos: todo lo que el informe tiene que contar. */
function delContrato(c: string) {
  return [
    concepto(c, 'alquiler', 'a_pagar', 1_000_000, liquidado),
    concepto(c, 'honorarios', 'a_cobrar', 96_800, liquidado),
    concepto(c, 'reparacion', 'a_cobrar', 50_000, {
      ...liquidado,
      claveGeneracion: `prov|comp-${c}|${DUENA}`,
      claveOrigen: `comp-${c}`,
      descripcion: 'Plomero: cambio de canilla (Plomero Juan)',
    }),
    concepto(c, 'impuesto', 'a_cobrar', 12_345.67, {
      claveGeneracion: `bol|tgi-${c}|c|${DUENA}`,
      claveOrigen: `tgi-${c}`,
      descripcion: 'TGI (Tasa municipal) cuota 9/12',
    }),
    concepto(c, 'expensa', 'a_cobrar', 30_000, {
      claveGeneracion: `bol|ext-${c}|c|${DUENA}`,
      claveOrigen: `ext-${c}`,
      descripcion: 'Expensas extraordinarias',
    }),
    // De la inquilina en el mismo contrato: no es del propietario (regla 86).
    concepto(c, 'servicio', 'a_pagar', 7_000, { personaId: INQ }),
  ];
}

const delInquilino = (c: string, pagado: number, fecha = '2026-09-05') => ({
  tipo: 'alquiler',
  importe: dec(1_000_000),
  claveGeneracion: `alq|${c}|2026-09|2026-09-01|alquiler|a_cobrar|${INQ}`,
  contratoId: c,
  periodo: '2026-09',
  imputaciones: pagado ? [{ importe: dec(pagado), registradaEnCobro: { fecha: d(fecha) } }] : [],
});

const reclamo = (
  c: string | null,
  numero: number,
  aCargo: number[],
  over: Record<string, unknown> = {},
) => ({
  id: uuid(),
  numero,
  asunto: `Pérdida de agua ${numero}`,
  estado: 'en_curso',
  createdAt: new Date('2026-09-12T15:00:00Z'),
  contratoId: c,
  personaId: null,
  proveedor: { nombre: 'Plomero Juan' },
  comprobantes: aCargo.map((x) => ({ importe: dec(x), moneda: 'ARS' })),
  // Como si la base las devolviera: el informe no las tiene que dejar pasar (regla 92).
  notas: [{ texto: 'NOTA INTERNA: el dueño no quiere gastar' }],
  ...over,
});

interface Fixture {
  contratos: ReturnType<typeof contrato>[];
  conceptos: ReturnType<typeof concepto>[];
  inquilino: ReturnType<typeof delInquilino>[];
  reclamos: ReturnType<typeof reclamo>[];
  mora: unknown[];
}

/** Una base de mentira que cuenta las consultas (regla 97). */
function servicio(f: Fixture) {
  const consultas = { n: 0 };
  const llamadas: { reclamos: unknown[] } = { reclamos: [] };
  const contar =
    <T>(fn: (args: never) => T) =>
    (args: never) => {
      consultas.n++;
      return Promise.resolve(fn(args));
    };
  const tx = {
    alqPersona: {
      findUnique: contar((a: { where: { id: string } }) =>
        a.where.id === DUENA
          ? { id: DUENA, nombre: 'Dueña' }
          : a.where.id === INQ
            ? { id: INQ, nombre: 'Ana Inquilina' }
            : null,
      ),
    },
    alqContrato: {
      findMany: contar((a: { where: { partes: { some: { personaId?: string } } } }) =>
        f.contratos.filter(
          (c) =>
            !a.where.partes.some.personaId ||
            c.partes.some(
              (p) => p.papel === 'propietario' && p.personaId === a.where.partes.some.personaId,
            ),
        ),
      ),
    },
    alqConcepto: {
      findMany: contar((a: { where: { personaId?: string; sentido?: string } }) =>
        a.where.sentido === 'a_cobrar'
          ? f.inquilino
          : f.conceptos.filter((k) => !a.where.personaId || k.personaId === a.where.personaId),
      ),
    },
    alqReclamo: {
      findMany: contar((a: unknown) => {
        llamadas.reclamos.push(a);
        return f.reclamos;
      }),
    },
    alqBoleta: {
      findMany: contar((a: { where: { id: { in: string[] } } }) =>
        a.where.id.in.map((id) => ({
          id,
          cuenta: {
            servicio: {
              nombre: id.startsWith('tgi') ? 'TGI (Tasa municipal)' : 'Expensas extraordinarias',
            },
          },
          poliza: null,
        })),
      ),
    },
    alqComprobante: {
      findMany: contar((a: { where: { id: { in: string[] } } }) =>
        a.where.id.in.map((id) => ({
          id,
          descripcion: 'Cambio de canilla',
          proveedor: { nombre: 'Plomero Juan' },
          reclamo: { numero: 7 },
        })),
      ),
    },
    $queryRaw: vi.fn(() => {
      consultas.n++;
      return Promise.resolve(f.mora);
    }),
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  return { s: new InformePropietarioService(db), consultas, llamadas };
}

const C1 = '55555555-5555-4555-8555-555555555555';
const C2 = '66666666-6666-4666-8666-666666666666';
const C3 = '77777777-7777-4777-8777-777777777777';

function fixture(): Fixture {
  return {
    contratos: [
      contrato(C1, 'ALT-0001'),
      contrato(C2, 'ALT-0002', DUENA, 'USD'),
      contrato(C3, 'ALT-0003', OTRO),
    ],
    conceptos: [
      ...delContrato(C1),
      // En dólares, septiembre que la inquilina todavía no pagó.
      concepto(C2, 'alquiler', 'a_pagar', 800, { moneda: 'USD' }),
      concepto(C2, 'honorarios', 'a_cobrar', 77.44, { moneda: 'USD' }),
      // De otro propietario.
      concepto(C3, 'alquiler', 'a_pagar', 500_000, { personaId: OTRO }),
    ],
    inquilino: [delInquilino(C1, 1_000_000), delInquilino(C2, 0), delInquilino(C3, 500_000)],
    reclamos: [reclamo(C1, 7, [50_000]), reclamo(C1, 8, []), reclamo(C3, 9, [10_000])],
    mora: [
      {
        cierre: HOY,
        id: uuid(),
        moneda: 'ARS',
        vencimiento: d('2026-08-05'),
        descripcion: 'Alquiler agosto',
        tipo: 'alquiler',
        saldo: dec(200_000),
        contrato_id: C1,
        codigo: 'ALT-0001',
        persona_id: INQ,
        nombre: 'Ana Inquilina',
        tipo_contrato: 'vivienda',
      },
      {
        cierre: HOY,
        id: uuid(),
        moneda: 'ARS',
        vencimiento: d('2026-08-05'),
        descripcion: 'Alquiler agosto',
        tipo: 'alquiler',
        saldo: dec(99),
        contrato_id: C3,
        codigo: 'ALT-0003',
        persona_id: INQ,
        nombre: 'Ana Inquilina',
        tipo_contrato: 'vivienda',
      },
    ],
  };
}

const informe = (f = fixture()) => servicio(f).s.informe(DUENA, SEPT, HOY);
const ars = (i: InformePropietarioDto) => i.resumen.find((c) => c.moneda === 'ARS')!;

describe('InformePropietarioService', () => {
  it('regla 87: la cadena cierra al centavo', async () => {
    const c = ars(await informe());
    expect(c).toEqual({
      moneda: 'ARS',
      alquiler: 1_000_000,
      enEspera: 0,
      cobrado: 1_000_000,
      honorarios: 96_800,
      impuestos: 12_345.67,
      expensas: 30_000,
      arreglos: 50_000,
      otros: 0,
      reintegros: 0,
      neto: 810_854.33,
      liquidado: 853_200,
      pendiente: -42_345.67,
    });
    const cent = (x: number) => Math.round(x * 100);
    expect(cent(c.alquiler) - cent(c.enEspera)).toBe(cent(c.cobrado));
    expect(
      cent(c.cobrado) -
        cent(c.honorarios) -
        cent(c.impuestos) -
        cent(c.expensas) -
        cent(c.arreglos) -
        cent(c.otros) +
        cent(c.reintegros),
    ).toBe(cent(c.neto));
    expect(cent(c.liquidado) + cent(c.pendiente)).toBe(cent(c.neto));
  });

  it('regla 86: solo lo suyo como propietario; lo de la inquilina y lo de otro dueño no entran', async () => {
    const i = await informe();
    expect(i.contratos.map((c) => c.codigo)).toEqual(['ALT-0001', 'ALT-0002']);
    expect(i.partidas.some((p) => p.categoria === 'reintegros')).toBe(false);
    expect(i.resumen.every((c) => c.alquiler !== 1_500_000)).toBe(true);
  });

  it('regla 88: pesos y dólares no se mezclan', async () => {
    const i = await informe();
    expect(i.resumen.map((c) => c.moneda)).toEqual(['ARS', 'USD']);
    expect(i.resumen.find((c) => c.moneda === 'USD')).toMatchObject({
      alquiler: 800,
      enEspera: 800,
      cobrado: 0,
      // Los honorarios esperan con su alquiler: no se descontaron.
      honorarios: 0,
      neto: 0,
      liquidado: 0,
      pendiente: 0,
    });
  });

  it('regla 89: la deuda vencida de sus inquilinos, a hoy, solo de sus contratos', async () => {
    const i = await informe();
    expect(i.deuda).toEqual([
      {
        moneda: 'ARS',
        total: 200_000,
        contratos: [{ id: C1, codigo: 'ALT-0001', inquilino: 'Ana Inquilina', importe: 200_000 }],
      },
    ]);
  });

  it('regla 90: cada contrato con su mes, cuándo se cobró y en qué liquidación', async () => {
    const [c1, c2] = (await informe()).contratos;
    expect(c1).toMatchObject({
      propiedad: 'Córdoba ALT-0001 3° B',
      inquilinos: ['Ana Inquilina'],
      porcentaje: null,
      alquilerVigente: 1_000_000,
      proximaIndexacion: '2027-03-01',
      vence: '2028-02-29',
      meses: [
        {
          periodo: '2026-09',
          alquiler: 1_000_000,
          cobrado: 1_000_000,
          enEspera: 0,
          cobradoEl: ['2026-09-05'],
          liquidaciones: [{ id: L1, numero: 12, fecha: '2026-09-10' }],
        },
      ],
    });
    expect(c2!.meses[0]).toMatchObject({
      cobrado: 0,
      enEspera: 800,
      cobradoEl: [],
      liquidaciones: [],
    });
  });

  it('regla 91: cada descuento con su nombre, y cada grupo suma su renglón', async () => {
    const i = await informe();
    const nombres = i.partidas.map((p) => [
      p.categoria,
      p.nombre,
      p.importe,
      p.liquidacion?.numero ?? null,
    ]);
    expect(nombres).toEqual([
      ['honorarios', 'Honorarios', 96_800, 12],
      ['arreglos', 'Plomero Juan', 50_000, 12],
      ['impuestos', 'TGI (Tasa municipal)', 12_345.67, null],
      ['expensas', 'Expensas extraordinarias', 30_000, null],
    ]);
    expect(i.partidas.find((p) => p.categoria === 'arreglos')!.detalle).toBe(
      'Cambio de canilla · reclamo 7',
    );
    const c = ars(i);
    for (const cat of ['honorarios', 'impuestos', 'expensas', 'arreglos', 'otros'] as const) {
      const suma = i.partidas
        .filter((p) => p.categoria === cat && p.moneda === 'ARS')
        .reduce((s, p) => s + Math.round(p.importe * 100), 0);
      expect(suma / 100, cat).toBe(c[cat]);
    }
  });

  it('regla 92: los reclamos sin notas internas, y el importe solo si fue a cargo del propietario', async () => {
    const { s, llamadas } = servicio(fixture());
    const i = await s.informe(DUENA, SEPT, HOY);
    expect(i.reclamos.map((r) => [r.numero, r.aCargoDelPropietario])).toEqual([
      [7, [{ moneda: 'ARS', importe: 50_000 }]],
      [8, []],
    ]);
    expect(JSON.stringify(i)).not.toContain('NOTA INTERNA');
    // A la base no se le piden las notas, y del gasto solo lo que paga el propietario.
    const args = llamadas.reclamos[0] as { select: Record<string, unknown> };
    expect(args.select).not.toHaveProperty('notas');
    expect(args.select.comprobantes).toEqual({
      where: { aCargoDe: 'propietario', anuladoEn: null },
      select: { importe: true, moneda: true },
    });
  });

  it('regla 93: lo del período de cada liquidación suma lo liquidado', async () => {
    const i = await informe();
    expect(i.liquidaciones).toEqual([
      {
        id: L1,
        numero: 12,
        fecha: '2026-09-10',
        medio: 'transferencia',
        moneda: 'ARS',
        neto: 853_200,
        delPeriodo: 853_200,
      },
    ]);
    expect(i.liquidaciones.reduce((s, l) => s + l.delPeriodo, 0)).toBe(ars(i).liquidado);
  });

  it('regla 94: sin movimientos en el período, el resumen viene vacío, no en ceros', async () => {
    const f = fixture();
    f.conceptos = [];
    f.reclamos = [];
    const i = await servicio(f).s.informe(DUENA, { desde: '2026-05', hasta: '2026-05' }, HOY);
    expect(i.resumen).toEqual([]);
    expect(i.partidas).toEqual([]);
    expect(i.liquidaciones).toEqual([]);
    // Sus contratos se siguen mostrando.
    expect(i.contratos).toHaveLength(2);
  });

  it('regla 83: quien no es propietario de ningún contrato no tiene informe', async () => {
    await expect(servicio(fixture()).s.informe(INQ, SEPT, HOY)).rejects.toThrow(
      'Ana Inquilina no es propietario de ningún contrato.',
    );
    await expect(
      servicio(fixture()).s.informe('99999999-9999-4999-8999-999999999999', SEPT, HOY),
    ).rejects.toThrow(NotFoundException);
  });

  it('regla 96: la fila de cada propietario es el resumen de su informe, con totales por moneda', async () => {
    const t = await servicio(fixture()).s.propietarios(SEPT, HOY);
    expect(t.filas.map((f) => f.persona.nombre)).toEqual(['Dueña', 'Otro']);
    const duena = t.filas[0]!;
    expect(duena).toMatchObject({ contratos: 2, reclamos: 2 });
    expect(duena.monedas).toEqual((await informe()).resumen);
    // El otro dueño cobró la mitad: su inquilina pagó 500.000 de 1.000.000.
    expect(t.totales.map((x) => [x.moneda, x.cobrado])).toEqual([
      ['ARS', 1_250_000],
      ['USD', 0],
    ]);
  });

  it('regla 97: las mismas consultas con 5 o con 25 contratos', async () => {
    const conN = (cuantos: number) => {
      const ids = Array.from(
        { length: cuantos },
        (_, k) => `c${String(k).padStart(3, '0')}-${uuid()}`,
      );
      return {
        contratos: ids.map((id, k) => contrato(id, `ALT-${k}`, k % 2 ? OTRO : DUENA)),
        conceptos: ids.flatMap((id, k) =>
          delContrato(id).map((x) => ({
            ...x,
            personaId: x.personaId === INQ ? INQ : k % 2 ? OTRO : DUENA,
          })),
        ),
        inquilino: ids.map((id) => delInquilino(id, 500_000)),
        reclamos: ids.map((id, k) => reclamo(id, k, [1_000])),
        mora: [],
      };
    };
    const medir = async (cuantos: number) => {
      const uno = servicio(conN(cuantos));
      await uno.s.informe(DUENA, SEPT, HOY);
      const todos = servicio(conN(cuantos));
      await todos.s.propietarios(SEPT, HOY);
      return [uno.consultas.n, todos.consultas.n];
    };
    const [cinco, veinticinco] = [await medir(5), await medir(25)];
    expect(cinco).toEqual(veinticinco);
    expect(cinco[0]).toBeLessThanOrEqual(8);
  });

  it('regla 84: el período es de un año como máximo y en orden', () => {
    expect(
      InformePeriodoQuerySchema.safeParse({ desde: '2026-01', hasta: '2026-12' }).success,
    ).toBe(true);
    expect(
      InformePeriodoQuerySchema.safeParse({ desde: '2026-01', hasta: '2027-01' }).success,
    ).toBe(false);
    expect(
      InformePeriodoQuerySchema.safeParse({ desde: '2026-09', hasta: '2026-08' }).success,
    ).toBe(false);
  });
});
