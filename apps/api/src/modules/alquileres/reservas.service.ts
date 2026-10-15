import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ESTADOS_RESERVA_ABIERTOS,
  ESTADOS_RESERVA_CON_GARANTIAS,
  LIMITE_LISTA_CON_SONDA,
  NOMBRE_ESTADO_RESERVA,
  PASOS_RESERVA,
  TenantConfigSchema,
  reservaAbierta,
  retieneLaSena,
  type AccionEvento,
  type CambioEstadoReserva,
  type CobrarSena,
  type Contrato,
  type ContratoDto,
  type EntidadEvento,
  type EstadoReserva,
  type FiltroReservas,
  type Garantia,
  type GarantiaDto,
  type Reserva,
  type ReservaDelContratoDto,
  type ReservaDto,
  type ReservaResumenDto,
  type MonedaAlquiler,
} from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { bloquearReserva } from './candados';
import { ContratosService } from './contratos.service';
import { dia, nombresDeUsuarios, registrarEventos } from './historial';
import { nroRecibo } from './numeracion';
import {
  CONCEPTOS_DE_LA_SENA,
  assertSinReciboVigente,
  cobrarSena,
  retenerSena,
  senaADeposito,
  senaCobrada,
  senaDto,
  senaRetenida,
} from './sena';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const RESUMEN = {
  id: true,
  numero: true,
  estado: true,
  tipo: true,
  fecha: true,
  vence: true,
  senaImporte: true,
  senaMoneda: true,
  // La seña cobrada y su recibo (regla 169): en la misma consulta.
  conceptos: CONCEPTOS_DE_LA_SENA,
  propiedad: { select: { id: true, direccion: true, unidad: true } },
  partes: {
    where: { papel: 'inquilino' },
    select: { personaId: true, persona: { select: { nombre: true } } },
    orderBy: { persona: { nombre: 'asc' } },
  },
  contrato: { select: { id: true, codigo: true } },
} satisfies Prisma.AlqReservaSelect;

