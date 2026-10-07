import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import {
  INDICADORES_DETALLE_TABLERO,
  type FiltroTipoContrato,
  type Indicador,
  type TableroAlquileresDto,
} from '@vacker/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import type { TenantContext } from '../src/prisma/tenant-context';
import type { IndexacionesService } from '../src/modules/alquileres/indexaciones.service';
import type { LiquidacionesService } from '../src/modules/alquileres/liquidaciones.service';
import { TableroAlquileresService } from '../src/modules/alquileres/tablero-alquileres.service';
import { limpiar, nuevosIds, sembrar } from './aislamiento.fixtures';

/**
 * Regla 79, contra una base de verdad: la lista que se pide al abrir una
 * tarjeta suma exactamente el número que el tablero sumó para ese período.
 *
 * El spec de la unidad lo prueba con una base de mentira que contesta como
 * la de verdad; este corre el SQL real —el de los alquileres, el de la deuda
 * a cada cierre y el de los ingresos— con cobros parciales, cobrados tarde y
 * anulados. Corre en el job de aislamiento de CI, con el Postgres descartable
 * de ese job, por la misma ruta que la API (Prisma, pooler y RLS).
 *
 * NUNCA contra la base productiva: mismo freno que `aislamiento.e2e-spec.ts`.
 */

const URL_POOLER = process.env.TEST_DATABASE_URL;
const URL_DIRECTA = process.env.TEST_DIRECT_URL;
const esProduccion = (url: string) =>
  /supabase\.(com|co|net)/i.test(url) || /pooler\.supabase/i.test(url);
const hayBase = Boolean(URL_POOLER && URL_DIRECTA);
if (hayBase && (esProduccion(URL_POOLER!) || esProduccion(URL_DIRECTA!))) {
  throw new Error(
    'TEST_DATABASE_URL/TEST_DIRECT_URL apuntan a Supabase. Este test escribe y borra: ' +
      'usá una base de pruebas descartable.',
  );
}
const suite = hayBase ? describe : describe.skip;

const HOY = '2026-10-20';
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const TIPOS: FiltroTipoContrato[] = ['todos', 'vivienda', 'comercial'];
const FOTOS: string[] = ['vigentes', 'alquilerMensual', 'mora'];
const FLUJOS = INDICADORES_DETALLE_TABLERO.filter((i) => !FOTOS.includes(i));

/** Lo que la pantalla muestra para un flujo en un período: la suma de sus meses. */
function sumaDeLosMeses(t: TableroAlquileresDto, indicador: string, desde: string, hasta: string) {
  const enRango = (mes: string) => mes >= desde && mes <= hasta;
  const evolucion = t.evolucion.filter((e) => enRango(e.mes) && e.moneda === 'ARS');
  const ingresos = t.ingresos.filter((i) => enRango(i.mes) && i.moneda === 'ARS');
  const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
  switch (indicador) {
    case 'emitidos':
      return sum(evolucion.map((e) => e.emitidos));
    case 'cobrados':
      return sum(evolucion.map((e) => e.cobrados));
    case 'importeEmitido':
      return sum(evolucion.map((e) => e.emitido));
    case 'importeCobrado':
      return sum(evolucion.map((e) => e.cobradoHoy));
    case 'ingresos':
      return sum(ingresos.map((i) => i.honorarios + i.gastos + i.punitorios + i.comisiones));
    default:
      return sum(ingresos.map((i) => i[indicador as 'honorarios']));
  }
}
const sumaDeFilas = (ind: Indicador) =>
  Math.round(ind.filas.reduce((s, f) => s + (f.importe ?? 0), 0) * 100) / 100;

