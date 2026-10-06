import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  TenantConfigSchema,
  codigoDeContrato,
  prefijoDeContratos,
  type CambiarEstadoContrato,
  type Contrato,
  type ContratoDatos,
  type ContratoDto,
  type ContratoResumenDto,
  type ExtenderContrato,
  type EstadoContrato,
} from '@vacker/types';
import { generarTramos, sumarDiasIso, validarPartes, validarTramos } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { IMPUTACION_ACTIVA } from './imputacion-activa';
import { dia, nombresDeUsuarios, registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const INCLUIR = {
  propiedad: { select: { id: true, direccion: true, unidad: true, ciudad: true } },
  partes: { select: { personaId: true, papel: true, porcentaje: true, persona: { select: { nombre: true } } } },
  tramos: { orderBy: { numero: 'asc' as const } },
} satisfies Prisma.AlqContratoInclude;

type FilaContrato = Prisma.AlqContratoGetPayload<{ include: typeof INCLUIR }>;

/**
 * Contratos de alquiler (spec alquileres-fase-1.md, reglas 1–4).
 *
 * Las reglas que miran el contrato entero —tramos sin huecos, porcentajes que
 * suman 100— vienen de @vacker/domain: es el mismo código con el que la web
 * avisa mientras se carga, así que lo que la pantalla da por bueno es lo que
 * la API acepta.
 */
@Injectable()
export class ContratosService {
  constructor(private readonly db: TenantPrismaService) {}

  async listar(): Promise<ContratoResumenDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqContrato.findMany({
        include: INCLUIR,
        // Por número, como en Gexion: ALT-0002 antes que ALT-0010.
        orderBy: [{ codigoNum: 'asc' }, { codigo: 'asc' }],
        take: LIMITE_LISTA_CON_SONDA,
      });
      const hoy = hoyArgentina();
      return filas.map((f) => aResumen(f, hoy));
    });
  }

  async obtener(id: string): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => this.dto(tx, await this.buscar(tx, id)));
  }

  async crear(ctx: TenantContext, dto: Contrato): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      await this.validar(tx, dto);
      const codigo = dto.codigo ? await this.normalizarCodigo(tx, ctx, dto.codigo) : await this.siguienteCodigo(tx, ctx);
      await this.assertCodigoLibre(tx, codigo);
      const fila = await tx.alqContrato.create({
        data: { ...columnas(dto), codigo, tenantId: ctx.tenantId, estado: 'borrador', creadoPorId: ctx.userId, depositoGestion: await this.gestionDeposito(tx, ctx), ...hijos(ctx.tenantId, dto) },
        include: INCLUIR,
      });
      await registrarEventos(tx, ctx, { entidad: 'contrato', entidadId: fila.id, contratoId: fila.id, accion: 'alta', resumen: `Alta del contrato ${codigo}, en borrador` });
      return this.dto(tx, fila);
    });
  }

  /**
   * Se edita entero solo en borrador. Un contrato vigente ya generó (o va a
   * generar) conceptos con estos tramos y porcentajes: cambiarlos por debajo
   * dejaría cobros calculados con reglas que ya no están a la vista. Sus
   * cambios llegan por la indexación, la rescisión o la extensión.
   */
  async actualizar(ctx: TenantContext, id: string, dto: Contrato): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      if (actual.estado !== 'borrador') {
        throw new BadRequestException('Solo un contrato en borrador se edita completo. Uno vigente cambia por indexación o rescisión.');
      }
      await this.validar(tx, dto);
      const codigo = dto.codigo ? await this.normalizarCodigo(tx, ctx, dto.codigo) : actual.codigo;
      if (codigo !== actual.codigo) await this.assertCodigoLibre(tx, codigo, id);
      // Partes y tramos se reemplazan: en borrador no hay nada que dependa de ellos.
      await tx.alqContratoParte.deleteMany({ where: { contratoId: id } });
      await tx.alqTramo.deleteMany({ where: { contratoId: id } });
      const fila = await tx.alqContrato.update({
        where: { id },
        data: { ...columnas(dto), codigo, ...hijos(ctx.tenantId, dto) },
        include: INCLUIR,
      });
      await registrarEventos(tx, ctx, { entidad: 'contrato', entidadId: id, contratoId: id, accion: 'edicion', resumen: `Contrato ${codigo} editado (borrador)` });
      return this.dto(tx, fila);
    });
  }

  /**
   * Lo que se edita de un contrato vigente: lo que no toca plata (decidido con
   * Javier el 6/10/2026). El historial dice qué cambió, de qué a qué.
   */
  async actualizarDatos(ctx: TenantContext, id: string, datos: ContratoDatos): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      if (actual.estado !== 'vigente') {
        throw new BadRequestException(actual.estado === 'borrador' ? 'Un contrato en borrador se edita completo.' : `Un contrato ${actual.estado} ya no se edita.`);
      }
      const antes = { fechaFirma: fromDate(actual.fechaFirma), diaVencimiento: actual.diaVencimiento, diaPagoPropietario: actual.diaPagoPropietario, obs: actual.obs };
      const NOMBRE: Record<keyof ContratoDatos, string> = {
        fechaFirma: 'fecha de firma',
        diaVencimiento: 'día de vencimiento',
        diaPagoPropietario: 'día de pago al propietario',
        obs: 'observaciones',
      };
      const cambios = (Object.keys(NOMBRE) as (keyof ContratoDatos)[]).filter((k) => (antes[k] ?? null) !== (datos[k] ?? null));
      const fila = await tx.alqContrato.update({
        where: { id },
        data: { fechaFirma: toDate(datos.fechaFirma), diaVencimiento: datos.diaVencimiento, diaPagoPropietario: datos.diaPagoPropietario, obs: datos.obs },
        include: INCLUIR,
      });
      if (cambios.length) {
        await registrarEventos(tx, ctx, {
          entidad: 'contrato',
          entidadId: id,
          contratoId: id,
          accion: 'edicion',
          resumen: `Cambió ${cambios.map((k) => NOMBRE[k]).join(', ')}`,
          detalle: Object.fromEntries(cambios.map((k) => [k, { antes: antes[k] ?? null, despues: datos[k] ?? null }])),
        });
      }
      return this.dto(tx, fila);
    });
  }

  /**
   * Extender un contrato vigente (punto 13 de Javier, como el botón de Gexion):
   * los tramos nuevos arrancan al día siguiente del fin y siguen la misma
   * periodicidad. Indexado: se indexan como cualquier tramo. Escalonado: un
   * tramo con el importe que se indica.
   */
  async extender(ctx: TenantContext, id: string, dto: ExtenderContrato): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      if (actual.estado !== 'vigente') throw new BadRequestException('Se extiende un contrato vigente.');
      const finActual = fromDate(actual.fin)!;
      if (dto.nuevoFin <= finActual) throw new BadRequestException(`La nueva fecha de fin tiene que ser posterior al ${dia(finActual)}.`);
      const desde = sumarDiasIso(finActual, 1);
      const indexado = actual.ajuste === 'indexado' && actual.periodicidadMeses;
      if (!indexado && dto.importeBase == null) throw new BadRequestException('Un contrato escalonado necesita el importe del tramo nuevo.');
      const base = actual.tramos.at(-1)?.numero ?? 0;
      const nuevos = indexado ? generarTramos(desde, dto.nuevoFin, actual.periodicidadMeses!) : [{ numero: 1, desde, hasta: dto.nuevoFin }];
      await tx.alqTramo.createMany({
        data: nuevos.map((t) => ({
          tenantId: ctx.tenantId,
          contratoId: id,
          numero: base + t.numero,
          desde: toDate(t.desde)!,
          hasta: toDate(t.hasta)!,
          // Indexado: el importe sale de indexar, como cualquier tramo.
          importe: indexado ? null : dto.importeBase,
        })),
      });
      const fila = await tx.alqContrato.update({ where: { id }, data: { fin: toDate(dto.nuevoFin)! }, include: INCLUIR });
      await registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: id,
        contratoId: id,
        accion: 'edicion',
        resumen: `Contrato ${actual.codigo} extendido del ${dia(finActual)} al ${dia(dto.nuevoFin)}: ${nuevos.length} ${nuevos.length === 1 ? 'tramo nuevo' : 'tramos nuevos'}`,
      });
      return this.dto(tx, fila);
    });
  }

  /**
   * Se borra de verdad solo en borrador: todavía no generó nada (decidido con
   * Javier el 6/10/2026). El historial conserva que existió y quién lo borró.
   */
  async borrar(ctx: TenantContext, id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqContrato.findUnique({ where: { id }, select: { codigo: true, estado: true, _count: { select: { conceptos: true, documentos: true } } } });
      if (!c) throw new NotFoundException('Contrato no encontrado.');
      if (c.estado !== 'borrador') throw new ConflictException(`El contrato ${c.codigo} está ${c.estado}: no se borra, se anula con un motivo.`);
      if (c._count.conceptos) throw new ConflictException(`El contrato ${c.codigo} ya tiene conceptos: no se borra, se anula con un motivo.`);
      if (c._count.documentos) throw new ConflictException(`El contrato ${c.codigo} tiene el PDF cargado: no se borra, se anula con un motivo.`);
      await tx.alqContrato.delete({ where: { id } });
      await registrarEventos(tx, ctx, { entidad: 'contrato', entidadId: id, contratoId: id, accion: 'borrado', resumen: `Contrato ${c.codigo} borrado (estaba en borrador)` });
      return { id };
    });
  }

  /**
   * Anular un contrato cargado por error: queda a la vista, tachado, con el
   * motivo, y sus conceptos se anulan. Si ya entró o salió plata por él, se
   * anulan primero esos recibos y liquidaciones: la plata no desaparece sola.
   */
  async anular(ctx: TenantContext, id: string, motivo: string): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      if (actual.estado === 'borrador') throw new BadRequestException('Un contrato en borrador se borra, no se anula.');
      if (actual.estado === 'anulado') throw new ConflictException('El contrato ya está anulado.');
      const [cobrados, liquidados] = await Promise.all([
        tx.alqConcepto.count({ where: { contratoId: id, anuladoEn: null, imputaciones: { some: IMPUTACION_ACTIVA } } }),
        tx.alqConcepto.count({ where: { contratoId: id, anuladoEn: null, liquidacionId: { not: null } } }),
      ]);
      if (cobrados || liquidados) {
        const que = [cobrados && 'cobros', liquidados && 'liquidaciones'].filter(Boolean).join(' y ');
        throw new ConflictException(`El contrato ${actual.codigo} tiene ${que} registrados. Anulá primero esos recibos o liquidaciones; después, el contrato.`);
      }
      const ahora = new Date();
      await tx.alqConcepto.updateMany({
        where: { contratoId: id, anuladoEn: null },
        data: { anuladoEn: ahora, anuladoPorId: ctx.userId, motivoAnulacion: `contrato anulado: ${motivo}` },
      });
      const fila = await tx.alqContrato.update({
        where: { id },
        data: { estado: 'anulado', anuladoEn: ahora, anuladoPorId: ctx.userId, motivoAnulacion: motivo },
        include: INCLUIR,
      });
      await registrarEventos(tx, ctx, { entidad: 'contrato', entidadId: id, contratoId: id, accion: 'anulacion', resumen: `Contrato ${actual.codigo} anulado: ${motivo}` });
      return this.dto(tx, fila);
    });
  }

  /** Reglas 2 y 3: las transiciones posibles, y lo que arrastra la rescisión. */
  async cambiarEstado(ctx: TenantContext, id: string, cambio: CambiarEstadoContrato): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      const desde = actual.estado as EstadoContrato;
      const permitidas: Record<EstadoContrato, EstadoContrato[]> = {
        borrador: ['vigente'],
        vigente: ['finalizado', 'rescindido'],
        finalizado: [],
        rescindido: [],
        anulado: [],
      };
      if (!permitidas[desde].includes(cambio.estado)) {
        throw new BadRequestException(`Un contrato ${desde} no puede pasar a ${cambio.estado}.`);
      }

      if (cambio.estado === 'rescindido') {
        const inicio = fromDate(actual.inicio)!;
        const fin = fromDate(actual.fin)!;
        if (cambio.fecha < inicio || cambio.fecha > fin) {
          throw new BadRequestException('La fecha de rescisión tiene que estar dentro del contrato.');
        }
        // Regla 3: lo generado de meses posteriores que no se cobró se anula.
        // Lo cobrado no se toca: esa plata entró y queda a la vista.
        await tx.alqConcepto.updateMany({
          where: { contratoId: id, anuladoEn: null, periodo: { gt: cambio.fecha.slice(0, 7) }, imputaciones: { none: IMPUTACION_ACTIVA } },
          data: { anuladoEn: new Date(), anuladoPorId: ctx.userId, motivoAnulacion: 'rescisión' },
        });
      }

      const fila = await tx.alqContrato.update({
        where: { id },
        data: { estado: cambio.estado, rescindidoEl: cambio.estado === 'rescindido' ? toDate(cambio.fecha) : null },
        include: INCLUIR,
      });
      const QUE = { vigente: 'activado', finalizado: 'finalizado', rescindido: 'rescindido' } as const;
      await registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: id,
        contratoId: id,
        accion: 'estado',
        resumen: `Contrato ${actual.codigo} ${QUE[cambio.estado]}${cambio.estado === 'rescindido' ? ` el ${dia(cambio.fecha)}` : ''}`,
      });
      return this.dto(tx, fila);
    });
  }

  // --- internos ----------------------------------------------------------------

  private async buscar(tx: Tx, id: string): Promise<FilaContrato> {
    const fila = await tx.alqContrato.findUnique({ where: { id }, include: INCLUIR });
    if (!fila) throw new NotFoundException('Contrato no encontrado.');
    return fila;
  }

  /**
   * Reglas 1 y 4, más que la propiedad y las personas existan en ESTA
   * inmobiliaria (RLS ya oculta las de otra: si no aparecen, para nosotros no
   * existen). Todos los problemas juntos, no de a uno.
   */
  private async validar(tx: Tx, dto: Contrato): Promise<void> {
    const errores = [...validarTramos(dto.inicio, dto.fin, dto.tramos), ...validarPartes(dto.partes)];
    const numeros = dto.tramos.map((t) => t.numero);
    if (new Set(numeros).size !== numeros.length) errores.push('Hay dos tramos con el mismo número.');

    const ids = [...new Set(dto.partes.map((p) => p.personaId))];
    const [propiedad, personas] = await Promise.all([
      tx.alqPropiedad.findUnique({ where: { id: dto.propiedadId }, select: { id: true } }),
      tx.alqPersona.count({ where: { id: { in: ids } } }),
    ]);
    if (!propiedad) errores.push('La propiedad no existe.');
    if (personas !== ids.length) errores.push('Alguna de las personas no existe.');

    if (errores.length) throw new BadRequestException({ message: errores.join(' '), details: errores });
  }

  /** La ficha con los nombres de quien la cargó y quien la anuló. */
  private async dto(tx: Tx, f: FilaContrato): Promise<ContratoDto> {
    const nombres = await nombresDeUsuarios(tx, [f.creadoPorId, f.anuladoPorId]);
    return aDto(f, nombres);
  }

  /** Cómo se gestiona el depósito en los contratos nuevos: lo que diga la configuración de la inmobiliaria. */
  private async gestionDeposito(tx: Tx, ctx: TenantContext): Promise<string> {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { config: true } });
    return TenantConfigSchema.parse(t.config ?? {}).depositoGestion;
  }

  private async prefijo(tx: Tx, ctx: TenantContext): Promise<string> {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nombre: true, config: true } });
    const corto = (t.config as { nombreCorto?: string | null } | null)?.nombreCorto;
    return prefijoDeContratos(corto || t.nombre);
  }

  /**
   * El siguiente número de la inmobiliaria con su prefijo: ALT-0011 (pedido de
   * Javier del 6/10/2026). Sigue al más alto, así los de Vacker continúan
   * desde el último número que traen de Gexion.
   */
  private async siguienteCodigo(tx: Tx, ctx: TenantContext): Promise<string> {
    const [prefijo, max] = await Promise.all([this.prefijo(tx, ctx), tx.alqContrato.aggregate({ _max: { codigoNum: true } })]);
    return codigoDeContrato(prefijo, (max._max.codigoNum ? decToNum(max._max.codigoNum) : 0) + 1);
  }

  /** Si se escribe solo el número («25»), se completa con el prefijo: VAC-0025. */
  private async normalizarCodigo(tx: Tx, ctx: TenantContext, codigo: string): Promise<string> {
    return /^\d+$/.test(codigo) ? codigoDeContrato(await this.prefijo(tx, ctx), Number(codigo)) : codigo.toUpperCase();
  }

  private async assertCodigoLibre(tx: Tx, codigo: string, exceptoId?: string): Promise<void> {
    const otro = await tx.alqContrato.findFirst({
      where: { codigo, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
      select: { id: true },
    });
    if (otro) throw new ConflictException(`Ya hay un contrato con el código ${codigo}.`);
  }
}

