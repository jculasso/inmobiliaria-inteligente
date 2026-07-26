import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

/**
 * Prueba de humo de TODOS los modales de la app.
 *
 * No verifica reglas de negocio (eso ya lo hace el test propio de cada uno):
 * verifica que cada modal MONTA y dibuja su encabezado. Existe porque las
 * piezas que comparten —el overlay de `@vacker/ui` y el `Campo` de
 * `form-ui`— se tocan seguido, y un cambio ahí puede romper una pantalla que
 * nadie mira hasta que un vendedor la abre en producción.
 *
 * Si agregás un modal nuevo, sumalo acá.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
vi.mock('../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../lib/tablero-api', () => ({
  listOperaciones: vi.fn().mockResolvedValue([]),
  createOperacion: vi.fn(),
  updateOperacion: vi.fn(),
  deleteOperacion: vi.fn(),
  createVendedor: vi.fn(),
  updateVendedor: vi.fn(),
  desactivarVendedor: vi.fn(),
  setObjetivo: vi.fn(),
}));
vi.mock('../lib/admin-api', () => ({
  crearUsuario: vi.fn(),
  actualizarUsuario: vi.fn(),
  crearTenant: vi.fn(),
  actualizarTenant: vi.fn(),
  activarAcceso: vi.fn(),
  resetPassword: vi.fn(),
  subirFotoUsuario: vi.fn(),
  eliminarFotoUsuario: vi.fn(),
}));
vi.mock('../lib/protocolo-api', () => ({
  iniciarProtocolo: vi.fn(),
  archivarProtocolo: vi.fn(),
  desarchivarProtocolo: vi.fn(),
}));
vi.mock('../lib/tasador-api', () => ({ cambiarEstado: vi.fn(), generarInforme: vi.fn() }));

const { OperacionFormModal } = await import('./tablero/operacion-form-modal');
const { VendedorFormModal } = await import('./tablero/vendedor-form-modal');
const { DetalleDrillModal } = await import('./tablero/detalle-drill-modal');
const { CambiarEstadoModal } = await import('./tasador/cambiar-estado-modal');
const { TasacionesDrillModal } = await import('./tasador/tasaciones-drill-modal');
const { UsuarioAdminFormModal } = await import('./admin/usuario-admin-form-modal');
const { TenantFormModal } = await import('./admin/tenant-form-modal');
const { ActivarAccesoModal } = await import('./admin/activar-acceso-modal');
const { ResetPasswordModal } = await import('./admin/reset-password-modal');
const { IniciarProtocoloModal } = await import('./protocolo/iniciar-protocolo-modal');
const { ArchivarModal } = await import('./protocolo/archivar-modal');

const noop = () => {};

const usuario = {
  id: '22222222-2222-2222-2222-222222222222',
  nombre: 'Ezequiel',
  email: 'ezequiel@vacker.com.ar',
  telefono: null,
  estado: 'activo',
  roles: ['vendedor'],
  tieneAcceso: true,
  debeCambiarPassword: false,
  fotoUrl: null,
} as never;

const tasacion = {
  id: '1',
  cliente: 'Juan Pérez',
  direccion: 'Colón 100',
  estado: 'Presentada',
  exclusividad: null,
  motivoNoCaptada: null,
  tipoPropiedad: 'Departamento',
  agente: { id: 'a', nombre: 'Ana', fotoUrl: null },
  valorRecomendado: 100000,
} as never;

const candidata = {
  tasacionId: '1',
  cliente: 'Juan Pérez',
  direccion: 'Colón 100',
  tipoPropiedad: 'Departamento',
  ciudad: 'Córdoba',
  valorRecomendado: 100000,
  exclusividad: { tipo: 'exclusiva', dias: 30 },
  agente: { id: 'a', nombre: 'Ana', fotoUrl: null },
} as never;

const protocolo = {
  id: 'p1',
  propiedad: { direccion: 'Colón 100', tipoPropiedad: 'Departamento', ciudad: 'Córdoba' },
  estado: 'en_comercializacion',
  precioPublicacion: 100000,
} as never;

/** Cada caso: nombre visible del modal + cómo montarlo. */
const MODALES: [string, () => void][] = [
  ['Nueva venta', () => render(<OperacionFormModal tipo="venta" vendedores={[]} onClose={noop} onSaved={noop} />)],
  ['Nuevo alquiler', () => render(<OperacionFormModal tipo="alquiler" vendedores={[]} onClose={noop} onSaved={noop} />)],
  ['Nuevo vendedor', () => render(<VendedorFormModal vendedores={[]} onClose={noop} onSaved={noop} />)],
  ['Detalle del Tablero', () => render(<DetalleDrillModal titulo="Detalle del Tablero" filtro={{ anio: 2026 }} onClose={noop} />)],
  ['Cambiar estado', () => render(<CambiarEstadoModal tasacion={tasacion} onClose={noop} onSaved={noop} />)],
  ['Detalle del Tasador', () => render(<TasacionesDrillModal titulo="Detalle del Tasador" tasaciones={[]} onClose={noop} />)],
  ['Nuevo usuario', () => render(<UsuarioAdminFormModal tenantId="t" onClose={noop} onSaved={noop} />)],
  ['Nueva inmobiliaria', () => render(<TenantFormModal onClose={noop} onSaved={noop} />)],
  ['Activar acceso', () => render(<ActivarAccesoModal tenantId="t" usuario={usuario} onClose={noop} onSaved={noop} />)],
  ['Restablecer contraseña', () => render(<ResetPasswordModal tenantId="t" usuario={usuario} onClose={noop} onSaved={noop} />)],
  ['Iniciar protocolo', () => render(<IniciarProtocoloModal candidata={candidata} onClose={noop} />)],
  ['Archivar', () => render(<ArchivarModal protocolo={protocolo} onArchivada={noop} onGuardando={noop} onClose={noop} />)],
];

describe('Todos los modales montan sin romperse', () => {
  // `findByRole` y no `getByRole`: alguno carga datos al abrirse, y así se
  // espera a que asiente en vez de avisar que el estado cambió fuera de act().
  it.each(MODALES)('%s', async (_nombre, montar) => {
    montar();
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    // El encabezado compartido: título + botón de cerrar. Si falta, el overlay
    // no se dibujó bien.
    expect(within(dialogo).getByRole('heading')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });
});
