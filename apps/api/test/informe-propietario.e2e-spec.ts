import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import type { InformePropietarioDto, InformePropietariosDto } from '@vacker/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import type { TenantContext } from '../src/prisma/tenant-context';
import { InformePropietarioService } from '../src/modules/alquileres/informe-propietario.service';
import { limpiar, nuevosIds, sembrar } from './aislamiento.fixtures';

/**
 * Reglas 86 a 93 contra una base de verdad: el informe al propietario sale
 * de las consultas reales —conceptos con sus imputaciones y su liquidación,
 * los alquileres de la inquilina, los nombres de las boletas y de los
 * comprobantes, los reclamos con lo que costó a cargo del dueño y la deuda a
 * hoy (el mismo SQL del Dashboard)— y la cadena cierra al centavo.
 *
 * Corre en el job de aislamiento de CI, con su Postgres descartable, por la
 * misma ruta que la API (Prisma, pooler y RLS). NUNCA contra la base
 * productiva: mismo freno que `aislamiento.e2e-spec.ts`.
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

const HOY = '2026-10-07';
const SEPT = { desde: '2026-09', hasta: '2026-09' };
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

suite('Informe al propietario contra la base (reglas 86 a 93)', () => {
  let siembra: PrismaClient;
  let prisma: PrismaService;
  let informe: InformePropietarioDto;
  let tabla: InformePropietariosDto;
  let duenaId: string;
  const ids = nuevosIds(8);

  beforeAll(async () => {
    siembra = new PrismaClient({ datasourceUrl: URL_DIRECTA });
    await siembra.$connect();
    await sembrar(siembra, ids);
    const t = ids.tenant;

    const persona = (nombre: string, documento: string) =>
      siembra.alqPersona.create({ data: { tenantId: t, nombre, documento } });
    const [duena, inq] = await Promise.all([
      persona('Marta Propietaria', '42000001'),
      persona('Ana Inquilina', '42000002'),
    ]);
    duenaId = duena.id;
    const k = await siembra.alqContrato.create({
      data: {
        tenantId: t,
        codigo: 'E2E-INF-1',
        propiedadId: ids.alqPropiedad,
        estado: 'vigente',
        inicio: d('2026-03-01'),
        fin: d('2028-02-29'),
      },
    });
    await siembra.alqContratoParte.createMany({
      data: [
        {
          tenantId: t,
          contratoId: k.id,
          personaId: duena.id,
          papel: 'propietario',
          porcentaje: 100,
        },
        { tenantId: t, contratoId: k.id, personaId: inq.id, papel: 'inquilino' },
      ],
    });
    await siembra.alqTramo.create({
      data: {
        tenantId: t,
        contratoId: k.id,
        numero: 1,
        desde: d('2026-03-01'),
        hasta: d('2028-02-29'),
        importe: 1_000_000,
      },
    });

    const liq = await siembra.alqLiquidacion.create({
      data: {
        tenantId: t,
        numero: 812,
        personaId: duena.id,
        periodo: '2026-09',
        neto: 853_200,
        fecha: d('2026-09-10'),
        detalle: {},
      },
    });
    const concepto = (datos: {
      personaId: string;
      tipo: string;
      sentido: 'a_cobrar' | 'a_pagar';
      importe: number;
      clave: string;
      periodo?: string;
      liquidacionId?: string;
    }) =>
      siembra.alqConcepto.create({
        data: {
          tenantId: t,
          contratoId: k.id,
          personaId: datos.personaId,
          tipo: datos.tipo,
          sentido: datos.sentido,
          periodo: datos.periodo ?? '2026-09',
          vencimiento: d(`${datos.periodo ?? '2026-09'}-05`),
          importe: datos.importe,
          claveGeneracion: datos.clave,
          descripcion: `${datos.tipo} ${datos.periodo ?? '2026-09'}`,
          liquidacionId: datos.liquidacionId ?? null,
        },
      });
    const parte = `alq|${k.id}|2026-09|2026-09-01`;
    const alquilerInq = await concepto({
      personaId: inq.id,
      tipo: 'alquiler',
      sentido: 'a_cobrar',
      importe: 1_000_000,
      clave: `${parte}|alquiler|a_cobrar|${inq.id}`,
    });
    // Agosto, sin pagar: es la deuda de hoy (regla 89).
    await concepto({
      personaId: inq.id,
      tipo: 'alquiler',
      sentido: 'a_cobrar',
      importe: 200_000,
      periodo: '2026-08',
      clave: `alq|${k.id}|2026-08|2026-08-01|alquiler|a_cobrar|${inq.id}`,
    });
    await concepto({
      personaId: duena.id,
      tipo: 'alquiler',
      sentido: 'a_pagar',
      importe: 1_000_000,
      clave: `${parte}|alquiler|a_pagar|${duena.id}`,
      liquidacionId: liq.id,
    });
    await concepto({
      personaId: duena.id,
      tipo: 'honorarios',
      sentido: 'a_cobrar',
      importe: 96_800,
      clave: `${parte}|honorarios|a_cobrar|${duena.id}`,
      liquidacionId: liq.id,
    });

    // Las expensas extraordinarias, como un servicio más del catálogo (regla 91).
    const servicio = await siembra.alqServicio.create({
      data: { tenantId: t, nombre: 'Expensas extraordinarias', clase: 'expensa' },
    });
    const cuenta = await siembra.alqCuentaServicio.create({
      data: {
        tenantId: t,
        propiedadId: ids.alqPropiedad,
        servicioId: servicio.id,
        aCargoDe: 'propietario',
        paga: 'inmobiliaria',
      },
    });
    const boleta = await siembra.alqBoleta.create({
      data: {
        tenantId: t,
        cuentaId: cuenta.id,
        contratoId: k.id,
        clave: `cuenta|${cuenta.id}|2026-09|`,
        periodo: '2026-09',
        vencimiento: d('2026-09-15'),
        importe: 30_000,
        aCargoDe: 'propietario',
        paga: 'inmobiliaria',
      },
    });
    await concepto({
      personaId: duena.id,
      tipo: 'expensa',
      sentido: 'a_cobrar',
      importe: 30_000,
      clave: `bol|${boleta.id}|c|${duena.id}`,
    });

    // Un arreglo a cargo del propietario, ya descontado, y otro del inquilino.
    const proveedor = await siembra.alqProveedor.create({
      data: { tenantId: t, nombre: 'Plomería Juan', rubro: 'plomero' },
    });
    const reclamo = (numero: number, asunto: string, creado: string, cerrado?: string) =>
      siembra.alqReclamo.create({
        data: {
          tenantId: t,
          numero,
          asunto,
          contratoId: k.id,
          proveedorId: proveedor.id,
          estado: cerrado ? 'resuelto' : 'en_curso',
          createdAt: new Date(creado),
          cerradoEn: cerrado ? new Date(cerrado) : null,
        },
      });
    const r1 = await reclamo(
      901,
      'Pérdida de agua',
      '2026-09-12T15:00:00Z',
      '2026-09-20T15:00:00Z',
    );
    const r2 = await reclamo(902, 'Persiana trabada', '2026-08-20T15:00:00Z');
    // Resuelto en julio: no es de septiembre.
    await reclamo(903, 'Timbre', '2026-07-01T15:00:00Z', '2026-07-03T15:00:00Z');
    await siembra.alqReclamoNota.create({
      data: { tenantId: t, reclamoId: r2.id, texto: 'NOTA INTERNA: no avisarle al dueño' },
    });
    const comprobante = (reclamoId: string, aCargoDe: string, importe: number) =>
      siembra.alqComprobante.create({
        data: {
          tenantId: t,
          proveedorId: proveedor.id,
          contratoId: k.id,
          reclamoId,
          fecha: d('2026-09-18'),
          descripcion: 'Cambio de canilla',
          importe,
          aCargoDe,
        },
      });
    const delDueno = await comprobante(r1.id, 'propietario', 50_000);
    await comprobante(r2.id, 'inquilino', 9_999);
    await concepto({
      personaId: duena.id,
      tipo: 'reparacion',
      sentido: 'a_cobrar',
      importe: 50_000,
      clave: `prov|${delDueno.id}|${duena.id}`,
      liquidacionId: liq.id,
    });

    // La inquilina pagó septiembre el 5; un cobro anulado no cuenta.
    const cobro = async (numero: number, fecha: string, importe: number, anulado = false) => {
      const c = await siembra.alqCobro.create({
        data: {
          tenantId: t,
          numero,
          personaId: inq.id,
          fecha: d(fecha),
          importe,
          medio: 'transferencia',
          anuladoEn: anulado ? new Date('2026-09-03T12:00:00Z') : null,
        },
      });
      await siembra.alqImputacion.create({
        data: {
          tenantId: t,
          cobroId: c.id,
          registradaEnCobroId: c.id,
          conceptoId: alquilerInq.id,
          importe,
        },
      });
    };
    await cobro(951, '2026-09-02', 1_000_000, true);
    await cobro(952, '2026-09-05', 1_000_000);

    prisma = new PrismaService({ datasourceUrl: URL_POOLER });
    await prisma.$connect();
    const ctx: TenantContext = { tenantId: t, userId: ids.usuario, roles: ['admin_tenant'] };
    const cls = { get: () => ctx } as unknown as ClsService;
    const servicioInforme = new InformePropietarioService(new TenantPrismaService(prisma, cls));
    informe = await servicioInforme.informe(duena.id, SEPT, HOY);
    tabla = await servicioInforme.propietarios(SEPT, HOY);
  }, 60_000);

  afterAll(async () => {
    await limpiar(siembra, [ids]);
    await siembra.$disconnect();
    await prisma?.$disconnect();
  }, 60_000);

  it('regla 87: la cadena sale de lo cargado y cierra al centavo', () => {
    expect(informe.resumen).toEqual([
      {
        moneda: 'ARS',
        alquiler: 1_000_000,
        enEspera: 0,
        cobrado: 1_000_000,
        honorarios: 96_800,
        impuestos: 0,
        expensas: 30_000,
        arreglos: 50_000,
        otros: 0,
        reintegros: 0,
        neto: 823_200,
        liquidado: 853_200,
        pendiente: -30_000,
      },
    ]);
  });

  it('reglas 90 y 93: el mes dice cuándo se cobró y en qué liquidación; lo del período suma lo liquidado', () => {
    expect(informe.contratos[0]!.meses).toEqual([
      expect.objectContaining({
        periodo: '2026-09',
        cobradoEl: ['2026-09-05'],
        liquidaciones: [expect.objectContaining({ numero: 812, fecha: '2026-09-10' })],
      }),
    ]);
    expect(informe.liquidaciones).toEqual([
      expect.objectContaining({ numero: 812, neto: 853_200, delPeriodo: 853_200 }),
    ]);
  });

  it('regla 91: las expensas extraordinarias y el arreglo, con su nombre', () => {
    expect(informe.partidas.map((p) => [p.categoria, p.nombre, p.importe])).toEqual(
      expect.arrayContaining([
        ['honorarios', 'Honorarios', 96_800],
        ['expensas', 'Expensas extraordinarias', 30_000],
        ['arreglos', 'Plomería Juan', 50_000],
      ]),
    );
  });

  it('reglas 85 y 92: reclamos creados o abiertos en el período, sin notas, con importe solo si fue a cargo del propietario', () => {
    expect(informe.reclamos.map((r) => [r.numero, r.estado, r.aCargoDelPropietario])).toEqual([
      [901, 'resuelto', [{ moneda: 'ARS', importe: 50_000 }]],
      [902, 'en_curso', []],
    ]);
    expect(JSON.stringify(informe)).not.toContain('NOTA INTERNA');
  });

  it('regla 89: la deuda vencida a hoy de su inquilina', () => {
    expect(informe.deuda).toEqual([
      {
        moneda: 'ARS',
        total: 200_000,
        contratos: [expect.objectContaining({ codigo: 'E2E-INF-1', importe: 200_000 })],
      },
    ]);
  });

  it('regla 96: su fila en la tabla de propietarios es el resumen de su informe', () => {
    const fila = tabla.filas.find((f) => f.persona.id === duenaId)!;
    expect(fila).toMatchObject({ contratos: 1, reclamos: 2 });
    expect(fila.monedas).toEqual(informe.resumen);
  });
});