// --- mapeos --------------------------------------------------------------------

function columnas(dto: Contrato) {
  return {
    propiedadId: dto.propiedadId,
    tipo: dto.tipo,
    moneda: dto.moneda,
    inicio: toDate(dto.inicio)!,
    fin: toDate(dto.fin)!,
    fechaFirma: toDate(dto.fechaFirma),
    diaVencimiento: dto.diaVencimiento,
    diaPagoPropietario: dto.diaPagoPropietario,
    ajuste: dto.ajuste,
    // Un contrato escalonado no tiene índice: no se guarda lo que no aplica.
    indice: dto.ajuste === 'indexado' ? dto.indice : null,
    periodicidadMeses: dto.ajuste === 'indexado' ? dto.periodicidadMeses : null,
    honorariosPct: dto.honorariosPct,
    gastosAdmPct: dto.gastosAdmPct,
    ivaPct: dto.ivaPct,
    punitorioDiarioPct: dto.punitorioDiarioPct,
    pagoGarantizado: dto.pagoGarantizado,
    depositoImporte: dto.depositoImporte,
    depositoMoneda: dto.depositoImporte != null ? (dto.depositoMoneda ?? dto.moneda) : null,
    depositoDevolucion: toDate(dto.depositoDevolucion),
    obs: dto.obs,
  };
}

