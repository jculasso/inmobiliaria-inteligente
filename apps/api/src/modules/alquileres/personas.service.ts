import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { registrarEventos } from './historial';
import {
  LIMITE_LISTA_CON_SONDA,
  type Contacto,
  type CuentaBancaria,
  type Persona,
  type PersonaDto,
  type PersonaFichaDto,
} from '@vacker/types';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
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
  cuit: true,
  condicionIva: true,
  localidad: true,
  provincia: true,
  codigoPostal: true,
  fechaNacimiento: true,
  nacionalidad: true,
  estadoCivil: true,
} as const;

type FilaPersona = { [K in keyof typeof CAMPOS]: unknown } & { id: string; nombre: string; fechaNacimiento: Date | null };

/** La fila de la base, con la fecha como texto. */
function aDto(p: FilaPersona): PersonaDto {
  return { ...(p as unknown as PersonaDto), fechaNacimiento: fromDate(p.fechaNacimiento) };
}

/** Lo que se guarda: la fecha como `Date`, el resto tal cual. */
function datos(dto: Persona) {
  return { ...dto, fechaNacimiento: toDate(dto.fechaNacimiento) };
}

const CAMPOS_CUENTA = { id: true, banco: true, tipo: true, moneda: true, numero: true, cbu: true, alias: true, titular: true, cuitTitular: true, principal: true } as const;
const CAMPOS_CONTACTO = { id: true, nombre: true, relacion: true, email: true, telefono: true, principal: true } as const;

