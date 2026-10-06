import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { registrarEventos } from './historial';
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
      const p = (await tx.alqPersona.create({ data: { ...dto, tenantId: ctx.tenantId }, select: CAMPOS })) as PersonaDto;
      await registrarEventos(tx, ctx, { entidad: 'persona', entidadId: p.id, personaId: p.id, accion: 'alta', resumen: `Alta de ${p.nombre}` });
      return p;
    });
  }

  async actualizar(ctx: TenantContext, id: string, dto: Persona): Promise<PersonaDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.alqPersona.findUnique({ where: { id }, select: { id: true } });
      if (!actual) throw new NotFoundException('Persona no encontrada.');
      await this.assertDocumentoLibre(tx, dto.documento, id);
      const p = (await tx.alqPersona.update({ where: { id }, data: dto, select: CAMPOS })) as PersonaDto;
      await registrarEventos(tx, ctx, { entidad: 'persona', entidadId: id, personaId: id, accion: 'edicion', resumen: `Datos de ${p.nombre} editados` });
      return p;
    });
  }

  /**
   * Se borra de verdad solo si no tiene historia: ningún contrato, concepto,
   * cobro, liquidación ni firma (decidido con Javier el 6/10/2026). Si la
   * tiene, la respuesta dice qué, para que se entienda por qué no.
   */
  async borrar(ctx: TenantContext, id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqPersona.findUnique({
        where: { id },
        select: { nombre: true, _count: { select: { partes: true, conceptos: true, cobros: true, liquidaciones: true, firmas: true } } },
      });
      if (!p) throw new NotFoundException('Persona no encontrada.');
      const c = p._count;
      const motivos = [
        c.partes && `${c.partes} ${c.partes === 1 ? 'contrato' : 'contratos'}`,
        c.cobros && `${c.cobros} ${c.cobros === 1 ? 'cobro' : 'cobros'}`,
        c.liquidaciones && `${c.liquidaciones} ${c.liquidaciones === 1 ? 'liquidación' : 'liquidaciones'}`,
        c.conceptos && `${c.conceptos} ${c.conceptos === 1 ? 'concepto' : 'conceptos'}`,
        c.firmas && 'firmas de contratos',
      ].filter(Boolean);
      if (motivos.length) throw new ConflictException(`${p.nombre} no se puede borrar: tiene ${motivos.join(', ')}. Lo que tiene historia queda.`);
      await tx.alqPersona.delete({ where: { id } });
      await registrarEventos(tx, ctx, { entidad: 'persona', entidadId: id, accion: 'borrado', resumen: `${p.nombre} borrada` });
      return { id };
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
