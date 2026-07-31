import { describe, expect, it, vi } from 'vitest';
import { TareasService } from './tareas.service';

function makePrisma(tenants: unknown[], usuario: unknown = { id: 'u1' }) {
  return {
    tenant: { findMany: vi.fn().mockResolvedValue(tenants) },
    usuario: { findFirst: vi.fn().mockResolvedValue(usuario) },
  } as never;
}

const TENANT = (nombre: string, protocolo = true) => ({
  id: `id-${nombre}`,
  nombre,
  modulos: { protocolo },
});

describe('TareasService', () => {
  it('saltea las inmobiliarias que no tienen el módulo', async () => {
    const mail = { enviar: vi.fn().mockResolvedValue({ enviado: true, destinatarios: ['a@b.com'] }) };
    const svc = new TareasService(makePrisma([TENANT('Con'), TENANT('Sin', false)]), mail as never);

    const r = await svc.enviarReportesSemanales();

    expect(r.tenants).toBe(1);
    expect(r.detalle[0]?.tenant).toBe('Con');
    expect(mail.enviar).toHaveBeenCalledTimes(1);
  });

  /**
   * Una inmobiliaria que falla NO puede frenar a las demás: si el correo de una
   * tiene algo mal configurado, las otras igual reciben su reporte el lunes.
   */
  it('un error en una inmobiliaria no frena a las siguientes', async () => {
    const mail = {
      enviar: vi
        .fn()
        .mockRejectedValueOnce(new Error('Resend rechazó el envío (403).'))
        .mockResolvedValueOnce({ enviado: true, destinatarios: ['a@b.com'] }),
    };
    const svc = new TareasService(makePrisma([TENANT('Aaa'), TENANT('Bbb')]), mail as never);

    const r = await svc.enviarReportesSemanales();

    expect(r.tenants).toBe(2);
    expect(r.enviados).toBe(1);
    expect(r.detalle[0]).toMatchObject({ tenant: 'Aaa', enviado: false });
    expect(r.detalle[0]?.motivo).toContain('403');
    expect(r.detalle[1]).toMatchObject({ tenant: 'Bbb', enviado: true });
  });

  it('sin un usuario de dirección no intenta mandar, y lo dice', async () => {
    const mail = { enviar: vi.fn() };
    const svc = new TareasService(makePrisma([TENANT('Aaa')], null), mail as never);

    const r = await svc.enviarReportesSemanales();

    expect(mail.enviar).not.toHaveBeenCalled();
    expect(r.detalle[0]?.motivo).toContain('usuario de dirección');
  });

  // "No se mandó" no es un error: si nadie está marcado, la corrida es
  // correcta. Devolverlo como falla haría que el cron se viera rojo todas las
  // semanas y se dejara de mirar.
  it('cuenta como corrida buena aunque no haya destinatarios', async () => {
    const mail = {
      enviar: vi.fn().mockResolvedValue({
        enviado: false,
        destinatarios: [],
        motivo: 'Nadie está marcado para recibir el reporte.',
      }),
    };
    const svc = new TareasService(makePrisma([TENANT('Aaa')]), mail as never);

    const r = await svc.enviarReportesSemanales();

    expect(r.enviados).toBe(0);
    expect(r.detalle[0]?.motivo).toContain('Nadie está marcado');
  });
});