const FICHA = {
  ...RESUMEN,
  moneda: true,
  alquilerInicial: true,
  inicio: true,
  duracionMeses: true,
  ajuste: true,
  indice: true,
  periodicidadMeses: true,
  depositoImporte: true,
  depositoMoneda: true,
  obs: true,
  motivo: true,
  creadoPorId: true,
  createdAt: true,
  propiedad: { select: { id: true, direccion: true, unidad: true, ciudad: true } },
  partes: {
    select: { personaId: true, papel: true, persona: { select: { nombre: true } } },
    orderBy: { persona: { nombre: 'asc' } },
  },
  garantias: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AlqReservaSelect;

type FilaResumen = Prisma.AlqReservaGetPayload<{ select: typeof RESUMEN }>;
type FilaFicha = Prisma.AlqReservaGetPayload<{ select: typeof FICHA }>;

const unidad = (p: { direccion: string; unidad: string | null }) =>
  [p.direccion, p.unidad].filter(Boolean).join(' ');

/** Regla 155: otro pedido cambió la reserva entre que se leyó y se escribió. */
export const CAMBIO_EN_EL_MEDIO = 'La reserva cambió mientras tanto: recargá.';

/** Tope de la línea de tiempo de una reserva: sobra. */
const TOPE_HISTORIAL = 100;

/**
 * La reserva: la etapa antes del contrato (reglas 154 a 168; Florencia,
 * Vacker, 15/10/2026). Se reserva la propiedad con una seña, se estudian las
 * garantías y, si todo está bien, sale el contrato.
 *
 * Nada se borra: cambia de estado, y cada paso queda en `alq_evento`
 * (entidad `reserva`), que es la línea de tiempo de la ficha.
 */
@Injectable()
export class ReservasService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly contratos: ContratosService,
  ) {}

  /** Regla 164: las abiertas por defecto, todas, o un estado. Una consulta, con 5 o con 500. */
  async listar(filtro: FiltroReservas = 'abiertas'): Promise<ReservaResumenDto[]> {
    const where: Prisma.AlqReservaWhereInput =
      filtro === 'abiertas'
        ? { estado: { in: [...ESTADOS_RESERVA_ABIERTOS] } }
        : filtro === 'todas'
          ? {}
          : { estado: filtro };
    return this.db.withTenant(async (tx) =>
      (
        await tx.alqReserva.findMany({
          where,
          select: RESUMEN,
          orderBy: { numero: 'desc' },
          take: LIMITE_LISTA_CON_SONDA,
        })
      ).map(aResumen),
    );
  }

  /** La ficha: la reserva con sus partes y garantías, la línea de tiempo y quién la cargó. */
  async obtener(id: string): Promise<ReservaDto> {
    return this.db.withTenant(async (tx) => {
      const [r, historial] = await Promise.all([
        tx.alqReserva.findUnique({ where: { id }, select: FICHA }),
        tx.alqEvento.findMany({
          where: { entidad: 'reserva', entidadId: id },
          orderBy: { en: 'desc' },
          take: TOPE_HISTORIAL,
        }),
      ]);
      if (!r) throw new NotFoundException('La reserva no existe.');
      const nombres = await nombresDeUsuarios(tx, [r.creadoPorId]);
      return aDto(r, historial, nombres);
    });
  }

  async crear(ctx: TenantContext, dto: Reserva): Promise<ReservaDto> {
    const id = await this.db.withTenant(async (tx) => {
      const propiedad = await this.validar(tx, dto);
      await this.assertSinOtraAbierta(tx, dto.propiedadId, propiedad);
      const ultimo = await tx.alqReserva.aggregate({ _max: { numero: true } });
      const numero = (ultimo._max.numero ?? 0) + 1;
      const r = await tx.alqReserva.create({
        data: {
          ...columnas(dto),
          numero,
          tenantId: ctx.tenantId,
          creadoPorId: ctx.userId,
          partes: { create: partes(ctx.tenantId, dto) },
        },
        select: { id: true },
      });
      await evento(tx, ctx, r.id, 'alta', `Reserva ${numero}: ${unidad(propiedad)}, reservada`);
      return r.id;
    });
    return this.obtener(id);
  }

  /** Regla 158: los datos se editan mientras está abierta. */
  async actualizar(ctx: TenantContext, id: string, dto: Reserva): Promise<ReservaDto> {
    await this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      if (!reservaAbierta(actual.estado as EstadoReserva))
        throw new BadRequestException(
          `La reserva está ${NOMBRE_ESTADO_RESERVA[actual.estado as EstadoReserva].toLowerCase()}: ya no se edita.`,
        );
      // Regla 169: la seña cobrada ya tiene recibo; cambiarla pide anularlo.
      const cobrada = senaCobrada(actual.conceptos);
      if (
        cobrada?.cobro &&
        (dto.senaImporte !== decToNum(cobrada.importe) || dto.senaMoneda !== cobrada.moneda)
      )
        throw new BadRequestException(
          `La seña ya tiene el recibo ${nroRecibo(cobrada.cobro.numero)}: para cambiarla, anulá ese recibo en Cobros.`,
        );
      const propiedad = await this.validar(tx, dto);
      if (dto.propiedadId !== actual.propiedadId)
        await this.assertSinOtraAbierta(tx, dto.propiedadId, propiedad);
      // Las partes se reemplazan, como en un contrato en borrador: nada depende de ellas.
      await tx.alqReservaParte.deleteMany({ where: { reservaId: id } });
      await tx.alqReserva.update({
        where: { id },
        data: { ...columnas(dto), partes: { create: partes(ctx.tenantId, dto) } },
      });
      await evento(tx, ctx, id, 'edicion', `Reserva ${actual.numero}: datos editados`);
    });
    return this.obtener(id);
  }

  /**
   * Regla 155: los pasos de la reserva, y ningún otro. `convertida` no pasa
   * por acá: llega al guardar el contrato (regla 159).
   */
  async cambiarEstado(
    ctx: TenantContext,
    id: string,
    cambio: CambioEstadoReserva,
    hoy = hoyArgentina(),
  ): Promise<ReservaDto> {
    await this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      const desde = actual.estado as EstadoReserva;
      if (!PASOS_RESERVA[desde].includes(cambio.estado))
        throw new BadRequestException(
          `Una reserva ${NOMBRE_ESTADO_RESERVA[desde].toLowerCase()} no pasa a ${NOMBRE_ESTADO_RESERVA[cambio.estado].toLowerCase()}.`,
        );
      if (cambio.estado === 'aprobada') await this.assertGarantiasAprobadas(tx, id);
      const vence = fromDate(actual.vence)!;
      if (cambio.estado === 'vencida' && hoy <= vence)
        throw new BadRequestException(
          `La reserva vence el ${dia(vence)}: todavía no venció. Si se cae antes, anulala con el motivo.`,
        );
      // Regla 172: anular es deshacer un error. Si la seña tiene recibo, primero el recibo.
      if (cambio.estado === 'anulada') assertSinReciboVigente(actual.conceptos);
      const motivo = 'motivo' in cambio ? cambio.motivo : null;
      // Regla 171: si se cae (rechazada, vencida o no se presentó a firmar),
      // la seña cobrada se retiene y se le entrega al propietario.
      let destino = '';
      const cobrada = senaCobrada(actual.conceptos);
      if (retieneLaSena(cambio.estado) && cobrada) {
        let propietarios = actual.partes
          .filter((p) => p.papel === 'propietario')
          .map((p) => p.personaId);
        const elegido = 'propietarioId' in cambio ? cambio.propietarioId : null;
        if (propietarios.length === 0 && elegido) {
          if (!(await tx.alqPersona.findUnique({ where: { id: elegido }, select: { id: true } })))
            throw new NotFoundException('El propietario elegido no existe.');
          await tx.alqReservaParte.create({
            data: {
              tenantId: ctx.tenantId,
              reservaId: id,
              personaId: elegido,
              papel: 'propietario',
            },
          });
          propietarios = [elegido];
        }
        const t = await tx.tenant.findUniqueOrThrow({
          where: { id: ctx.tenantId },
          select: { config: true },
        });
        const config = TenantConfigSchema.parse(t.config ?? {});
        destino = await retenerSena(
          tx,
          ctx,
          cobrada,
          { id, numero: actual.numero, propiedad: unidad(actual.propiedad) },
          propietarios,
          { pct: config.honorariosSenaRetenidaPct, ivaPct: config.ivaHonorariosPct },
        );
      }
      // `estado: desde` en el where: con la fila bloqueada nadie la cambia en
      // el medio, pero si algún día se lee sin el candado, la transición no
      // se aplica sobre un estado que ya no es el que se validó (aprobada y
      // rechazada a la vez, o anulada con la seña recién cobrada: regla 172).
      const { count } = await tx.alqReserva.updateMany({
        where: { id, estado: desde },
        data: { estado: cambio.estado, ...(motivo ? { motivo } : {}) },
      });
      if (count === 0) throw new ConflictException(CAMBIO_EN_EL_MEDIO);
      await evento(
        tx,
        ctx,
        id,
        cambio.estado === 'anulada' ? 'anulacion' : 'estado',
        `Reserva ${actual.numero}: ${NOMBRE_ESTADO_RESERVA[cambio.estado].toLowerCase()}${motivo ? `. Motivo: ${motivo}` : ''}${destino ? `; ${destino}` : ''}`,
        motivo ? { motivo } : undefined,
      );
    });
    return this.obtener(id);
  }

  /**
   * Regla 169: cobrar la seña da un recibo de verdad —el de Cobros— a nombre
   * del interesado, y queda en su cuenta corriente. Una vez por reserva
   * mientras el recibo esté vigente; si se anula, se puede volver a cobrar.
   */
  async cobrarSena(ctx: TenantContext, id: string, pago: CobrarSena): Promise<ReservaDto> {
    await this.db.withTenant(async (tx) => {
      const r = await this.buscar(tx, id);
      if (!reservaAbierta(r.estado as EstadoReserva))
        throw new BadRequestException(
          `La reserva está ${NOMBRE_ESTADO_RESERVA[r.estado as EstadoReserva].toLowerCase()}: la seña se cobra con la reserva abierta.`,
        );
      if (r.senaImporte == null)
        throw new BadRequestException('La reserva no tiene seña: cargá el importe primero.');
      const ya = senaCobrada(r.conceptos);
      if (ya?.cobro)
        throw new ConflictException(`La seña ya se cobró: recibo ${nroRecibo(ya.cobro.numero)}.`);
      const interesados = r.partes.filter((p) => p.papel === 'inquilino').map((p) => p.personaId);
      const personaId = pago.personaId ?? interesados[0];
      if (!personaId || !interesados.includes(personaId))
        throw new BadRequestException('La seña la paga un interesado de la reserva.');
      await cobrarSena(
        tx,
        ctx,
        {
          id,
          numero: r.numero,
          importe: decToNum(r.senaImporte),
          moneda: (r.senaMoneda ?? 'ARS') as MonedaAlquiler,
          propiedad: unidad(r.propiedad),
        },
        { personaId, fecha: pago.fecha, medio: pago.medio, obs: pago.obs },
      );
    });
    return this.obtener(id);
  }

  /**
   * Regla 157: el estudio de garantías, con el mismo modelo e informe que las
   * del contrato. Se guarda la lista entera, solo antes de aprobar.
   */
  async guardarGarantias(
    ctx: TenantContext,
    id: string,
    garantias: Garantia[],
  ): Promise<ReservaDto> {
    await this.db.withTenant(async (tx) => {
      const actual = await this.buscar(tx, id);
      if (!(ESTADOS_RESERVA_CON_GARANTIAS as readonly string[]).includes(actual.estado))
        throw new BadRequestException(
          `La reserva está ${NOMBRE_ESTADO_RESERVA[actual.estado as EstadoReserva].toLowerCase()}: las garantías se cargan antes de aprobarla.`,
        );
      await tx.alqGarantia.deleteMany({ where: { reservaId: id } });
      if (garantias.length)
        await tx.alqGarantia.createMany({
          data: garantias.map((g) => ({
            ...g,
            aprobadaEl: toDate(g.aprobadaEl),
            tenantId: ctx.tenantId,
            reservaId: id,
          })),
        });
      await evento(
        tx,
        ctx,
        id,
        'edicion',
        `Reserva ${actual.numero}, garantías: ${garantias.length ? garantias.map((g) => `${g.tipo}${g.garante ? ` (${g.garante})` : ''} ${g.estado}`).join(', ') : 'ninguna'}`,
      );
    });
    return this.obtener(id);
  }

  /**
   * Regla 159: el contrato que sale de una reserva aprobada. En UNA
   * transacción —la del alta del contrato—: el contrato en borrador, la
   * reserva convertida y vinculada, y las garantías aprobadas copiadas al
   * contrato. Si algo falla, no queda nada a medias.
   *
   * Se copian y no se mueven: «Garantías» del contrato se guarda entera
   * (borra y vuelve a crear las suyas), y las de la reserva son el registro
   * del estudio.
   */
  async convertir(ctx: TenantContext, id: string, dto: Contrato): Promise<ContratoDto> {
    return this.contratos.crear(ctx, dto, async (tx, contratoId, codigo) => {
      // Antes de leer la seña: si se cobra mientras se convierte, el contrato
      // nacería sin el depósito que la seña tenía que pasar a ser (regla 170).
      await bloquearReserva(tx, id);
      const r = await tx.alqReserva.findUnique({
        where: { id },
        select: {
          numero: true,
          estado: true,
          propiedadId: true,
          conceptos: CONCEPTOS_DE_LA_SENA,
        },
      });
      if (!r) throw new NotFoundException('La reserva no existe.');
      if (r.estado !== 'aprobada')
        throw new ConflictException(
          `La reserva ${r.numero} está ${NOMBRE_ESTADO_RESERVA[r.estado as EstadoReserva].toLowerCase()}: solo una aprobada se convierte en contrato.`,
        );
      if (r.propiedadId !== dto.propiedadId)
        throw new BadRequestException(
          `El contrato tiene que ser de la propiedad de la reserva ${r.numero}.`,
        );
      // `estado: 'aprobada'` también en el where: si otro pedido la convirtió
      // en el medio, no se pisa (y el índice único de `contrato_id` tampoco lo deja).
      const { count } = await tx.alqReserva.updateMany({
        where: { id, estado: 'aprobada' },
        data: { estado: 'convertida', contratoId },
      });
      if (!count) throw new ConflictException(`La reserva ${r.numero} ya se convirtió.`);
      const aprobadas = await tx.alqGarantia.findMany({
        where: { reservaId: id, estado: 'aprobada' },
        select: {
          tipo: true,
          personaId: true,
          garante: true,
          detalle: true,
          estado: true,
          aprobadaEl: true,
          obs: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (aprobadas.length)
        await tx.alqGarantia.createMany({
          data: aprobadas.map((g) => ({ ...g, tenantId: ctx.tenantId, contratoId })),
        });
      // Regla 170: la seña cobrada pasa a ser el depósito.
      const cobrada = senaCobrada(r.conceptos);
      const deposito = cobrada
        ? await senaADeposito(
            tx,
            ctx,
            cobrada,
            {
              id: contratoId,
              codigo,
              moneda: dto.moneda,
              depositoImporte: dto.depositoImporte,
              depositoMoneda: dto.depositoMoneda,
            },
            { id, numero: r.numero },
          )
        : null;
      await registrarEventos(tx, ctx, {
        entidad: 'reserva',
        entidadId: id,
        // También en el historial del contrato: de dónde salió.
        contratoId,
        accion: 'estado',
        resumen: `Reserva ${r.numero} convertida en el contrato ${codigo}${deposito ? `. ${deposito}` : ''}`,
      });
    });
  }

  /** Regla 161: la reserva de la que salió un contrato, con su seña. */
  async delContrato(contratoId: string): Promise<ReservaDelContratoDto> {
    return this.db.withTenant(async (tx) => {
      const r = await tx.alqReserva.findUnique({
        where: { contratoId },
        select: {
          id: true,
          numero: true,
          senaImporte: true,
          senaMoneda: true,
          conceptos: CONCEPTOS_DE_LA_SENA,
        },
      });
      return {
        reserva: r ? { id: r.id, numero: r.numero, sena: senaDto(r, r.conceptos) } : null,
      };
    });
  }

  /**
   * La reserva para cambiarla: primero se bloquea la fila y después se lee.
   * Todos los que la usan escriben (editar, cambiar de estado, cobrar la seña,
   * guardar garantías), y cada uno decide según lo que lee: sin el candado,
   * dos cobros de la seña a la vez pasaban los dos por «¿ya se cobró?» antes
   * de que el primero guardara su recibo, y salían dos recibos (la clave del
   * concepto lleva el recibo, así que el índice único no los frenaba).
   */
  private async buscar(tx: Tx, id: string) {
    await bloquearReserva(tx, id);
    const r = await tx.alqReserva.findUnique({
      where: { id },
      // Una consulta con lo que miran todos los pasos: el estado, las partes
      // y la seña con su recibo (reglas 169 a 172).
      select: {
        numero: true,
        estado: true,
        propiedadId: true,
        vence: true,
        senaImporte: true,
        senaMoneda: true,
        propiedad: { select: { direccion: true, unidad: true } },
        partes: {
          select: { personaId: true, papel: true },
          orderBy: { persona: { nombre: 'asc' } },
        },
        conceptos: CONCEPTOS_DE_LA_SENA,
      },
    });
    if (!r) throw new NotFoundException('La reserva no existe.');
    return r;
  }

  /** La propiedad y las personas existen en ESTA inmobiliaria (RLS): dos consultas, con 1 o 20 partes. */
  private async validar(tx: Tx, dto: Reserva) {
    const ids = [...new Set(dto.partes.map((p) => p.personaId))];
    const [propiedad, personas] = await Promise.all([
      tx.alqPropiedad.findUnique({
        where: { id: dto.propiedadId },
        select: { direccion: true, unidad: true },
      }),
      ids.length ? tx.alqPersona.count({ where: { id: { in: ids } } }) : Promise.resolve(0),
    ]);
    if (!propiedad) throw new NotFoundException('Propiedad no encontrada.');
    if (personas !== ids.length) throw new NotFoundException('Alguna persona no existe.');
    return propiedad;
  }

  /**
   * Regla 156: una reserva abierta por propiedad. El índice único parcial de
   * la base lo garantiza igual; esto es para decirlo con nombre y número.
   */
  private async assertSinOtraAbierta(
    tx: Tx,
    propiedadId: string,
    propiedad: { direccion: string; unidad: string | null },
  ) {
    const otra = await tx.alqReserva.findFirst({
      where: { propiedadId, estado: { in: [...ESTADOS_RESERVA_ABIERTOS] } },
      select: { numero: true },
    });
    if (otra)
      throw new ConflictException(
        `${unidad(propiedad)} ya tiene abierta la reserva ${otra.numero}.`,
      );
  }

  /** Regla 157: al menos una aprobada y ninguna pendiente. */
  private async assertGarantiasAprobadas(tx: Tx, reservaId: string) {
    const garantias = await tx.alqGarantia.findMany({
      where: { reservaId },
      select: {
        estado: true,
        garante: true,
        tipo: true,
        personaId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const pendiente = garantias.find((g) => g.estado === 'pendiente');
    if (pendiente) {
      const persona = pendiente.personaId
        ? await tx.alqPersona.findUnique({
            where: { id: pendiente.personaId },
            select: { nombre: true },
          })
        : null;
      throw new BadRequestException(
        `Para aprobar, cada garantía tiene que tener su informe: falta el de ${pendiente.garante ?? persona?.nombre ?? `la garantía ${pendiente.tipo}`}.`,
      );
    }
    if (!garantias.some((g) => g.estado === 'aprobada'))
      throw new BadRequestException('Para aprobar hace falta al menos una garantía aprobada.');
  }
}

function evento(
  tx: Tx,
  ctx: TenantContext,
  reservaId: string,
  accion: AccionEvento,
  resumen: string,
  detalle?: Prisma.InputJsonValue,
) {
  const entidad: EntidadEvento = 'reserva';
  return registrarEventos(tx, ctx, { entidad, entidadId: reservaId, accion, resumen, detalle });
}

function columnas(dto: Reserva) {
  return {
    propiedadId: dto.propiedadId,
    fecha: toDate(dto.fecha)!,
    vence: toDate(dto.vence)!,
    senaImporte: dto.senaImporte,
    senaMoneda: dto.senaMoneda,
    tipo: dto.tipo,
    moneda: dto.moneda,
    alquilerInicial: dto.alquilerInicial,
    inicio: toDate(dto.inicio),
    duracionMeses: dto.duracionMeses,
    ajuste: dto.ajuste,
    indice: dto.indice,
    periodicidadMeses: dto.periodicidadMeses,
    depositoImporte: dto.depositoImporte,
    depositoMoneda: dto.depositoMoneda,
    obs: dto.obs,
  };
}

function partes(tenantId: string, dto: Reserva) {
  return dto.partes.map((p) => ({ tenantId, personaId: p.personaId, papel: p.papel }));
}

function aResumen(r: FilaResumen): ReservaResumenDto {
  return {
    id: r.id,
    numero: r.numero,
    estado: r.estado as EstadoReserva,
    tipo: r.tipo as ReservaResumenDto['tipo'],
    fecha: fromDate(r.fecha)!,
    vence: fromDate(r.vence)!,
    propiedad: r.propiedad,
    interesados: r.partes.map((p) => ({ id: p.personaId, nombre: p.persona.nombre })),
    sena: senaDto(r, r.conceptos),
    contrato: r.contrato,
  };
}

function aDto(
  r: FilaFicha,
  historial: {
    id: string;
    en: Date;
    usuarioNombre: string | null;
    entidad: string;
    accion: string;
    resumen: string;
  }[],
  nombres: Map<string, string>,
): ReservaDto {
  return {
    ...aResumen({
      ...r,
      partes: r.partes.filter((p) => p.papel === 'inquilino'),
    }),
    propiedad: r.propiedad,
    partes: r.partes.map((p) => ({
      personaId: p.personaId,
      nombre: p.persona.nombre,
      papel: p.papel as ReservaDto['partes'][number]['papel'],
    })),
    moneda: r.moneda as ReservaDto['moneda'],
    alquilerInicial: r.alquilerInicial == null ? null : decToNum(r.alquilerInicial),
    inicio: fromDate(r.inicio),
    duracionMeses: r.duracionMeses,
    ajuste: r.ajuste as ReservaDto['ajuste'],
    indice: r.indice as ReservaDto['indice'],
    periodicidadMeses: r.periodicidadMeses,
    depositoImporte: r.depositoImporte == null ? null : decToNum(r.depositoImporte),
    depositoMoneda: r.depositoMoneda as ReservaDto['depositoMoneda'],
    obs: r.obs,
    motivo: r.motivo,
    senaRetenida: senaRetenida(r.conceptos),
    registrado: {
      en: r.createdAt.toISOString(),
      por: r.creadoPorId ? (nombres.get(r.creadoPorId) ?? null) : null,
    },
    garantias: r.garantias.map((g): GarantiaDto => ({
      id: g.id,
      tipo: g.tipo as GarantiaDto['tipo'],
      personaId: g.personaId,
      garante: g.garante,
      detalle: g.detalle,
      estado: g.estado as GarantiaDto['estado'],
      aprobadaEl: fromDate(g.aprobadaEl),
      obs: g.obs,
    })),
    historial: historial.map((e) => ({
      id: e.id,
      en: e.en.toISOString(),
      usuario: e.usuarioNombre,
      entidad: e.entidad as EntidadEvento,
      accion: e.accion as AccionEvento,
      resumen: e.resumen,
    })),
  };
}
