import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { AlquileresService } from './alquileres.service';

function makeDb(tx: unknown): TenantPrismaService {
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
}

describe('AlquileresService.resumen', () => {
  it('cuenta contratos, vigentes, personas y propiedades dentro del tenant', async () => {
    const count = vi.fn((args?: { where?: { estado?: string } }) =>
      Promise.resolve(args?.where?.estado ? 3 : 5),
    );
    const tx = {
      alqContrato: { count },
      alqPersona: { count: vi.fn().mockResolvedValue(9) },
      alqPropiedad: { count: vi.fn().mockResolvedValue(4) },
    };
    const db = makeDb(tx);
    const r = await new AlquileresService(db).resumen();
    expect(r).toEqual({ contratos: 5, contratosVigentes: 3, personas: 9, propiedades: 4 });
    // Por `withTenant`: las tablas tienen RLS y sin contexto no aíslan.
    expect(db.withTenant).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ where: { estado: 'vigente' } });
  });
});

describe('AlquileresService.configuracion (reglas 99 y 103)', () => {
  const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
  const tx = (config: unknown) => ({
    tenant: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ config }),
      update: vi.fn().mockResolvedValue({}),
    },
  });

  it('una configuración guardada antes del 15/10/2026 se lee traducida, sin tocarla', async () => {
    const t = tx({ logoUrl: null, selladoPct: 1.2, selladoInquilinoPct: 50 });
    const c = await new AlquileresService(makeDb(t)).configuracion(CTX);
    expect(c).toMatchObject({
      selladoViviendaPct: 1.2,
      selladoComercialPct: 1.2,
      selladoComercialMipymePct: 1.2,
      selladoInquilinoPct: 50,
      contratoHonorariosPct: 8,
      contratoGastosAdmPct: 2,
      contratoPunitorioDiarioPct: 0,
      contratoDiaVencimiento: 5,
      contratoDiaPagoPropietario: 10,
      // Regla 133: sin cargar, 5 días.
      diasDiferenciaFinal: 5,
    });
    expect(c).not.toHaveProperty('selladoPct');
    expect(t.tenant.update).not.toHaveBeenCalled();
  });

  it('al guardar, la alícuota única vieja se va y lo que no es del módulo se conserva', async () => {
    const t = tx({ logoUrl: 'https://x.test/logo.png', selladoPct: 1.2 });
    const dto = {
      ivaHonorariosPct: 21,
      comisionInicialPct: 5,
      comisionInicialCuotas: 2,
      comisionInicialConIva: true,
      selladoViviendaPct: 0,
      selladoComercialPct: 1,
      selladoComercialMipymePct: 0.25,
      selladoInquilinoPct: 100,
      depositoGestion: 'entrega_propietario' as const,
      contratoHonorariosPct: 8,
      contratoGastosAdmPct: 2,
      contratoPunitorioDiarioPct: 0.3,
      contratoDiaVencimiento: 5,
      contratoDiaPagoPropietario: 10,
      diasDiferenciaFinal: 7,
    };
    const c = await new AlquileresService(makeDb(t)).guardarConfiguracion(CTX, dto);
    const guardado = t.tenant.update.mock.calls[0]![0].data.config;
    expect(guardado).not.toHaveProperty('selladoPct');
    expect(guardado).toMatchObject({ logoUrl: 'https://x.test/logo.png', ...dto });
    expect(c).toEqual(dto);
  });
});
