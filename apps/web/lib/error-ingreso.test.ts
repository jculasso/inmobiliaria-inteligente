import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAJE_CREDENCIALES, MENSAJE_SIN_CONEXION, mensajeDeIngreso } from './error-ingreso';

afterEach(() => vi.restoreAllMocks());

describe('mensajeDeIngreso', () => {
  it('credenciales malas (400 de Supabase) → «Email o clave incorrectos.»', () => {
    expect(mensajeDeIngreso({ name: 'AuthApiError', status: 400 })).toBe(MENSAJE_CREDENCIALES);
  });

  it('sin llegar al servidor → «No hay conexión…», en cualquiera de sus formas', () => {
    expect(mensajeDeIngreso({ name: 'AuthRetryableFetchError', status: 0 })).toBe(
      MENSAJE_SIN_CONEXION,
    );
    expect(mensajeDeIngreso({ name: 'AuthRetryableFetchError' })).toBe(MENSAJE_SIN_CONEXION);
    expect(mensajeDeIngreso({ status: 0 })).toBe(MENSAJE_SIN_CONEXION);
    expect(mensajeDeIngreso(new TypeError('Failed to fetch'))).toBe(MENSAJE_SIN_CONEXION);
  });

  it('con el navegador desconectado, aunque el error no lo diga', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(mensajeDeIngreso({ name: 'AuthApiError', status: 400 })).toBe(MENSAJE_SIN_CONEXION);
  });
});
