import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProtocoloDto } from '@vacker/types';
import { updateAccion } from './protocolo-api';

vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
afterEach(() => vi.unstubAllGlobals());

const ID = {
  a1: '11111111-1111-4111-8111-111111111111',
  a2: '22222222-2222-4222-8222-222222222222',
} as const;
const accion = (clave: 'a1' | 'a2', estado: 'pendiente' | 'realizada') => ({
  id: ID[clave],
  semana: 1,
  orden: 0,
  clave,
  titulo: `Acción ${clave}`,
  estado,
  fechaPrevista: '2026-07-07',
  fechaRealizada: estado === 'realizada' ? '2026-07-06' : null,
  observaciones: null,
  resultado: null,
  evidencia: null,
});
const ACTUAL = {
  id: 'p1',
  version: 'v1',
  avance: 0,
  semanaActual: 1,
  alertas: [],
  proximaAccion: 'Acción a1',
  propietarioNombre: 'Juan',
  acciones: [accion('a1', 'pendiente'), accion('a2', 'pendiente')],
} as unknown as ProtocoloDto;

const responder = (cuerpo: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => cuerpo }));

// Revisión de performance del 6/10/2026: cada tilde traía la ficha entera con sus 29 acciones.
describe('updateAccion (tilde liviano)', () => {
  it('pide la respuesta liviana y la aplica sobre la ficha que ya se tiene', async () => {
    responder({
      accion: accion('a1', 'realizada'),
      version: 'v2',
      avance: 50,
      semanaActual: 1,
      alertas: [],
      proximaAccion: 'Acción a2',
    });
    const r = await updateAccion('token', ACTUAL, ID.a1, { estado: 'realizada' });
    const [url] = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(String(url)).toContain(`/protocolo/p1/acciones/${ID.a1}?liviana=1`);
    expect(r.version).toBe('v2');
    expect(r.avance).toBe(50);
    expect(r.acciones.map((a) => a.estado)).toEqual(['realizada', 'pendiente']);
    // Lo que la respuesta liviana no trae queda como estaba.
    expect(r.propietarioNombre).toBe('Juan');
  });
});
