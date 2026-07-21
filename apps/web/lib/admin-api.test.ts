import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activarAccesoUsuario,
  createTenant,
  createUsuarioAdmin,
  eliminarFotoUsuario,
  listTenants,
  listUsuariosDeTenant,
  resetPasswordUsuario,
  subirFotoUsuario,
  subirLogoTenant,
} from './admin-api';

const TENANT = {
  id: '11111111-1111-1111-1111-111111111111',
  nombre: 'Vacker',
  slug: 'vacker',
  plan: 'basico',
  estado: 'activo',
  config: {},
  createdAt: '2026-01-01T00:00:00.000Z',
};

const USUARIO = {
  id: '22222222-2222-2222-2222-222222222222',
  nombre: 'Nueva Vendedora',
  email: 'nueva@vacker.test',
  estado: 'activo',
  roles: ['vendedor'],
  tieneAcceso: true,
  fotoUrl: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin-api', () => {
  it('listTenants pide /admin/tenants', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [TENANT] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listTenants('token');

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/admin/tenants');
    expect(result).toEqual([TENANT]);
  });

  it('createTenant hace POST con el body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => TENANT });
    vi.stubGlobal('fetch', fetchMock);

    await createTenant('token', { nombre: 'Vacker', slug: 'vacker', plan: 'basico' });

    const [, options] = fetchMock.mock.calls[0]!;
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ nombre: 'Vacker', slug: 'vacker', plan: 'basico' });
  });

  it('listUsuariosDeTenant pide /admin/tenants/:id/usuarios', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [USUARIO] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listUsuariosDeTenant('token', TENANT.id);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/admin/tenants/${TENANT.id}/usuarios`);
    expect(result).toEqual([USUARIO]);
  });

  it('createUsuarioAdmin manda nombre/email/password/roles', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => USUARIO });
    vi.stubGlobal('fetch', fetchMock);

    await createUsuarioAdmin('token', TENANT.id, {
      nombre: 'Nueva Vendedora',
      email: 'nueva@vacker.test',
      password: 'password123',
      roles: ['vendedor'],
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/admin/tenants/${TENANT.id}/usuarios`);
    expect(JSON.parse(options.body)).toEqual({
      nombre: 'Nueva Vendedora',
      email: 'nueva@vacker.test',
      password: 'password123',
      roles: ['vendedor'],
    });
  });

  it('resetPasswordUsuario pega a /reset-password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: USUARIO.id, ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await resetPasswordUsuario('token', TENANT.id, USUARIO.id, { password: 'nuevaClave123' });

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `http://localhost:3001/admin/tenants/${TENANT.id}/usuarios/${USUARIO.id}/reset-password`,
    );
  });

  it('activarAccesoUsuario pega a /activar-acceso', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => USUARIO });
    vi.stubGlobal('fetch', fetchMock);

    await activarAccesoUsuario('token', TENANT.id, USUARIO.id, { password: 'nuevaClave123' });

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `http://localhost:3001/admin/tenants/${TENANT.id}/usuarios/${USUARIO.id}/activar-acceso`,
    );
  });

  it('subirFotoUsuario hace POST multipart a .../foto', async () => {
    const fotoUrl = 'https://storage.test/usuarios-avatares/foto.jpg';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...USUARIO, fotoUrl }) });
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });
    const result = await subirFotoUsuario('token', TENANT.id, USUARIO.id, file);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/admin/tenants/${TENANT.id}/usuarios/${USUARIO.id}/foto`);
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(result.fotoUrl).toBe(fotoUrl);
  });

  it('eliminarFotoUsuario hace DELETE a .../foto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...USUARIO, fotoUrl: null }) });
    vi.stubGlobal('fetch', fetchMock);

    await eliminarFotoUsuario('token', TENANT.id, USUARIO.id);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/admin/tenants/${TENANT.id}/usuarios/${USUARIO.id}/foto`);
    expect(options.method).toBe('DELETE');
  });

  it('subirLogoTenant hace POST multipart a .../logo', async () => {
    const logoUrl = 'https://storage.test/tenants-logos/logo.png';
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ...TENANT, config: { logoUrl } }) });
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['contenido'], 'logo.png', { type: 'image/png' });
    const result = await subirLogoTenant('token', TENANT.id, file);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/admin/tenants/${TENANT.id}/logo`);
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(result.config.logoUrl).toBe(logoUrl);
  });
});
