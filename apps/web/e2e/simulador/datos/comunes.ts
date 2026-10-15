import type { z } from 'zod';
import type { AuthPrincipalSchema } from '@vacker/types';
import { TENANT_ID, USUARIO } from '../identidad';

/**
 * El «hoy» de los datos de prueba. Fijo, para que una prueba no cambie de
 * resultado según el día en que corre: el tablero, los vencimientos y el
 * cierre «al 30/09/2026» se calculan contra esta fecha, no contra el reloj.
 */
export const HOY = '2026-10-15';

/** Identificadores fijos: las pruebas navegan a ellos por URL. */
export const IDS = {
  contrato: '0e2e0000-0000-4000-8000-00000000c001',
  contrato2: '0e2e0000-0000-4000-8000-00000000c002',
  propiedad: '0e2e0000-0000-4000-8000-00000000b001',
  propiedad2: '0e2e0000-0000-4000-8000-00000000b002',
  propietario: '0e2e0000-0000-4000-8000-00000000a001',
  inquilino: '0e2e0000-0000-4000-8000-00000000a002',
  inquilino2: '0e2e0000-0000-4000-8000-00000000a003',
  tramo: '0e2e0000-0000-4000-8000-00000000d001',
  tramo2: '0e2e0000-0000-4000-8000-00000000d002',
  tramo3: '0e2e0000-0000-4000-8000-00000000d003',
  reserva: '0e2e0000-0000-4000-8000-00000000e001',
  reserva2: '0e2e0000-0000-4000-8000-00000000e002',
  reserva3: '0e2e0000-0000-4000-8000-00000000e003',
} as const;

export const PRINCIPAL: z.input<typeof AuthPrincipalSchema> = {
  userId: USUARIO.id,
  email: USUARIO.email,
  nombre: USUARIO.nombre,
  fotoUrl: null,
  tenantId: TENANT_ID,
  roles: ['direccion', 'admin_tenant'],
  debeCambiarPassword: false,
  tenant: {
    nombre: 'Inmobiliaria de Prueba',
    plan: 'profesional',
    modulos: {
      tablero: true,
      tasador: false,
      todo: false,
      protocolo: false,
      publicacion: false,
      alquileres: true,
    },
    config: {},
  },
};
