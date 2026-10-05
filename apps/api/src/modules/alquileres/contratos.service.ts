import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  type CambiarEstadoContrato,
  type Contrato,
  type ContratoDto,
  type ContratoResumenDto,
  type EstadoContrato,
} from '@vacker/types';
import { validarPartes, validarTramos } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';

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
        orderBy: [{ estado: 'asc' }, { fin: 'asc' }],
        take: LIMITE_LISTA_CON_SONDA,
      });
      const hoy = hoyArgentina();
      return filas.map((f) => aResumen(f, hoy));
    });
  }

  async obtener(id: string): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => aDto(await this.buscar(tx, id)));
  }

  async crear(ctx: TenantContext, dto: Contrato): Promise<ContratoDto> {
    return this.db.withTenant(async (tx) => {
      await this.validar(tx, dto);
      const codigo = dto.codigo ?? (await this.siguienteCodigo(tx));
      await this.assertCodigoLibre(tx, codigo);
      const fila = await tx.alqContrato.create({
        data: { ...columnas(dto), codigo, tenantId: ctx.tenantId, estado: 'borrador', ...hijos(ctx.tenantId, dto) },
        include: INCLUIR,
      });
      return aDto(fila);
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
      const codigo = dto.codigo ?? actual.codigo;
      if (codigo !== actual.codigo) await this.assertCodigoLibre(tx, codigo, id);
      // Partes y tramos se reemplazan: en borrador no hay nada que dependa de ellos.
      await tx.alqContratoParte.deleteMany({ where: { contratoId: id } });
      await tx.alqTramo.deleteMany({ where: { contratoId: id } });
      const fila = await tx.alqContrato.update({
        where: { id },
        data: { ...columnas(dto), codigo, ...hijos(ctx.tenantId, dto) },
        include: INCLUIR,
      });
      return aDto(fila);
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
          where: { contratoId: id, anuladoEn: null, periodo: { gt: cambio.fecha.slice(0, 7) }, imputaciones: { none: {} } },
          data: { anuladoEn: new Date(), anuladoPorId: ctx.userId, motivoAnulacion: 'rescisión' },
        });
      }

      const fila = await tx.alqContrato.update({
        where: { id },
        data: { estado: cambio.estado, rescindidoEl: cambio.estado === 'rescindido' ? toDate(cambio.fecha) : null },
        include: INCLUIR,
      });
      return aDto(fila);
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

  /** El siguiente número libre, como en Gexion (los contratos se llaman 25, 26…). */
  private async siguienteCodigo(tx: Tx): Promise<string> {
    const codigos = await tx.alqContrato.findMany({ select: { codigo: true } });
    const max = codigos.reduce((m, c) => (/^\d+$/.test(c.codigo) ? Math.max(m, Number(c.codigo)) : m), 0);
    return String(max + 1);
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

function aDto(f: FilaContrato): ContratoDto {
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
    })),
  };
}
