import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../../prisma/tenant-context';
import { generarReporteSemanal } from '../reporte-semanal';
import { hoyArgentina } from '../protocolo.calc';
import { ReporteSemanalMailService } from './reporte-semanal-mail.service';

vi.mock('../../../common/resend.client', () => ({
  MailError: class extends Error {},
  enviarMail: vi.fn().mockResolvedValue({ id: 'mail-1' }),
}));

const CTX: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['admin_tenant'] };

function reporteConUnaActiva() {
  return generarReporteSemanal([
    {
      id: 'p1',
      direccion: 'Calle 1',
      fotoUrl: null,
      precio: 100_000,
      moneda: 'USD',
      estado: 'activa',
      fechaInicio: hoyArgentina(),
      vencimientoAutorizacion: null,
      actualizadoEn: hoyArgentina(),
      consultas: 0,
      visitas: 0,
      acciones: [],
      agente: { id: 'u1', nombre: 'Ana' },
    },
  ]);
}

describe('Reporte semanal por mail', () => {
  // El PDF adjunto volvía a correr el reporte entero y a leer la inmobiliaria:
  // dos veces lo mismo por cada inmobiliaria, en el mismo cron.
  it('el reporte se calcula UNA vez y el PDF recibe el que ya está hecho', async () => {
    const tenant = { id: 't1', nombre: 'Alteva', config: { colorPrimario: '#0B5FA5' } };
    const tx = {
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue(tenant) },
      usuario: {
        findMany: vi.fn().mockResolvedValue([{ nombre: 'Ana', email: 'ana@alteva.com' }]),
      },
    };
    const db = { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
    const reporte = reporteConUnaActiva();
    const protocolos = { reporteSemanal: vi.fn().mockResolvedValue(reporte) };
    const pdf = {
      generar: vi.fn().mockResolvedValue({ buffer: Buffer.from('%PDF'), nombreArchivo: 'r' }),
    };
    const config = { get: () => 'clave' };
    const svc = new ReporteSemanalMailService(
      db as never,
      config as never,
      protocolos as never,
      pdf as never,
    );

    const r = await svc.enviar(CTX);

    expect(r.enviado).toBe(true);
    expect(protocolos.reporteSemanal).toHaveBeenCalledTimes(1);
    // Ni el mail ni el PDF muestran fotos: no se firman.
    expect(protocolos.reporteSemanal).toHaveBeenCalledWith(CTX, { firmarFotos: false });
    expect(pdf.generar).toHaveBeenCalledWith(CTX, { reporte, tenant });
    expect(tx.tenant.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });
});
