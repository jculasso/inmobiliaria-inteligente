import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { ContratoInputSchema, InventarioInputSchema, ReservaInputSchema } from '@vacker/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import type { TenantContext } from '../src/prisma/tenant-context';
import { ContratosService } from '../src/modules/alquileres/contratos.service';
import { InventarioService } from '../src/modules/alquileres/inventario.service';
import { ReservasService } from '../src/modules/alquileres/reservas.service';
import { limpiar, nuevosIds, sembrar } from './aislamiento.fixtures';

/**
 * La reserva contra una base de verdad (reglas 153, 156, 157, 159 y 160): lo
 * que una base de mentira no puede probar —el índice único PARCIAL de «una
 * reserva abierta por propiedad», el CHECK de la garantía que es de un
 * contrato o de una reserva, y que convertir sea una sola transacción—.
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

suite('Reservas e inventario contra la base (reglas 153 a 160)', () => {
  let siembra: PrismaClient;
  let prisma: PrismaService;
  let db: TenantPrismaService;
  let reservas: ReservasService;
  let contratos: ContratosService;
  let ctx: TenantContext;
  let duena: string;
  let interesada: string;
  let garante: string;
  const ids = nuevosIds(9);

  beforeAll(async () => {
    siembra = new PrismaClient({ datasourceUrl: URL_DIRECTA });
    await siembra.$connect();
    await sembrar(siembra, ids);
    const t = ids.tenant;
    const persona = (nombre: string, documento: string) =>
      siembra.alqPersona.create({ data: { tenantId: t, nombre, documento } });
    [duena, interesada, garante] = (
      await Promise.all([
        persona('Marta Propietaria', '43000001'),
        persona('Ana Interesada', '43000002'),
        persona('Carlos Garante', '43000003'),
      ])
    ).map((p) => p.id) as [string, string, string];

    prisma = new PrismaService({ datasourceUrl: URL_POOLER });
    await prisma.$connect();
    ctx = { tenantId: t, userId: ids.usuario, roles: ['admin_tenant'] };
    const cls = { get: () => ctx } as unknown as ClsService;
    db = new TenantPrismaService(prisma, cls);
    contratos = new ContratosService(db);
    reservas = new ReservasService(db, contratos);
  }, 60_000);

  afterAll(async () => {
    await limpiar(siembra, [ids]);
    await siembra.$disconnect();
    await prisma?.$disconnect();
  }, 60_000);

  const entrada = () =>
    ReservaInputSchema.parse({
      propiedadId: ids.alqPropiedad,
      fecha: '2026-10-15',
      vence: '2026-10-22',
      partes: [
        { personaId: interesada, papel: 'inquilino' },
        { personaId: duena, papel: 'propietario' },
        { personaId: garante, papel: 'garante' },
      ],
      senaImporte: 500,
      senaMoneda: 'USD',
      alquilerInicial: 600_000,
      inicio: '2026-11-01',
      duracionMeses: 24,
      indice: 'ICL',
      periodicidadMeses: 3,
    });

  it('regla 156: la base no deja dos reservas abiertas para la misma propiedad', async () => {
    const r = await reservas.crear(ctx, entrada());
    // El servicio lo dice con nombre y número…
    await expect(reservas.crear(ctx, entrada())).rejects.toThrow(/ya tiene abierta la reserva/);
    // …y aunque el código se saltee esa revisión, el índice parcial lo frena.
    await expect(
      db.withTenant(
        (tx) =>
          tx.alqReserva.create({
            data: {
              tenantId: ids.tenant,
              numero: 9_999,
              propiedadId: ids.alqPropiedad,
              fecha: new Date('2026-10-15'),
              vence: new Date('2026-10-22'),
            },
          }),
        ctx,
      ),
    ).rejects.toThrow();
    // Anulada, ya no ocupa la propiedad.
    await reservas.cambiarEstado(ctx, r.id, {
      estado: 'anulada',
      motivo: 'Prueba de la regla 156',
    });
    const otra = await reservas.crear(ctx, entrada());
    expect(otra.numero).toBe(r.numero + 1);
    await reservas.cambiarEstado(ctx, otra.id, { estado: 'anulada', motivo: 'Fin de la prueba' });
  });

  it('regla 157: una garantía es de un contrato o de una reserva, nunca de ninguno', async () => {
    await expect(
      db.withTenant(
        (tx) => tx.alqGarantia.create({ data: { tenantId: ids.tenant, tipo: 'otra' } }),
        ctx,
      ),
    ).rejects.toThrow();
  });

  it('reglas 159 y 160: convertir crea el contrato, cierra la reserva y copia las garantías; borrarlo la devuelve', async () => {
    const r = await reservas.crear(ctx, entrada());
    await reservas.cambiarEstado(ctx, r.id, { estado: 'en_estudio' });
    await reservas.guardarGarantias(ctx, r.id, [
      {
        tipo: 'propietaria',
        personaId: garante,
        garante: null,
        detalle: 'Mendoza 900',
        estado: 'aprobada',
        aprobadaEl: '2026-10-16',
        obs: null,
      },
      {
        tipo: 'laboral',
        personaId: null,
        garante: 'Otro garante',
        detalle: null,
        estado: 'rechazada',
        aprobadaEl: null,
        obs: 'Sin recibos',
      },
    ]);
    await reservas.cambiarEstado(ctx, r.id, { estado: 'aprobada' });

    const dto = ContratoInputSchema.parse({
      propiedadId: ids.alqPropiedad,
      inicio: '2026-11-01',
      fin: '2028-10-31',
      indice: 'ICL',
      periodicidadMeses: 3,
      partes: [
        { personaId: duena, papel: 'propietario' },
        { personaId: interesada, papel: 'inquilino' },
        { personaId: garante, papel: 'garante' },
      ],
      tramos: [{ numero: 1, desde: '2026-11-01', hasta: '2028-10-31', importe: 600_000 }],
    });
    const k = await reservas.convertir(ctx, r.id, dto);
    expect(k.estado).toBe('borrador');

    const despues = await reservas.obtener(r.id);
    expect(despues.estado).toBe('convertida');
    expect(despues.contrato).toEqual({ id: k.id, codigo: k.codigo });
    // Las dos de la reserva siguen; al contrato pasó solo la aprobada, copiada.
    expect(despues.garantias).toHaveLength(2);
    const delContrato = await siembra.alqGarantia.findMany({ where: { contratoId: k.id } });
    expect(delContrato.map((g) => [g.estado, g.reservaId])).toEqual([['aprobada', null]]);
    expect(await reservas.delContrato(k.id)).toMatchObject({
      reserva: { id: r.id, sena: { importe: 500, moneda: 'USD', recibida: false } },
    });

    // Convertirla de nuevo no se puede, y no deja un segundo contrato.
    const antes = await siembra.alqContrato.count({ where: { tenantId: ids.tenant } });
    await expect(reservas.convertir(ctx, r.id, dto)).rejects.toThrow(/solo una aprobada/);
    expect(await siembra.alqContrato.count({ where: { tenantId: ids.tenant } })).toBe(antes);

    // Regla 160: se borra el borrador y la reserva vuelve a aprobada, sin contrato.
    await contratos.borrar(ctx, k.id);
    const vuelta = await reservas.obtener(r.id);
    expect(vuelta.estado).toBe('aprobada');
    expect(vuelta.contrato).toBeNull();
    await reservas.cambiarEstado(ctx, r.id, { estado: 'anulada', motivo: 'Fin de la prueba' });
  }, 60_000);

  it('regla 153: un contrato viejo tiene el inventario vacío; se guarda y se lee entero', async () => {
    const inventario = new InventarioService(db);
    // El contrato de la siembra está en borrador: vacío, y se puede editar.
    expect(await inventario.obtener(ids.alqContrato)).toEqual({
      items: [],
      observaciones: null,
      editable: true,
    });
    const k = await siembra.alqContrato.create({
      data: {
        tenantId: ids.tenant,
        codigo: 'E2E-INV-1',
        propiedadId: ids.alqPropiedad,
        estado: 'vigente',
        inicio: new Date('2026-03-01'),
        fin: new Date('2028-02-29'),
      },
    });
    await inventario.guardar(
      ctx,
      k.id,
      InventarioInputSchema.parse({
        items: [{ descripcion: 'Heladera', cantidad: 1, estado: 'Funcionando' }],
        observaciones: 'Con llave del portón.',
      }),
    );
    expect(await inventario.obtener(k.id)).toEqual({
      items: [{ descripcion: 'Heladera', cantidad: 1, estado: 'Funcionando' }],
      observaciones: 'Con llave del portón.',
      editable: true,
    });
  });
});