suite('Tablero de Alquileres contra la base (regla 79)', () => {
  let siembra: PrismaClient;
  let prisma: PrismaService;
  let servicio: TableroAlquileresService;
  let tableros: Record<FiltroTipoContrato, TableroAlquileresDto>;
  const ids = nuevosIds(7);

  beforeAll(async () => {
    siembra = new PrismaClient({ datasourceUrl: URL_DIRECTA });
    await siembra.$connect();
    await sembrar(siembra, ids);
    const t = ids.tenant;

    // Dos inquilinos y un propietario, dos contratos: uno vigente de vivienda
    // y uno comercial que terminó en mayo.
    const persona = (nombre: string, documento: string) =>
      siembra.alqPersona.create({ data: { tenantId: t, nombre, documento } });
    const [inq1, inq2, duenio] = await Promise.all([
      persona('Inquilina Uno', '41000001'),
      persona('Inquilino Dos', '41000002'),
      persona('Dueña', '41000003'),
    ]);
    const contrato = async (
      codigo: string,
      datos: { tipo: string; estado: string; inicio: string; fin: string; importe: number },
      inquilino: string,
    ) => {
      const c = await siembra.alqContrato.create({
        data: {
          tenantId: t,
          codigo,
          propiedadId: ids.alqPropiedad,
          tipo: datos.tipo,
          estado: datos.estado,
          inicio: d(datos.inicio),
          fin: d(datos.fin),
        },
      });
      await siembra.alqContratoParte.createMany({
        data: [
          { tenantId: t, contratoId: c.id, personaId: inquilino, papel: 'inquilino' },
          {
            tenantId: t,
            contratoId: c.id,
            personaId: duenio.id,
            papel: 'propietario',
            porcentaje: 100,
          },
        ],
      });
      await siembra.alqTramo.create({
        data: {
          tenantId: t,
          contratoId: c.id,
          numero: 1,
          desde: d(datos.inicio),
          hasta: d(datos.fin),
          importe: datos.importe,
        },
      });
      return c;
    };
    const k1 = await contrato(
      'E2E-1',
      {
        tipo: 'vivienda',
        estado: 'vigente',
        inicio: '2025-01-01',
        fin: '2027-12-31',
        importe: 500_000,
      },
      inq1.id,
    );
    const k2 = await contrato(
      'E2E-2',
      {
        tipo: 'comercial',
        estado: 'finalizado',
        inicio: '2024-06-01',
        fin: '2026-05-31',
        importe: 300_000,
      },
      inq2.id,
    );

    const concepto = (
      contratoId: string,
      personaId: string,
      tipo: string,
      periodo: string,
      vencimiento: string,
      importe: number,
      liquidacionId: string | null = null,
    ) =>
      siembra.alqConcepto.create({
        data: {
          tenantId: t,
          contratoId,
          personaId,
          tipo,
          sentido: tipo === 'honorarios' ? 'a_pagar' : 'a_cobrar',
          periodo,
          vencimiento: d(vencimiento),
          importe,
          liquidacionId,
        },
      });
    const enero = await concepto(k1.id, inq1.id, 'alquiler', '2026-01', '2026-01-05', 500_000);
    const gastosEnero = await concepto(
      k1.id,
      inq1.id,
      'gastos_adm',
      '2026-01',
      '2026-01-05',
      10_000,
    );
    const febrero = await concepto(k1.id, inq1.id, 'alquiler', '2026-02', '2026-02-05', 500_000);
    const febreroB = await concepto(k2.id, inq2.id, 'alquiler', '2026-02', '2026-02-05', 300_000);
    const punitorio = await concepto(k2.id, inq2.id, 'punitorio', '2026-02', '2026-02-20', 3_000);
    const julio = await concepto(k1.id, inq1.id, 'alquiler', '2026-07', '2026-07-05', 500_000);
    const liquidacion = await siembra.alqLiquidacion.create({
      data: {
        tenantId: t,
        numero: 701,
        personaId: duenio.id,
        periodo: '2026-02',
        neto: 1,
        fecha: d('2026-02-10'),
        detalle: {},
      },
    });
    await concepto(k1.id, duenio.id, 'honorarios', '2026-02', '2026-02-10', 25_000, liquidacion.id);

    let numero = 700;
    const cobro = async (
      personaId: string,
      fecha: string,
      imputaciones: [string, number][],
      anulado = false,
    ) => {
      const c = await siembra.alqCobro.create({
        data: {
          tenantId: t,
          numero: ++numero,
          personaId,
          fecha: d(fecha),
          importe: imputaciones.reduce((s, [, x]) => s + x, 0),
          medio: 'transferencia',
          anuladoEn: anulado ? new Date('2026-07-04T12:00:00Z') : null,
        },
      });
      await siembra.alqImputacion.createMany({
        data: imputaciones.map(([conceptoId, importe]) => ({
          tenantId: t,
          cobroId: c.id,
          registradaEnCobroId: c.id,
          conceptoId,
          importe,
        })),
      });
    };
    // Enero, al día. Febrero de la vivienda, en abril: al cierre de febrero
    // no estaba cobrado. Febrero del comercial, en parte. Julio, con un cobro
    // que después se anuló.
    await cobro(inq1.id, '2026-01-04', [
      [enero.id, 500_000],
      [gastosEnero.id, 10_000],
    ]);
    await cobro(inq1.id, '2026-04-10', [[febrero.id, 500_000]]);
    await cobro(inq2.id, '2026-02-20', [
      [febreroB.id, 100_000],
      [punitorio.id, 3_000],
    ]);
    await cobro(inq1.id, '2026-07-03', [[julio.id, 500_000]], true);

    prisma = new PrismaService({ datasourceUrl: URL_POOLER });
    await prisma.$connect();
    const ctx: TenantContext = { tenantId: t, userId: ids.usuario, roles: ['admin_tenant'] };
    const cls = { get: () => ctx } as unknown as ClsService;
    servicio = new TableroAlquileresService(
      new TenantPrismaService(prisma, cls),
      { bandeja: async () => ({ indices: [], tramos: [] }) } as unknown as IndexacionesService,
      { pendientes: async () => [] } as unknown as LiquidacionesService,
    );
    tableros = await servicio.tableros(HOY, 2026);
  }, 60_000);

  afterAll(async () => {
    await limpiar(siembra, [ids]);
    await siembra.$disconnect();
    await prisma?.$disconnect();
  }, 60_000);

  it('los números del período salen de lo cargado', () => {
    const t = tableros.todos;
    const febrero = t.evolucion.find((e) => e.mes === '2026-02')!;
    // Regla 76: hasta hoy se cobraron 600.000; al cierre de febrero, 100.000.
    expect(febrero).toMatchObject({
      emitido: 800_000,
      emitidos: 2,
      cobrados: 1,
      cobradoHoy: 600_000,
      cobrado: 100_000,
    });
    // El cobro anulado de julio no cuenta.
    expect(t.evolucion.find((e) => e.mes === '2026-07')).toMatchObject({ cobradoHoy: 0 });
    expect(sumaDeLosMeses(t, 'ingresos', '2026-01', '2026-03')).toBe(38_000);
    // Regla 77: al 31/03, los dos contratos y la deuda de febrero de los dos.
    const marzo = t.cierres.find((c) => c.mes === '2026-03')!;
    expect(marzo).toMatchObject({ cierre: '2026-03-31', vigentes: 2, vivienda: 1, comercial: 1 });
    expect(marzo.mora[0]).toMatchObject({ valor: 700_000, conceptos: 2, inquilinos: 2 });
    expect(marzo.mora[0]!.tramos.find((x) => x.tramo === '31-60')!.valor).toBe(700_000);
    // A hoy: el vigente, y la deuda de julio (su cobro se anuló) y lo que falta del comercial.
    expect(t.cartera.vigentes.valor).toBe(1);
    expect(t.morosidad[0]!.total.valor).toBe(700_000);
  });

  it.each([
    ['un mes', '2026-02', '2026-02'],
    ['un trimestre', '2026-01', '2026-03'],
    ['el año', '2026-01', '2026-12'],
  ])('cada flujo de %s, en los tres cortes: la lista suma la tarjeta', async (_n, desde, hasta) => {
    for (const tipo of TIPOS)
      for (const indicador of FLUJOS) {
        const ind = await servicio.detalle({ indicador, desde, hasta, tipo, moneda: 'ARS' }, HOY);
        const nombre = `${indicador} ${tipo} ${desde}…${hasta}`;
        expect(ind.valor, nombre).toBe(sumaDeLosMeses(tableros[tipo], indicador, desde, hasta));
        const cuenta = indicador === 'emitidos' || indicador === 'cobrados';
        expect(cuenta ? ind.filas.length : sumaDeFilas(ind), nombre).toBe(ind.valor);
      }
  });

  it.each(['2026-03', '2026-05', '2026-10'])(
    'las fotos al cierre de %s, en los tres cortes: la lista suma la tarjeta',
    async (mes) => {
      for (const tipo of TIPOS) {
        const c = tableros[tipo].cierres.find((x) => x.mes === mes)!;
        const q = { desde: mes, hasta: mes, tipo, moneda: 'ARS' as const };
        const nombre = `${tipo} ${mes}`;
        expect((await servicio.detalle({ ...q, indicador: 'vigentes' }, HOY)).valor, nombre).toBe(
          c.vigentes,
        );
        const alquiler = await servicio.detalle({ ...q, indicador: 'alquilerMensual' }, HOY);
        expect(alquiler.valor, nombre).toBe(c.alquilerMensual[0]?.valor ?? 0);
        expect(sumaDeFilas(alquiler), nombre).toBe(alquiler.valor);
        const deuda = await servicio.detalle({ ...q, indicador: 'mora' }, HOY);
        expect(deuda.valor, nombre).toBe(c.mora[0]?.valor ?? 0);
        expect(sumaDeFilas(deuda), nombre).toBe(deuda.valor);
      }
    },
  );
});