function hijos(tenantId: string, dto: Contrato) {
  const propietarios = dto.partes.filter((p) => p.papel === 'propietario');
  return {
    partes: {
      create: dto.partes.map((p) => ({
        tenantId,
        personaId: p.personaId,
        papel: p.papel,
        // Un único propietario sin porcentaje es dueño del 100%.
        porcentaje: p.papel === 'propietario' ? (p.porcentaje ?? (propietarios.length === 1 ? 100 : null)) : null,
      })),
    },
    tramos: {
      create: dto.tramos.map((t) => ({
        tenantId,
        numero: t.numero,
        desde: toDate(t.desde)!,
        hasta: toDate(t.hasta)!,
        // En un indexado solo el primero lleva importe al cargarse: el resto
        // se completa al indexar (regla 6). Si vinieran cargados —una
        // migración desde Gexion—, se respetan como ya confirmados.
        importe: t.importe,
        confirmadoEl: t.importe != null && t.numero !== 1 && dto.ajuste === 'indexado' ? new Date() : null,
      })),
    },
  };
}

function aResumen(f: FilaContrato, hoy: string): ContratoResumenDto {
  const tramos = f.tramos.map((t) => ({ desde: fromDate(t.desde)!, hasta: fromDate(t.hasta)!, importe: t.importe == null ? null : decToNum(t.importe) }));
  const deHoy = tramos.find((t) => t.desde <= hoy && t.hasta >= hoy);
  const pendiente = tramos.filter((t) => t.importe == null).sort((a, b) => (a.desde < b.desde ? -1 : 1))[0];
  const nombres = (papel: string) => f.partes.filter((p) => p.papel === papel).map((p) => ({ id: p.personaId, nombre: p.persona.nombre }));
  return {
    id: f.id,
    codigo: f.codigo,
    estado: f.estado as ContratoResumenDto['estado'],
    tipo: f.tipo as ContratoResumenDto['tipo'],
    moneda: f.moneda as ContratoResumenDto['moneda'],
    inicio: fromDate(f.inicio)!,
    fin: fromDate(f.fin)!,
    propiedad: { id: f.propiedad.id, direccion: f.propiedad.direccion, unidad: f.propiedad.unidad },
    propietarios: nombres('propietario'),
    inquilinos: nombres('inquilino'),
    importeVigente: deHoy?.importe ?? null,
    proximaIndexacion: f.ajuste === 'indexado' ? (pendiente?.desde ?? null) : null,
  };
}

