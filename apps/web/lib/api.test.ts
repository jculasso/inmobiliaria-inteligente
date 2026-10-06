import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMe, MeError } from './api';

const PRINCIPAL = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'demo@vacker.com',
  nombre: 'Demo',
  fotoUrl: null,
  tenantId: '22222222-2222-2222-2222-222222222222',
  roles: ['direccion'],
  debeCambiarPassword: false,
  tenant: {
    nombre: 'Vacker',
    plan: 'basico',
    modulos: {
      tablero: true,
      tasador: false,
      todo: false,
      protocolo: false,
      publicacion: false,
      alquileres: false,
    },
    /*
     * `config: {}` entra vacía y sale con el criterio de tasación por defecto:
     * el schema le pone los coeficientes. Que este test lo diga es a propósito
     * — es la garantía de que una inmobiliaria que nunca los configuró calcula
     * como Vacker y no con `undefined`.
     */
    config: {
      coefSemicubierta: 1,
      coefDescubierta: 0.3,
      ivaHonorariosPct: 21,
      comisionInicialPct: 5,
      comisionInicialCuotas: 2,
      comisionInicialConIva: true,
      selladoPct: 0,
      selladoInquilinoPct: 50,
      depositoGestion: 'entrega_propietario',
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getMe', () => {
  it('devuelve el principal cuando la API responde 200 con un body válido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => PRINCIPAL }),
    );

    const result = await getMe('token-123');
    expect(result).toEqual(PRINCIPAL);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/me$/),
      expect.objectContaining({ headers: { Authorization: 'Bearer token-123' } }),
    );
  });

  it('lanza MeError si la API responde con error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(getMe('token-123')).rejects.toBeInstanceOf(MeError);
  });

  // Una inmobiliaria suspendida: la persona tiene que leer el motivo, no «devolvió 403».
  it('el MeError trae el motivo que da la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: 'forbidden', message: 'La inmobiliaria está suspendida.' },
        }),
      }),
    );
    await expect(getMe('token-123')).rejects.toThrow('La inmobiliaria está suspendida.');
  });

  it('lanza MeError si el body no matchea el schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ foo: 'bar' }) }),
    );
    await expect(getMe('token-123')).rejects.toBeInstanceOf(MeError);
  });
});
