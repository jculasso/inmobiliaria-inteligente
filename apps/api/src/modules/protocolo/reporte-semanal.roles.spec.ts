import 'reflect-metadata';
import { ROLES_REPORTE_PROTOCOLO, type Rol } from '@vacker/types';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../auth/decorators';
import { ProtocolosController } from './protocolos.controller';

/**
 * El reporte a demanda es información de conducción: quién puede pedirlo NO es
 * lo mismo que quién puede usar el módulo.
 *
 * Los roles de la API tienen que ser exactamente los que use el front. Con
 * `ROLES_PUBLICACION` las dos listas se escribieron por separado, se
 * separaron, y la API devolvía 403 que el borde de error mostraba como "no
 * pudimos conectar con el servidor". Este test evita la repetición de esa
 * historia.
 */
describe('RBAC del reporte semanal', () => {
  it('usa exactamente ROLES_REPORTE_PROTOCOLO, la lista compartida', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ProtocolosController.prototype.reporteSemanal,
    ) as Rol[];

    expect([...roles].sort()).toEqual([...ROLES_REPORTE_PROTOCOLO].sort());
  });

  // El vendedor y el team leader ven sus propias alertas en el dashboard del
  // módulo. El reporte completo de la inmobiliaria es otra cosa: se habilitará
  // con su propio alcance cuando se decida, no de arrastre.
  it('no lo abre para vendedor ni team leader', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ProtocolosController.prototype.reporteSemanal,
    ) as Rol[];

    expect(roles).not.toContain('vendedor');
    expect(roles).not.toContain('team_leader');
  });
});