/** Una sola principal: la marcada, o la primera si no hay ninguna. */
function conUnaPrincipal<T extends { principal: boolean }>(xs: T[]): T[] {
  const i = Math.max(0, xs.findIndex((x) => x.principal));
  return xs.map((x, j) => ({ ...x, principal: j === i }));
}

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
    return this.db.withTenant(async (tx) =>
      (await tx.alqPersona.findMany({ select: CAMPOS, orderBy: { nombre: 'asc' }, take: LIMITE_LISTA_CON_SONDA })).map((p) => aDto(p as FilaPersona)),
    );
  }

  /**
   * La ficha (punto 14 de Javier, como «Clientes» de Gexion): los datos, las
   * cuentas bancarias, los contactos y los contratos donde aparece. Cuatro
   * consultas, en paralelo.
   */
  async ficha(id: string): Promise<PersonaFichaDto> {
    return this.db.withTenant(async (tx) => {
      const [p, cuentas, contactos, partes] = await Promise.all([
        tx.alqPersona.findUnique({ where: { id }, select: CAMPOS }),
        tx.alqCuentaBancaria.findMany({ where: { personaId: id }, select: CAMPOS_CUENTA, orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] }),
        tx.alqContacto.findMany({ where: { personaId: id }, select: CAMPOS_CONTACTO, orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] }),
        tx.alqContratoParte.findMany({
          where: { personaId: id, contrato: { estado: { not: 'anulado' } } },
          select: {
            papel: true,
            contrato: {
              select: {
                id: true,
                codigo: true,
                estado: true,
                tipo: true,
                moneda: true,
                inicio: true,
                fin: true,
                propiedad: { select: { direccion: true, unidad: true } },
                tramos: { select: { desde: true, importe: true }, orderBy: { numero: 'asc' } },
              },
            },
          },
        }),
      ]);
      if (!p) throw new NotFoundException('Persona no encontrada.');
      const hoy = hoyArgentina();
      return {
        persona: aDto(p as FilaPersona),
        cuentas: cuentas as PersonaFichaDto['cuentas'],
        contactos,
        contratos: partes
          .map(({ papel, contrato: c }) => {
            const vigente = c.tramos.filter((t) => t.importe != null && fromDate(t.desde)! <= hoy).at(-1);
            return {
              id: c.id,
              codigo: c.codigo,
              papel: papel as PersonaFichaDto['contratos'][number]['papel'],
              estado: c.estado as PersonaFichaDto['contratos'][number]['estado'],
              tipo: c.tipo as PersonaFichaDto['contratos'][number]['tipo'],
              propiedad: [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' '),
              inicio: fromDate(c.inicio)!,
              fin: fromDate(c.fin)!,
              moneda: c.moneda as PersonaFichaDto['contratos'][number]['moneda'],
              importeVigente: vigente?.importe != null ? decToNum(vigente.importe) : null,
            };
          })
          .sort((a, b) => (a.estado === b.estado ? a.codigo.localeCompare(b.codigo, 'es', { numeric: true }) : a.estado === 'vigente' ? -1 : 1)),
      };
    });
  }

  /** Las cuentas bancarias se guardan todas juntas: la lista que se ve es la que queda. */
  async guardarCuentas(ctx: TenantContext, id: string, cuentas: CuentaBancaria[]): Promise<PersonaFichaDto['cuentas']> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqPersona.findUnique({ where: { id }, select: { nombre: true } });
      if (!p) throw new NotFoundException('Persona no encontrada.');
      await tx.alqCuentaBancaria.deleteMany({ where: { personaId: id } });
      if (cuentas.length) await tx.alqCuentaBancaria.createMany({ data: conUnaPrincipal(cuentas).map((c) => ({ ...c, tenantId: ctx.tenantId, personaId: id })) });
      await registrarEventos(tx, ctx, {
        entidad: 'persona',
        entidadId: id,
        personaId: id,
        accion: 'edicion',
        resumen: `Cuentas bancarias de ${p.nombre}: ${cuentas.length ? cuentas.map((c) => `${c.banco}${c.alias ? ` (${c.alias})` : ''}`).join(', ') : 'ninguna'}`,
      });
      return tx.alqCuentaBancaria.findMany({ where: { personaId: id }, select: CAMPOS_CUENTA, orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] }) as Promise<PersonaFichaDto['cuentas']>;
    });
  }

  async guardarContactos(ctx: TenantContext, id: string, contactos: Contacto[]): Promise<PersonaFichaDto['contactos']> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqPersona.findUnique({ where: { id }, select: { nombre: true } });
      if (!p) throw new NotFoundException('Persona no encontrada.');
      await tx.alqContacto.deleteMany({ where: { personaId: id } });
      if (contactos.length) await tx.alqContacto.createMany({ data: conUnaPrincipal(contactos).map((c) => ({ ...c, tenantId: ctx.tenantId, personaId: id })) });
      await registrarEventos(tx, ctx, {
        entidad: 'persona',
        entidadId: id,
        personaId: id,
        accion: 'edicion',
        resumen: `Contactos de ${p.nombre}: ${contactos.length ? contactos.map((c) => c.nombre).join(', ') : 'ninguno'}`,
      });
      return tx.alqContacto.findMany({ where: { personaId: id }, select: CAMPOS_CONTACTO, orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] });
    });
  }

  async crear(ctx: TenantContext, dto: Persona): Promise<PersonaDto> {
    return this.db.withTenant(async (tx) => {
      await this.assertDocumentoLibre(tx, dto.documento);
      const p = aDto((await tx.alqPersona.create({ data: { ...datos(dto), tenantId: ctx.tenantId }, select: CAMPOS })) as FilaPersona);
      await registrarEventos(tx, ctx, { entidad: 'persona', entidadId: p.id, personaId: p.id, accion: 'alta', resumen: `Alta de ${p.nombre}` });
      return p;
    });
  }

  async actualizar(ctx: TenantContext, id: string, dto: Persona): Promise<PersonaDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.alqPersona.findUnique({ where: { id }, select: { id: true } });
      if (!actual) throw new NotFoundException('Persona no encontrada.');
      await this.assertDocumentoLibre(tx, dto.documento, id);
      const p = aDto((await tx.alqPersona.update({ where: { id }, data: datos(dto), select: CAMPOS })) as FilaPersona);
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
