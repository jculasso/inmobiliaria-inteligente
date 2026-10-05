import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LIMITE_LISTA_CON_SONDA, type Persona, type PersonaDto } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const CAMPOS = {
  id: true,
  tipo: true,
  nombre: true,
  documento: true,
  email: true,
  telefono: true,
  domicilio: true,
  obs: true,
} as const;

/**
 * Propietarios, inquilinos y garantes. El papel no vive acá sino en cada
 * contrato: una misma persona puede ser propietaria de uno e inquilina de otro.
 */
@Injectable()
export class PersonasService {
  constructor(private readonly db: TenantPrismaService) {}

  /**
   * Todas, ordenadas por nombre. La búsqueda la hace la pantalla sobre esta
   * lista: Vacker tiene 150 personas, y filtrar en memoria es instantáneo y no
   * cuesta una ida y vuelta por cada letra. Se pide una fila de más que el
   * tope para que la pantalla avise si quedó algo afuera.
   */
  async listar(): Promise<PersonaDto[]> {
    return this.db.withTenant((tx) =>
      tx.alqPersona.findMany({ select: CAMPOS, orderBy: { nombre: 'asc' }, take: LIMITE_LISTA_CON_SONDA }),
    ) as Promise<PersonaDto[]>;
  }

  async crear(ctx: TenantContext, dto: Persona): Promise<PersonaDto> {
    return this.db.withTenant(async (tx) => {
      await this.assertDocumentoLibre(tx, dto.documento);
      return tx.alqPersona.create({ data: { ...dto, tenantId: ctx.tenantId }, select: CAMPOS }) as Promise<PersonaDto>;
    });
  }

  async actualizar(id: string, dto: Persona): Promise<PersonaDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.alqPersona.findUnique({ where: { id }, select: { id: true } });
      if (!actual) throw new NotFoundException('Persona no encontrada.');
      await this.assertDocumentoLibre(tx, dto.documento, id);
      return tx.alqPersona.update({ where: { id }, data: dto, select: CAMPOS }) as Promise<PersonaDto>;
    });
  }

  /**
   * El documento es único por inmobiliaria (lo garantiza la base). Se chequea
   * antes para devolver un mensaje que sirva —con el nombre de quien ya lo
   * tiene— en vez del genérico «ya existe un registro con esos datos».
   */
  private async assertDocumentoLibre(tx: Tx, documento: string | null, exceptoId?: string) {
    if (!documento) return;
    const otra = await tx.alqPersona.findFirst({
      where: { documento, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
      select: { nombre: true },
    });
    if (otra) throw new ConflictException(`Ya hay una persona cargada con ese documento: ${otra.nombre}.`);
  }
}