function aDto(f: FilaContrato, nombres: Map<string, string>): ContratoDto {
  return {
    id: f.id,
    codigo: f.codigo,
    estado: f.estado as ContratoDto['estado'],
    tipo: f.tipo as ContratoDto['tipo'],
    moneda: f.moneda as ContratoDto['moneda'],
    inicio: fromDate(f.inicio)!,
    fin: fromDate(f.fin)!,
    fechaFirma: fromDate(f.fechaFirma),
    diaVencimiento: f.diaVencimiento,
    diaPagoPropietario: f.diaPagoPropietario,
    ajuste: f.ajuste as ContratoDto['ajuste'],
    indice: f.indice as ContratoDto['indice'],
    periodicidadMeses: f.periodicidadMeses,
    honorariosPct: decToNum(f.honorariosPct),
    gastosAdmPct: decToNum(f.gastosAdmPct),
    ivaPct: decToNum(f.ivaPct),
    punitorioDiarioPct: decToNum(f.punitorioDiarioPct),
    pagoGarantizado: f.pagoGarantizado,
    depositoImporte: f.depositoImporte == null ? null : decToNum(f.depositoImporte),
    depositoMoneda: f.depositoMoneda as ContratoDto['depositoMoneda'],
    depositoDevolucion: fromDate(f.depositoDevolucion),
    rescindidoEl: fromDate(f.rescindidoEl),
    obs: f.obs,
    registrado: { en: f.createdAt.toISOString(), por: f.creadoPorId ? (nombres.get(f.creadoPorId) ?? null) : null },
    anulado: f.anuladoEn ? { en: f.anuladoEn.toISOString(), motivo: f.motivoAnulacion ?? '', por: f.anuladoPorId ? (nombres.get(f.anuladoPorId) ?? null) : null } : null,
    propiedad: f.propiedad,
    partes: f.partes.map((p) => ({
      personaId: p.personaId,
      nombre: p.persona.nombre,
      papel: p.papel as ContratoDto['partes'][number]['papel'],
      porcentaje: p.porcentaje == null ? null : decToNum(p.porcentaje),
    })),
    tramos: f.tramos.map((t) => ({
      numero: t.numero,
      desde: fromDate(t.desde)!,
      hasta: fromDate(t.hasta)!,
      importe: t.importe == null ? null : decToNum(t.importe),
      confirmadoEl: t.confirmadoEl ? t.confirmadoEl.toISOString() : null,
      indiceBase: t.indiceBase == null ? null : decToNum(t.indiceBase),
      indiceRequerido: t.indiceRequerido == null ? null : decToNum(t.indiceRequerido),
      importePropuesto: t.importePropuesto == null ? null : decToNum(t.importePropuesto),
    })),
  };
}
