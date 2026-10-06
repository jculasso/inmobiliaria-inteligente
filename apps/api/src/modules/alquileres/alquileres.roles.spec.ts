import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_ADMINISTRACION_ALQUILERES, type ModuloKey, type Rol } from '@vacker/types';
import { MODULO_KEY, ROLES_KEY } from '../../auth/decorators';
import { AlquileresController } from './alquileres.controller';
import { PersonasController } from './personas.controller';
import { PropiedadesAlquilerController } from './propiedades.controller';
import { ContratosController } from './contratos.controller';
import { IndexacionesController } from './indexaciones.controller';
import { ConceptosController } from './conceptos.controller';
import { CobrosController } from './cobros.controller';

/**
 * Spec alquileres-fase-1.md §3: el módulo se contrata por inmobiliaria Y pide
 * uno de tres roles. Las dos llaves son independientes.
 *
 * Los handlers no se enumeran a mano: se recorren todos los métodos de cada
 * controller. Un endpoint nuevo que se olvide el `@Roles` hace fallar esto,
 * en vez de quedar abierto para cualquier usuario de la inmobiliaria.
 */
const CONTROLLERS = [AlquileresController, PersonasController, PropiedadesAlquilerController, ContratosController, IndexacionesController, ConceptosController, CobrosController];

const handlers = CONTROLLERS.flatMap((C) =>
  Object.getOwnPropertyNames(C.prototype)
    .filter((m) => m !== 'constructor')
    .map((m) => [`${C.name}.${m}`, C, m] as const),
);

describe('RBAC del módulo Alquileres', () => {
  it('el test efectivamente encontró los endpoints', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(25);
  });

  it.each(CONTROLLERS.map((C) => [C.name, C] as const))('%s exige tener contratado el módulo', (_n, C) => {
    expect(Reflect.getMetadata(MODULO_KEY, C) as ModuloKey).toBe('alquileres');
  });

  it.each(handlers)('%s usa exactamente ROLES_ADMINISTRACION_ALQUILERES', (_n, C, metodo) => {
    const roles = Reflect.getMetadata(ROLES_KEY, (C.prototype as unknown as Record<string, object>)[metodo]!) as Rol[] | undefined;
    expect([...(roles ?? [])].sort()).toEqual([...ROLES_ADMINISTRACION_ALQUILERES].sort());
  });
});
