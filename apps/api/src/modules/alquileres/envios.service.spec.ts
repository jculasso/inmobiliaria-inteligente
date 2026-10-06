import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { CobrosService } from './cobros.service';
import type { LiquidacionesService } from './liquidaciones.service';
import type { ReciboService } from './recibo.service';
import { mocksDeHistorial } from './historial.testing';

const enviarMail = vi.fn();
vi.mock('../../common/resend.client', async (original) => ({ ...(await original<object>()), enviarMail: (...a: unknown[]) => enviarMail(...a) }));

import { MailError } from '../../common/resend.client';
import { EnviosService } from './envios.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const cobro = (over: Record<string, unknown> = {}) => ({ id: 'c1', numero: 124, persona: { id: 'p1', nombre: 'Ana Inquilina' }, fecha: '2026-10-06', moneda: 'ARS', importe: 400_000, anulado: null, ...over });

function armar(over: { cobro?: unknown } = {}) {
  const tx = {
    ...mocksDeHistorial(),
    tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva Propiedades' }) },
  };
  tx.usuario.findUnique = vi.fn().mockResolvedValue({ nombre: 'Lucía Operadora', email: 'lucia@alteva.com' });
  const db = { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
  const config = { get: vi.fn().mockReturnValue('re_clave') } as unknown as ConfigService;
  const pdfs = { generar: vi.fn().mockResolvedValue({ buffer: Buffer.from('%PDF'), nombreArchivo: 'Recibo-000124' }) } as unknown as ReciboService;
  const cobros = { obtener: vi.fn().mockResolvedValue(over.cobro ?? cobro()) } as unknown as CobrosService;
  return { tx, servicio: new EnviosService(db, config, pdfs, cobros, {} as LiquidacionesService) };
}

beforeEach(() => enviarMail.mockReset());

describe('EnviosService (punto 14: recibos y liquidaciones por mail)', () => {
  it('manda el recibo con el PDF, a nombre de la inmobiliaria, y responde al operador', async () => {
    enviarMail.mockResolvedValueOnce({ id: 'm1' });
    const { tx, servicio } = armar();
    expect(await servicio.recibo(CTX, 'c1', ['ana@mail.com'])).toEqual({ enviado: true, para: ['ana@mail.com'] });
    const [mail, clave] = enviarMail.mock.calls[0]!;
    expect(clave).toBe('re_clave');
    expect(mail).toMatchObject({
      de: 'Alteva Propiedades <alteva-propiedades@avisos.inmobiliariainteligente.net>',
      para: ['ana@mail.com'],
      responderA: 'lucia@alteva.com',
      asunto: 'Recibo 000124 · Alteva Propiedades',
      adjuntos: [{ nombre: 'Recibo-000124.pdf' }],
    });
    expect(mail.texto).toContain('$ 400.000,00');
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({ accion: 'envio', entidad: 'cobro', resumen: 'Recibo 000124 enviado a ana@mail.com' });
  });

  it('un recibo anulado no se manda', async () => {
    const { servicio } = armar({ cobro: cobro({ anulado: { en: 'x', motivo: 'error', por: null } }) });
    await expect(servicio.recibo(CTX, 'c1', ['ana@mail.com'])).rejects.toThrow(BadRequestException);
    expect(enviarMail).not.toHaveBeenCalled();
  });

  it('si Resend lo rechaza, el error se ve y no queda en el historial', async () => {
    enviarMail.mockRejectedValueOnce(new MailError('Falta configurar RESEND_API_KEY en el servidor.'));
    const { tx, servicio } = armar();
    await expect(servicio.recibo(CTX, 'c1', ['ana@mail.com'])).rejects.toThrow('Falta configurar RESEND_API_KEY');
    expect(tx.alqEvento.createMany).not.toHaveBeenCalled();
  });
});
