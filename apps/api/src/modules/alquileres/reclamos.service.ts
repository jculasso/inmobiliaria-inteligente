import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ESTADOS_RECLAMO_ABIERTOS,
  EstadoReclamoEntradaSchema,
  LIMITE_LISTA_CON_SONDA,
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_PRIORIDAD,
  ROLES_ADMINISTRACION_ALQUILERES,
  puedeAdministrarAlquileres,
  type AvisoProveedor,
  type CambioReclamo,
  type EnvioMailDto,
  type EstadoReclamo,
  type GastoDelReclamo,
  type Reclamo,
  type ReclamoDto,
  type ReclamoResumenDto,
  type Rol,
} from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate } from '../tablero/tablero.util';
import { EnviosService } from './envios.service';
import { nombresDeUsuarios, registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];
type FilaReclamo = Prisma.AlqReclamoGetPayload<object>;

const ORDEN_PRIORIDAD = { urgente: 0, alta: 1, media: 2, baja: 3 } as const;

/**
 * El estado guardado, con «cerrado» leído como «resuelto» (regla 68): una
 * fila que la migración no alcanzó —o que escribió una API vieja en la
 * ventana del deploy— se ve y se compara como lo que es.
 */
const estadoDe = (estado: string): EstadoReclamo =>
  EstadoReclamoEntradaSchema.catch('abierto').parse(estado);

/**
 * Reclamos de inquilinos y propietarios (entrega 15, como Gexion): asunto,
 * tipo, prioridad, estado, quién lo sigue, qué proveedor lo arregla, y un
 * historial de notas con quién escribió cada una. Cada cambio deja su nota.
 *
 * «Lo sigue» es alguien que entra al módulo (`ROLES_ADMINISTRACION_ALQUILERES`),
 * nunca un vendedor (Javier, 7/10/2026: «los reclamos se los asignás a los
 * vendedores, eso está mal»). Es un permiso y se valida acá, no solo en el
 * select de la pantalla (reglas 60 a 66 de docs/specs/alquileres-fase-1.md).
 */
