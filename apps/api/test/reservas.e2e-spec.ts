import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { ContratoInputSchema, InventarioInputSchema, ReservaInputSchema } from '@vacker/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import type { TenantContext } from '../src/prisma/tenant-context';
import { CobrosService } from '../src/modules/alquileres/cobros.service';
import { ContratoCompletoService } from '../src/modules/alquileres/contrato-completo.service';
import { ContratosService } from '../src/modules/alquileres/contratos.service';
import { LiquidacionesService } from '../src/modules/alquileres/liquidaciones.service';
import { InventarioService } from '../src/modules/alquileres/inventario.service';
import { ReservasService } from '../src/modules/alquileres/reservas.service';
import { limpiar, nuevosIds, sembrar } from './aislamiento.fixtures';

/**
 * La reserva contra una base de verdad (reglas 153, 156, 157 y 159 a 171): lo
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

suite('Reservas, seña e inventario contra la base (reglas 153 a 171)', () => {
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

    prisma = new PrismaService({ url: URL_POOLER });
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

  /** Una propiedad nueva por prueba: cada una deja su reserva cerrada o convertida. */
  const otraPropiedad = async (direccion: string) =>
    (await siembra.alqPropiedad.create({ data: { tenantId: ids.tenant, direccion } })).id;

  /** Una reserva aprobada, con la seña de U$S 500 cobrada (regla 169). */
  async function aprobadaConSena(propiedadId: string, conDuena = true) {
    const r = await reservas.crear(
      ctx,
      ReservaInputSchema.parse({
        ...entrada(),
        propiedadId,
        partes: [
          { personaId: interesada, papel: 'inquilino' },
          ...(conDuena ? [{ personaId: duena, papel: 'propietario' }] : []),
        ],
      }),
    );
    const cobrada = await reservas.cobrarSena(ctx, r.id, {
      fecha: '2026-10-15',
      medio: 'transferencia',
      personaId: null,
      obs: null,
    });
    await reservas.cambiarEstado(ctx, r.id, { estado: 'en_estudio' });
    await reservas.guardarGarantias(ctx, r.id, [
      {
        tipo: 'caucion',
        personaId: null,
        garante: 'Aseguradora',
        detalle: 'Póliza 1',
        estado: 'aprobada',
        aprobadaEl: '2026-10-16',
        obs: null,
      },
    ]);
    return { r, recibo: cobrada.sena!.recibo! };
  }

  it('regla 169: la seña cobrada es un recibo de verdad, en la cuenta del interesado', async () => {
    const { r, recibo } = await aprobadaConSena(await otraPropiedad('Seña 169'));
    const cobro = await siembra.alqCobro.findUniqueOrThrow({
      where: { id: recibo.id },
      include: { imputaciones: { include: { concepto: true } } },
    });
    expect(cobro).toMatchObject({ personaId: interesada, moneda: 'USD', medio: 'transferencia' });
    expect(cobro.imputaciones.map((i) => [i.concepto.tipo, i.concepto.reservaId])).toEqual([
      ['sena', r.id],
    ]);
    // Una reserva con la seña cobrada no se anula sin anular antes el recibo (regla 172).
    await expect(
      reservas.cambiarEstado(ctx, r.id, { estado: 'anulada', motivo: 'Prueba' }),
    ).rejects.toThrow(/anulalo primero/);
  }, 60_000);

  it('regla 170: al convertir, la seña es el depósito; lo que sobra se le reintegra al inquilino', async () => {
    const propiedadId = await otraPropiedad('Seña 170');
    const { r } = await aprobadaConSena(propiedadId);
    await reservas.cambiarEstado(ctx, r.id, { estado: 'aprobada' });
    const k = await reservas.convertir(
      ctx,
      r.id,
      ContratoInputSchema.parse({
        propiedadId,
        moneda: 'USD',
        inicio: '2026-11-01',
        fin: '2028-10-31',
        ajuste: 'escalonado',
        depositoImporte: 400,
        depositoMoneda: 'USD',
        partes: [
          { personaId: duena, papel: 'propietario' },
          { personaId: interesada, papel: 'inquilino' },
        ],
        tramos: [{ numero: 1, desde: '2026-11-01', hasta: '2028-10-31', importe: 600 }],
      }),
    );
    const completo = new ContratoCompletoService(db);
    const { deposito } = await completo.obtener(ctx, k.id);
    expect(deposito).toMatchObject({ estado: 'cobrado', cobrado: 400, moneda: 'USD' });
    const reintegro = await siembra.alqConcepto.findFirstOrThrow({
      where: { contratoId: k.id, claveGeneracion: { contains: '|excedente|' } },
    });
    expect(Number(reintegro.importe)).toBe(100);
  }, 60_000);

  it('regla 171: si la reserva se cae, la seña va a la próxima liquidación del propietario', async () => {
    const propiedadId = await otraPropiedad('Seña 171');
    const { r } = await aprobadaConSena(propiedadId, false);
    // Sin propietario cargado, cerrar pide uno.
    await expect(
      reservas.cambiarEstado(ctx, r.id, { estado: 'rechazada', motivo: 'Sin garantías' }),
    ).rejects.toThrow(/hace falta el propietario/);
    await reservas.cambiarEstado(ctx, r.id, {
      estado: 'rechazada',
      motivo: 'Sin garantías',
      propietarioId: duena,
    });
    const liquidaciones = new LiquidacionesService(db);
    const prep = await liquidaciones.preparar(duena, 'USD', '2026-10-20');
    expect(prep.aPagar).toEqual([
      expect.objectContaining({ tipo: 'sena', contrato: null, importe: 500 }),
    ]);
  }, 60_000);

  // --- Dos pedidos a la vez (revisión de seguridad del 15/10/2026) ------------------
  //
  // Lo que una base de mentira no puede probar: que el candado de fila de la
  // reserva hace esperar al segundo pedido y que, al seguir, ve lo que dejó el
  // primero. Sin el candado, los dos leían «sin cobrar» y salían dos recibos.

  /** Una reserva nueva, con la seña acordada y sin cobrar, de una propiedad propia. */
  async function reservaNueva(direccion: string) {
    return reservas.crear(
      ctx,
      ReservaInputSchema.parse({
        ...entrada(),
        propiedadId: await otraPropiedad(direccion),
        partes: [{ personaId: interesada, papel: 'inquilino' }],
      }),
    );
  }
  const PAGO = {
    fecha: '2026-10-15',
    medio: 'transferencia' as const,
    personaId: null,
    obs: null,
  };
  /** Los recibos vigentes de la seña de una reserva. */
  const recibosDeLaSena = (reservaId: string) =>
    siembra.alqConcepto.count({
      where: { reservaId, tipo: 'sena', sentido: 'a_cobrar', anuladoEn: null },
    });

  it('regla 169: tres cobros de la misma seña a la vez dan un solo recibo', async () => {
    const r = await reservaNueva('Seña simultánea');
    const intentos = await Promise.allSettled(
      Array.from({ length: 3 }, () => reservas.cobrarSena(ctx, r.id, PAGO)),
    );
    expect(intentos.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    for (const x of intentos.filter((y) => y.status === 'rejected'))
      expect(String((x as PromiseRejectedResult).reason)).toMatch(/La seña ya se cobró/);
    expect(await recibosDeLaSena(r.id)).toBe(1);
  }, 60_000);

  it('regla 155: aprobar y rechazar a la vez, se aplica uno solo', async () => {
    const r = await reservaNueva('Aprobar y rechazar');
    await reservas.cambiarEstado(ctx, r.id, { estado: 'en_estudio' });
    await reservas.guardarGarantias(ctx, r.id, [
      {
        tipo: 'caucion',
        personaId: null,
        garante: 'Aseguradora',
        detalle: null,
        estado: 'aprobada',
        aprobadaEl: '2026-10-16',
        obs: null,
      },
    ]);
    const [aprobar, rechazar] = await Promise.allSettled([
      reservas.cambiarEstado(ctx, r.id, { estado: 'aprobada' }),
      reservas.cambiarEstado(ctx, r.id, { estado: 'rechazada', motivo: 'Prueba simultánea' }),
    ]);
    expect([aprobar!.status, rechazar!.status].sort()).toEqual(['fulfilled', 'rejected']);
    const final = await reservas.obtener(r.id);
    expect(final.estado).toBe(aprobar!.status === 'fulfilled' ? 'aprobada' : 'rechazada');
    // Un solo paso en la línea de tiempo, el que se aplicó.
    expect(
      await siembra.alqEvento.count({
        where: { entidad: 'reserva', entidadId: r.id, accion: { in: ['estado', 'anulacion'] } },
      }),
    ).toBe(2); // en estudio + el que ganó
  }, 60_000);

  it('regla 172: anular mientras se cobra la seña nunca deja una reserva anulada con recibo', async () => {
    const r = await reservaNueva('Anular y cobrar');
    await Promise.allSettled([
      reservas.cobrarSena(ctx, r.id, PAGO),
      reservas.cambiarEstado(ctx, r.id, { estado: 'anulada', motivo: 'Prueba simultánea' }),
    ]);
    const final = await reservas.obtener(r.id);
    const recibos = await recibosDeLaSena(r.id);
    // Uno de los dos, nunca los dos: anulada sin recibo, o abierta con su recibo.
    expect(
      (final.estado === 'anulada' && recibos === 0) ||
        (final.estado === 'reservada' && recibos === 1),
    ).toBe(true);
  }, 60_000);

  it('regla 171: anular el recibo de la seña mientras se rechaza la reserva no deja viva la retenida', async () => {
    const r = await reservaNueva('Anular recibo y rechazar');
    const { sena } = await reservas.cobrarSena(ctx, r.id, PAGO);
    await reservas.cambiarEstado(ctx, r.id, { estado: 'en_estudio' });
    const cobros = new CobrosService(db);
    const [anular, rechazar] = await Promise.allSettled([
      cobros.anular(ctx, sena!.recibo!.id, 'Prueba simultánea'),
      reservas.cambiarEstado(ctx, r.id, {
        estado: 'rechazada',
        motivo: 'Prueba simultánea',
        propietarioId: duena,
      }),
    ]);
    // Los dos se aplican, en el orden que sea: no se contradicen.
    expect([anular!.status, rechazar!.status]).toEqual(['fulfilled', 'fulfilled']);
    expect((await reservas.obtener(r.id)).estado).toBe('rechazada');
    // Con el recibo anulado, nada de lo que nació con él puede seguir vivo:
    // ni la seña ni la retenida para el propietario.
    expect(
      await siembra.alqConcepto.count({ where: { cobroId: sena!.recibo!.id, anuladoEn: null } }),
    ).toBe(0);
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