@Injectable()
export class ReclamosService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly envios: EnviosService,
  ) {}

  async listar(q: {
    estado: 'abiertos' | 'todos';
    contratoId?: string;
    personaId?: string;
  }): Promise<ReclamoResumenDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqReclamo.findMany({
        where: {
          ...(q.estado === 'abiertos' ? { estado: { in: [...ESTADOS_RECLAMO_ABIERTOS] } } : {}),
          ...(q.contratoId ? { contratoId: q.contratoId } : {}),
          ...(q.personaId ? { personaId: q.personaId } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: LIMITE_LISTA_CON_SONDA,
      });
      const resumenes = await this.resumenes(tx, filas);
      return resumenes.sort(
        (a, b) =>
          ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] ||
          (a.actualizado < b.actualizado ? 1 : -1),
      );
    });
  }

  async obtener(id: string): Promise<ReclamoDto> {
    return this.db.withTenant((tx) => this.obtenerEn(tx, id));
  }

  async crear(ctx: TenantContext, dto: Reclamo): Promise<ReclamoDto> {
    return this.db.withTenant(async (tx) => {
      await referenciasDeLaInmobiliaria(tx, {
        contratoId: dto.contratoId,
        personaId: dto.personaId,
        asignadoAId: dto.asignadoAId,
        proveedorId: dto.proveedorId,
      });
      // Si viene el contrato y no la persona, el reclamo es de su inquilino.
      let personaId = dto.personaId;
      if (!personaId && dto.contratoId) {
        const inq = await tx.alqContratoParte.findFirst({
          where: { contratoId: dto.contratoId, papel: 'inquilino' },
          orderBy: { personaId: 'asc' },
          select: { personaId: true },
        });
        personaId = inq?.personaId ?? null;
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId} || ':alq_reclamo'))`;
      const ultimo = await tx.alqReclamo.aggregate({ _max: { numero: true } });
      const numero = (ultimo._max.numero ?? 0) + 1;
      const r = await tx.alqReclamo.create({
        data: { ...dto, personaId, numero, tenantId: ctx.tenantId, creadoPorId: ctx.userId },
      });
      await this.nota(
        tx,
        ctx,
        r.id,
        `Abrió el reclamo (${NOMBRE_PRIORIDAD[dto.prioridad].toLowerCase()} prioridad).`,
      );
      await registrarEventos(tx, ctx, {
        entidad: 'reclamo',
        entidadId: r.id,
        contratoId: dto.contratoId,
        personaId,
        accion: 'alta',
        resumen: `Reclamo ${numero}: ${dto.asunto}`,
      });
      return this.obtenerEn(tx, r.id);
    });
  }

  /** Cambiar estado, prioridad, quién lo sigue o el proveedor, y anotar lo hecho: todo queda en el historial. */
  async cambiar(ctx: TenantContext, id: string, cambio: CambioReclamo): Promise<ReclamoDto> {
    return this.db.withTenant(async (tx) => {
      const r = await tx.alqReclamo.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('El reclamo no existe.');
      const partes: string[] = [];
      const data: Prisma.AlqReclamoUncheckedUpdateInput = {};
      const antes = estadoDe(r.estado);
      if (cambio.estado && cambio.estado !== antes) {
        partes.push(
          `Estado: ${NOMBRE_ESTADO_RECLAMO[antes]} → ${NOMBRE_ESTADO_RECLAMO[cambio.estado]}.`,
        );
        data.estado = cambio.estado;
        // `cerrado_en`: cuándo se dio por resuelto. Reabrirlo lo borra.
        data.cerradoEn = cambio.estado === 'resuelto' ? new Date() : null;
      }
      if (cambio.prioridad && cambio.prioridad !== r.prioridad) {
        partes.push(`Prioridad: ${NOMBRE_PRIORIDAD[cambio.prioridad].toLowerCase()}.`);
        data.prioridad = cambio.prioridad;
      }
      // Solo si cambia: un reclamo viejo asignado a alguien que hoy no califica
      // se puede volver a guardar (otro cambio, o el mismo valor) sin fallar (regla 63).
      if (cambio.asignadoAId !== undefined && cambio.asignadoAId !== r.asignadoAId) {
        const n = cambio.asignadoAId ? await quienLoSigue(tx, cambio.asignadoAId) : null;
        partes.push(n ? `Lo sigue: ${n}.` : 'Sin asignar.');
        data.asignadoAId = cambio.asignadoAId;
      }
      if (cambio.proveedorId !== undefined && cambio.proveedorId !== r.proveedorId) {
        const n = cambio.proveedorId
          ? await proveedorDeLaInmobiliaria(tx, cambio.proveedorId)
          : null;
        partes.push(n ? `Proveedor: ${n}.` : 'Sin proveedor.');
        data.proveedorId = cambio.proveedorId;
      }
      if (cambio.nota) partes.push(cambio.nota);
      if (partes.length === 0) return this.obtenerEn(tx, id);
      if (Object.keys(data).length) await tx.alqReclamo.update({ where: { id }, data });
      else await tx.alqReclamo.update({ where: { id }, data: { updatedAt: new Date() } });
      await this.nota(tx, ctx, id, partes.join(' '));
      if (data.estado) {
        await registrarEventos(tx, ctx, {
          entidad: 'reclamo',
          entidadId: id,
          contratoId: r.contratoId,
          personaId: r.personaId,
          accion: 'estado',
          resumen: `Reclamo ${r.numero}: ${NOMBRE_ESTADO_RECLAMO[cambio.estado!].toLowerCase()}`,
        });
      }
      return this.obtenerEn(tx, id);
    });
  }

  /**
   * Avisarle al proveedor por mail (regla 73). Sale SOLO al email del
   * proveedor del reclamo —el pedido no trae destinatario: no se puede usar
   * para escribirle a cualquiera—, con el texto que el operador revisó.
   * Después de que Resend lo aceptó, queda en el historial del reclamo.
   */
  async avisarProveedor(
    ctx: TenantContext,
    id: string,
    aviso: AvisoProveedor,
  ): Promise<EnvioMailDto> {
    const r = await this.db.withTenant(async (tx) => {
      const r = await tx.alqReclamo.findUnique({
        where: { id },
        select: {
          numero: true,
          contratoId: true,
          personaId: true,
          proveedor: { select: { nombre: true, email: true } },
        },
      });
      if (!r) throw new NotFoundException('El reclamo no existe.');
      if (!r.proveedor)
        throw new BadRequestException(
          'El reclamo no tiene proveedor: elegilo en «Actualizar» y guardá antes de avisarle.',
        );
      if (!r.proveedor.email)
        throw new BadRequestException(
          `${r.proveedor.nombre} no tiene email: cargáselo en Gastos › Proveedores.`,
        );
      return { ...r, proveedor: { nombre: r.proveedor.nombre, email: r.proveedor.email } };
    });
    const { nombre, email } = r.proveedor;
    await this.envios.mandarTexto(ctx, { para: [email], ...aviso });
    await this.db.withTenant(async (tx) => {
      await tx.alqReclamo.update({ where: { id }, data: { updatedAt: new Date() } });
      await this.nota(tx, ctx, id, `Se avisó a ${nombre} por mail (${email}).`);
      await registrarEventos(tx, ctx, {
        entidad: 'reclamo',
        entidadId: id,
        contratoId: r.contratoId,
        personaId: r.personaId,
        accion: 'envio',
        resumen: `Reclamo ${r.numero}: aviso a ${nombre} por mail (${email})`,
      });
    });
    return { enviado: true, para: [email] };
  }

  /**
   * Quiénes pueden seguir un reclamo: los usuarios activos que entran al
   * módulo. La misma regla que valida `quienLoSigue` al guardar (regla 61).
   */
  async usuarios(): Promise<{ id: string; nombre: string }[]> {
    return this.db.withTenant((tx) =>
      tx.usuario.findMany({
        where: {
          estado: 'activo',
          roles: { some: { rol: { in: [...ROLES_ADMINISTRACION_ALQUILERES] } } },
        },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    );
  }

  private async nota(tx: Tx, ctx: TenantContext, reclamoId: string, texto: string) {
    const u = await tx.usuario.findUnique({ where: { id: ctx.userId }, select: { nombre: true } });
    await tx.alqReclamoNota.create({
      data: {
        tenantId: ctx.tenantId,
        reclamoId,
        usuarioId: ctx.userId,
        usuarioNombre: u?.nombre ?? null,
        texto,
      },
    });
  }

  /**
   * La ficha: el reclamo con su historial, sus gastos del arreglo, quién lo
   * sigue con su contacto y el inquilino. Un número fijo de consultas, tenga
   * los gastos y las notas que tenga.
   */
  private async obtenerEn(tx: Tx, id: string): Promise<ReclamoDto> {
    const r = await tx.alqReclamo.findUnique({
      where: { id },
      include: {
        notas: { orderBy: { en: 'desc' } },
        comprobantes: {
          orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
          include: { proveedor: { select: { nombre: true } } },
        },
      },
    });
    if (!r) throw new NotFoundException('El reclamo no existe.');
    const usuarioIds = [r.creadoPorId, r.asignadoAId].filter((x): x is string => !!x);
    const [[resumen], usuarios, inquilino] = await Promise.all([
      this.resumenes(tx, [r]),
      usuarioIds.length
        ? tx.usuario.findMany({
            where: { id: { in: usuarioIds } },
            select: { id: true, nombre: true, telefono: true, email: true },
          })
        : [],
      // El inquilino del contrato: es quien le abre la puerta al proveedor.
      r.contratoId
        ? tx.alqContratoParte.findFirst({
            where: { contratoId: r.contratoId, papel: 'inquilino' },
            orderBy: { personaId: 'asc' },
            select: { persona: { select: { nombre: true, telefono: true } } },
          })
        : null,
    ]);
    const u = new Map(usuarios.map((x) => [x.id, x]));
    const loSigue = r.asignadoAId ? u.get(r.asignadoAId) : undefined;
    const gastos: GastoDelReclamo[] = r.comprobantes.map((c) => ({
      id: c.id,
      fecha: fromDate(c.fecha)!,
      proveedor: c.proveedor.nombre,
      descripcion: c.descripcion,
      importe: decToNum(c.importe),
      moneda: c.moneda as GastoDelReclamo['moneda'],
      aCargoDe: c.aCargoDe as GastoDelReclamo['aCargoDe'],
      estado: c.anuladoEn ? 'anulado' : c.pagadoEl ? 'pagado' : 'pendiente',
    }));
    const total = new Map<GastoDelReclamo['moneda'], number>();
    for (const g of gastos)
      if (g.estado !== 'anulado') total.set(g.moneda, (total.get(g.moneda) ?? 0) + g.importe);
    return {
      ...resumen!,
      descripcion: r.descripcion,
      asignadoAId: r.asignadoAId,
      abiertoPor: r.creadoPorId ? (u.get(r.creadoPorId)?.nombre ?? null) : null,
      contactoLoSigue: loSigue
        ? { telefono: loSigue.telefono ?? null, email: loSigue.email || null }
        : null,
      inquilino: inquilino?.persona
        ? { nombre: inquilino.persona.nombre, telefono: inquilino.persona.telefono ?? null }
        : null,
      gastos,
      totalGastos: [...total].map(([moneda, importe]) => ({
        moneda,
        importe: Math.round(importe * 100) / 100,
      })),
      notas: r.notas.map((n) => ({
        id: n.id,
        en: n.en.toISOString(),
        usuario: n.usuarioNombre,
        texto: n.texto,
      })),
    };
  }

  /** Contratos, personas, quién lo sigue y proveedores: cuatro consultas para toda la lista. */
  private async resumenes(tx: Tx, filas: FilaReclamo[]): Promise<ReclamoResumenDto[]> {
    const ids = (f: (r: FilaReclamo) => string | null) => [
      ...new Set(filas.map(f).filter((x): x is string => !!x)),
    ];
    const [contratos, personas, usuarios, proveedores] = await Promise.all([
      ids((r) => r.contratoId).length
        ? tx.alqContrato.findMany({
            where: { id: { in: ids((r) => r.contratoId) } },
            select: {
              id: true,
              codigo: true,
              propiedad: { select: { direccion: true, unidad: true } },
            },
          })
        : [],
      ids((r) => r.personaId).length
        ? tx.alqPersona.findMany({
            where: { id: { in: ids((r) => r.personaId) } },
            select: { id: true, nombre: true },
          })
        : [],
      nombresDeUsuarios(
        tx,
        filas.map((r) => r.asignadoAId),
      ),
      ids((r) => r.proveedorId).length
        ? tx.alqProveedor.findMany({
            where: { id: { in: ids((r) => r.proveedorId) } },
            select: { id: true, nombre: true, telefono: true, email: true },
          })
        : [],
    ]);
    const c = new Map(contratos.map((x) => [x.id, x]));
    const p = new Map(personas.map((x) => [x.id, x]));
    const prov = new Map(proveedores.map((x) => [x.id, x]));
    return filas.map((r) => {
      const k = r.contratoId ? c.get(r.contratoId) : undefined;
      return {
        id: r.id,
        numero: r.numero,
        asunto: r.asunto,
        tipo: r.tipo as ReclamoResumenDto['tipo'],
        prioridad: r.prioridad as ReclamoResumenDto['prioridad'],
        estado: estadoDe(r.estado),
        contrato: k
          ? {
              id: k.id,
              codigo: k.codigo,
              propiedad: [k.propiedad.direccion, k.propiedad.unidad].filter(Boolean).join(' '),
            }
          : null,
        persona: r.personaId ? (p.get(r.personaId) ?? null) : null,
        asignadoA: r.asignadoAId ? (usuarios.get(r.asignadoAId) ?? null) : null,
        proveedor: r.proveedorId ? (prov.get(r.proveedorId) ?? null) : null,
        abierto: r.createdAt.toISOString(),
        actualizado: r.updatedAt.toISOString(),
      };
    });
  }
}

/**
 * Los ids que llegan del pedido tienen que ser de esta inmobiliaria. El
 * reclamo no tiene claves foráneas, así que la base no lo frenaría: se buscan
 * acá, con RLS, y lo que no aparece no existe (auditoría del 6/10/2026).
 */
async function referenciasDeLaInmobiliaria(
  tx: Tx,
  ids: {
    contratoId: string | null;
    personaId: string | null;
    asignadoAId: string | null;
    proveedorId: string | null;
  },
): Promise<void> {
  const [contrato, persona] = await Promise.all([
    ids.contratoId ? tx.alqContrato.count({ where: { id: ids.contratoId } }) : 1,
    ids.personaId ? tx.alqPersona.count({ where: { id: ids.personaId } }) : 1,
    ids.asignadoAId ? quienLoSigue(tx, ids.asignadoAId) : null,
    ids.proveedorId ? proveedorDeLaInmobiliaria(tx, ids.proveedorId) : null,
  ]);
  if (!contrato) throw new NotFoundException('El contrato no existe.');
  if (!persona) throw new NotFoundException('La persona no existe.');
}

/**
 * Quien sigue un reclamo tiene que ser de la inmobiliaria (si no, no existe:
 * RLS), estar activo y entrar al módulo. Un vendedor o un team leader se
 * rechaza con su nombre (regla 62). Devuelve el nombre, para la nota.
 */
async function quienLoSigue(tx: Tx, usuarioId: string): Promise<string> {
  const u = await tx.usuario.findFirst({
    where: { id: usuarioId },
    select: { nombre: true, estado: true, roles: { select: { rol: true } } },
  });
  if (!u) throw new NotFoundException('El usuario asignado no existe.');
  if (u.estado !== 'activo')
    throw new BadRequestException(
      `${u.nombre} está inactivo: elegí a otra persona para seguir el reclamo.`,
    );
  if (!puedeAdministrarAlquileres(u.roles.map((r) => r.rol as Rol)))
    throw new BadRequestException(
      `${u.nombre} no usa Alquileres: el reclamo lo sigue alguien que entra al módulo.`,
    );
  return u.nombre;
}

/** El proveedor tiene que ser de esta inmobiliaria (regla 64). Devuelve el nombre, para la nota. */
async function proveedorDeLaInmobiliaria(tx: Tx, proveedorId: string): Promise<string> {
  const p = await tx.alqProveedor.findFirst({
    where: { id: proveedorId },
    select: { nombre: true },
  });
  if (!p) throw new NotFoundException('El proveedor no existe.');
  return p.nombre;
}
