import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  LineaLiquidacionSchema,
  type ContratoDeLiquidacion,
  type LineaLiquidacion,
  type Liquidacion,
  type LiquidacionDto,
  type LiquidacionResumenDto,
  type MedioCobro,
  type MonedaAlquiler,
  type PendienteLiquidarDto,
  type PreparacionLiquidacionDto,
  type TipoConcepto,
} from '@vacker/types';
import {
  parteDeClave,
  proponerLiquidacion,
  redondear2,
  type ConceptoALiquidar,
  type PropuestaLiquidacion,
} from '@vacker/domain';
import { z } from 'zod';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { nombresDeUsuarios, plata, registrarEventos } from './historial';
import { IMPUTACION_ACTIVA } from './imputacion-activa';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** Lo que un propietario puede deber por fuera de los honorarios: los gastos sueltos (regla 14). */
const SUELTOS = [
  'expensa',
  'impuesto',
  'servicio',
  'reparacion',
  'otro',
  'comision',
  'informe',
  'deposito',
  'sellado',
];

/**
 * Marca en la clave de la parte que se separa al liquidar un pago parcial:
 * `<clave del concepto>|liq:<liquidación>`. Conserva el prefijo de la parte del
 * mes, así el bloqueo de anular un cobro ya liquidado la sigue viendo.
 */
const MARCA_PARTE_LIQUIDADA = '|liq:';

/** El detalle que se guarda en la liquidación, tal como se liquidó. */
const DetalleSchema = z.object({
  aPagar: z.array(LineaLiquidacionSchema),
  aDescontar: z.array(LineaLiquidacionSchema),
});

interface Pendiente extends ConceptoALiquidar {
  personaId: string;
  moneda: string;
  contrato: ContratoDeLiquidacion;
  descripcion: string;
}

/** Los contratos de un grupo de líneas, una vez cada uno y en el orden en que aparecen. */
function contratosDe(
  lineas: { contrato: ContratoDeLiquidacion | null }[],
): ContratoDeLiquidacion[] {
  const vistos = new Map<string, ContratoDeLiquidacion>();
  for (const l of lineas)
    if (l.contrato && !vistos.has(l.contrato.id)) vistos.set(l.contrato.id, l.contrato);
  return [...vistos.values()];
}

/**
 * Liquidaciones al propietario (spec alquileres-fase-1.md, reglas 20 a 23).
 *
 * Una liquidación marca sus conceptos con `liquidacionId`: un concepto
 * liquidado tiene saldo cero, y la marca con `liquidacionId: null` en el
 * `updateMany` impide liquidarlo dos veces aunque dos personas aprieten a la
 * vez (regla 20). Anular la suelta, y el detalle guardado conserva lo que
 * decía.
 */
@Injectable()
export class LiquidacionesService {
  constructor(private readonly db: TenantPrismaService) {}

  async preparar(
    personaId: string,
    moneda: MonedaAlquiler,
    fecha: string,
    excluidos: string[] = [],
  ): Promise<PreparacionLiquidacionDto> {
    return this.db.withTenant(async (tx) => {
      const persona = await this.persona(tx, personaId);
      const fuera = new Set(excluidos);
      const pendientes = (await this.pendientesDe(tx, { personaId, moneda })).filter(
        (c) => !fuera.has(c.id),
      );
      const p = proponerLiquidacion(pendientes, await this.partesPagadas(tx, pendientes));
      return { persona, moneda, fecha, ...lineas(p, pendientes), neto: p.neto };
    });
  }

  /** Todos los propietarios con algo para liquidar, para la bandeja y el tablero (regla 31). */
  async pendientes(): Promise<PendienteLiquidarDto[]> {
    return this.db.withTenant(async (tx) => {
      const todos = await this.pendientesDe(tx, {});
      const pagadas = await this.partesPagadas(tx, todos);
      const grupos = new Map<string, Pendiente[]>();
      for (const c of todos)
        grupos.set(`${c.personaId}|${c.moneda}`, [
          ...(grupos.get(`${c.personaId}|${c.moneda}`) ?? []),
          c,
        ]);
      const nombres = new Map(
        (
          await tx.alqPersona.findMany({
            where: { id: { in: [...new Set(todos.map((c) => c.personaId))] } },
            select: { id: true, nombre: true },
          })
        ).map((p) => [p.id, p]),
      );
      const filas: PendienteLiquidarDto[] = [];
      for (const [clave, conceptos] of grupos) {
        const [personaId, moneda] = clave.split('|') as [string, MonedaAlquiler];
        const p = proponerLiquidacion(conceptos, pagadas);
        const enEspera = redondear2(
          p.enEspera.filter((c) => c.sentido === 'a_pagar').reduce((s, c) => s + c.saldo, 0),
        );
        if (p.aPagar.length === 0 && enEspera === 0) continue;
        filas.push({
          persona: nombres.get(personaId)!,
          moneda,
          neto: p.aPagar.length ? p.neto : 0,
          enEspera,
          contratos: contratosDe(conceptos),
        });
      }
      return filas.sort((a, b) => b.neto - a.neto);
    });
  }

  async liquidar(ctx: TenantContext, dto: Liquidacion): Promise<LiquidacionDto> {
    return this.db.withTenant(async (tx) => {
      await this.persona(tx, dto.personaId);
      const excluidos = new Set(dto.excluidos);
      const pendientes = (
        await this.pendientesDe(tx, { personaId: dto.personaId, moneda: dto.moneda })
      ).filter((c) => !excluidos.has(c.id));
      const p = proponerLiquidacion(pendientes, await this.partesPagadas(tx, pendientes));
      if (p.aPagar.length === 0)
        throw new BadRequestException(
          'No hay nada para liquidarle: lo suyo espera a que paguen los inquilinos.',
        );
      if (p.neto < 0) {
        throw new BadRequestException(
          'Lo que se descuenta supera lo que se le paga. Dejá algún descuento para la próxima liquidación.',
        );
      }
      const detalle = lineas(p, pendientes);
      const enJuego = [...p.aPagar, ...p.aDescontar];
      const ids = enJuego.filter((c) => !c.parcial).map((c) => c.id);
      const parciales = enJuego.filter((c) => c.parcial);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId} || ':alq_liquidacion'))`;
      const ultimo = await tx.alqLiquidacion.aggregate({ _max: { numero: true } });
      const numero = (ultimo._max.numero ?? 0) + 1;
      const liq = await tx.alqLiquidacion.create({
        data: {
          tenantId: ctx.tenantId,
          numero,
          personaId: dto.personaId,
          periodo: dto.fecha.slice(0, 7),
          moneda: dto.moneda,
          neto: p.neto,
          fecha: toDate(dto.fecha)!,
          medio: dto.medio,
          detalle: { aPagar: detalle.aPagar, aDescontar: detalle.aDescontar },
          creadoPorId: ctx.userId,
        },
        select: { id: true },
      });
      const { count } = await tx.alqConcepto.updateMany({
        where: { id: { in: ids }, liquidacionId: null, anuladoEn: null },
        data: { liquidacionId: liq.id },
      });
      // Si no se marcaron todos, alguien liquidó o anuló algo mientras tanto:
      // la excepción deshace la transacción entera, número incluido.
      if (count !== ids.length)
        throw new ConflictException(
          'Algo de esta liquidación cambió mientras tanto. Recargá la página.',
        );
      if (parciales.length) await this.separarParciales(tx, ctx, liq.id, parciales);
      const contratos = contratosDe([...detalle.aPagar, ...detalle.aDescontar]);
      await registrarEventos(tx, ctx, [
        {
          entidad: 'liquidacion',
          entidadId: liq.id,
          personaId: dto.personaId,
          accion: 'alta',
          resumen: `Liquidación ${String(numero).padStart(6, '0')} por ${plata(p.neto, dto.moneda)}`,
          detalle: { contratos: contratos.map((c) => c.id) },
        },
        // Y una línea en el historial de cada contrato que entra en ella.
        ...contratos.map((c) => ({
          entidad: 'liquidacion' as const,
          entidadId: liq.id,
          contratoId: c.id,
          accion: 'alta' as const,
          resumen: `Liquidado al propietario en la liquidación ${String(numero).padStart(6, '0')}`,
        })),
      ]);
      return this.obtenerEn(tx, liq.id);
    });
  }

  async obtener(id: string): Promise<LiquidacionDto> {
    return this.db.withTenant((tx) => this.obtenerEn(tx, id));
  }

  async listar(personaId?: string): Promise<LiquidacionResumenDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqLiquidacion.findMany({
        where: personaId ? { personaId } : {},
        include: { persona: { select: { id: true, nombre: true } } },
        orderBy: { numero: 'desc' },
        take: LIMITE_LISTA_CON_SONDA,
      });
      const nombres = await nombresDeUsuarios(
        tx,
        filas.map((l) => l.creadoPorId),
      );
      return filas.map((l) => {
        // El detalle guardado dice qué propiedades se liquidaron; si no se
        // puede leer, la fila se muestra igual, sin ellas.
        const detalle = DetalleSchema.safeParse(l.detalle);
        return {
          id: l.id,
          numero: l.numero,
          persona: l.persona,
          fecha: fromDate(l.fecha)!,
          moneda: l.moneda as MonedaAlquiler,
          neto: decToNum(l.neto),
          anulado: l.anuladoEn != null,
          registradoPor: l.creadoPorId ? (nombres.get(l.creadoPorId) ?? null) : null,
          contratos: detalle.success
            ? contratosDe([...detalle.data.aPagar, ...detalle.data.aDescontar])
            : [],
        };
      });
    });
  }

  /** Regla 19: anular suelta los conceptos para que se puedan liquidar de nuevo. El detalle queda. */
  async anular(ctx: TenantContext, id: string, motivo: string): Promise<LiquidacionDto> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqLiquidacion.updateMany({
        where: { id, anuladoEn: null },
        data: { anuladoEn: new Date(), anuladoPorId: ctx.userId, motivoAnulacion: motivo },
      });
      if (count === 0) {
        const existe = await tx.alqLiquidacion.findUnique({ where: { id }, select: { id: true } });
        throw existe
          ? new ConflictException('La liquidación ya está anulada.')
          : new NotFoundException('La liquidación no existe.');
      }
      await this.unirParciales(tx, id);
      await tx.alqConcepto.updateMany({
        where: { liquidacionId: id },
        data: { liquidacionId: null },
      });
      const l = await this.obtenerEn(tx, id);
      await registrarEventos(tx, ctx, {
        entidad: 'liquidacion',
        entidadId: id,
        personaId: l.persona.id,
        accion: 'anulacion',
        resumen: `Liquidación ${String(l.numero).padStart(6, '0')} anulada: ${motivo}`,
      });
      return l;
    });
  }

  /**
   * Regla 22, pago parcial: de cada concepto del que entra solo una parte, esa
   * parte se separa en un concepto nuevo ya liquidado (enlazado por
   * `origenId`) y el original queda con el resto, en espera. Dos consultas
   * para todos, no dos por concepto.
   */
  private async separarParciales(
    tx: Tx,
    ctx: TenantContext,
    liquidacionId: string,
    parciales: ConceptoALiquidar[],
  ): Promise<void> {
    const originales = await tx.alqConcepto.findMany({
      where: { id: { in: parciales.map((c) => c.id) } },
    });
    const porId = new Map(originales.map((k) => [k.id, k]));
    await tx.alqConcepto.createMany({
      data: parciales.map((c) => {
        const k = porId.get(c.id)!;
        return {
          tenantId: k.tenantId,
          contratoId: k.contratoId,
          personaId: k.personaId,
          tipo: k.tipo,
          sentido: k.sentido,
          moneda: k.moneda,
          periodo: k.periodo,
          vencimiento: k.vencimiento,
          importe: c.saldo,
          liquidacionId,
          origenId: k.id,
          descripcion: `${k.descripcion ?? k.tipo} · parte cobrada`,
          claveGeneracion: `${k.claveGeneracion}${MARCA_PARTE_LIQUIDADA}${liquidacionId}`,
          creadoPorId: ctx.userId,
        };
      }),
    });
    const filas = Prisma.join(
      parciales.map((c) => Prisma.sql`(${c.id}::uuid, ${c.saldo}::numeric)`),
    );
    const restados = await tx.$executeRaw`
      UPDATE alq_concepto k SET importe = k.importe - v.d, updated_at = now()
        FROM (VALUES ${filas}) AS v(id, d)
       WHERE k.id = v.id AND k.liquidacion_id IS NULL AND k.anulado_en IS NULL AND k.importe > v.d`;
    if (restados !== parciales.length)
      throw new ConflictException(
        'Algo de esta liquidación cambió mientras tanto. Recargá la página.',
      );
  }

  /** Al anular, cada parte separada por un pago parcial vuelve a su concepto original. */
  private async unirParciales(tx: Tx, liquidacionId: string): Promise<void> {
    const separadas = await tx.alqConcepto.findMany({
      where: { liquidacionId, claveGeneracion: { contains: MARCA_PARTE_LIQUIDADA } },
      select: { id: true, origenId: true, importe: true },
    });
    if (separadas.length === 0) return;
    // Si el resto ya entró en otra liquidación, devolverle esta parte la dejaría
    // descuadrada: primero se anula esa.
    const posterior = await tx.alqConcepto.findFirst({
      where: {
        id: { in: separadas.map((x) => x.origenId!) },
        liquidacionId: { not: null },
        liquidacion: { anuladoEn: null },
      },
      select: { liquidacion: { select: { numero: true } } },
    });
    if (posterior?.liquidacion)
      throw new BadRequestException(
        `El resto de lo que liquidó esta se liquidó después en la liquidación ${String(posterior.liquidacion.numero).padStart(6, '0')}: anulá esa primero.`,
      );
    const filas = Prisma.join(
      separadas.map((x) => Prisma.sql`(${x.origenId}::uuid, ${decToNum(x.importe)}::numeric)`),
    );
    await tx.$executeRaw`
      UPDATE alq_concepto k SET importe = k.importe + v.d, updated_at = now()
        FROM (VALUES ${filas}) AS v(id, d)
       WHERE k.id = v.id`;
    await tx.alqConcepto.deleteMany({ where: { id: { in: separadas.map((x) => x.id) } } });
  }

  private async obtenerEn(tx: Tx, id: string): Promise<LiquidacionDto> {
    const l = await tx.alqLiquidacion.findUnique({
      where: { id },
      include: { persona: { select: { id: true, nombre: true } } },
    });
    if (!l) throw new NotFoundException('La liquidación no existe.');
    const detalle = DetalleSchema.parse(l.detalle);
    const [nombres, cuenta] = await Promise.all([
      nombresDeUsuarios(tx, [l.creadoPorId, l.anuladoPorId]),
      // La cuenta a donde se le transfiere: la principal en esa moneda.
      tx.alqCuentaBancaria.findFirst({
        where: { personaId: l.personaId, moneda: l.moneda },
        orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        select: { banco: true, cbu: true, alias: true, titular: true },
      }),
    ]);
    return {
      id: l.id,
      numero: l.numero,
      persona: l.persona,
      fecha: fromDate(l.fecha)!,
      moneda: l.moneda as MonedaAlquiler,
      medio: l.medio as MedioCobro,
      aPagar: detalle.aPagar,
      aDescontar: detalle.aDescontar,
      neto: decToNum(l.neto),
      anulado: l.anuladoEn
        ? {
            en: l.anuladoEn.toISOString(),
            motivo: l.motivoAnulacion ?? '',
            por: l.anuladoPorId ? (nombres.get(l.anuladoPorId) ?? null) : null,
          }
        : null,
      registradoPor: l.creadoPorId ? (nombres.get(l.creadoPorId) ?? null) : null,
      cuentaDestino: cuenta,
    };
  }

  private async persona(tx: Tx, id: string): Promise<{ id: string; nombre: string }> {
    const p = await tx.alqPersona.findUnique({ where: { id }, select: { id: true, nombre: true } });
    if (!p) throw new NotFoundException('La persona no existe.');
    return p;
  }

  /**
   * Lo pendiente de los propietarios, en su papel de propietarios: solo de
   * contratos donde la persona es propietaria. Así, alguien que además alquila
   * otra propiedad no ve descontado su propio alquiler.
   */
  private async pendientesDe(
    tx: Tx,
    filtro: { personaId?: string; moneda?: MonedaAlquiler },
  ): Promise<Pendiente[]> {
    // Primero, en la base, solo lo que importa: de un propietario EN su
    // contrato y con saldo. Antes se traía todo lo no liquidado —con los
    // gastos de los inquilinos, que nunca se liquidan y se acumulan para
    // siempre— y se filtraba acá (revisión de performance del 6/10/2026).
    const tipos = ['honorarios', ...SUELTOS];
    const ids = (
      await tx.$queryRaw<{ id: string }[]>`
        SELECT k.id FROM alq_concepto k
         WHERE k.anulado_en IS NULL AND k.liquidacion_id IS NULL AND k.contrato_id IS NOT NULL
           AND (k.sentido = 'a_pagar' OR (k.sentido = 'a_cobrar' AND k.tipo = ANY(${tipos})))
           ${filtro.personaId ? Prisma.sql`AND k.persona_id = ${filtro.personaId}::uuid` : Prisma.empty}
           ${filtro.moneda ? Prisma.sql`AND k.moneda = ${filtro.moneda}` : Prisma.empty}
           AND EXISTS (SELECT 1 FROM alq_contrato_parte pp
                        WHERE pp.contrato_id = k.contrato_id AND pp.persona_id = k.persona_id AND pp.papel = 'propietario')
           AND k.importe > COALESCE((
                 SELECT SUM(im.importe) FROM alq_imputacion im
                   JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
                   JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
                  WHERE im.concepto_id = k.id), 0)`
    ).map((r) => r.id);
    if (ids.length === 0) return [];
    const filas = await tx.alqConcepto.findMany({
      where: { id: { in: ids } },
      include: {
        // La propiedad y los inquilinos viajan en la misma consulta: la
        // liquidación los muestra en cada línea y no cuesta un viaje más.
        contrato: {
          select: {
            id: true,
            codigo: true,
            pagoGarantizado: true,
            propiedad: { select: { direccion: true, unidad: true } },
            partes: {
              where: { papel: { in: ['propietario', 'inquilino'] } },
              select: { personaId: true, papel: true, persona: { select: { nombre: true } } },
            },
          },
        },
        imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
      },
      orderBy: [{ vencimiento: 'asc' }, { createdAt: 'asc' }],
    });
    // Lo que ya se le liquidó de cada uno por pagos parciales: las partes
    // separadas al liquidar (regla 22), enlazadas por `origenId`.
    const separadas = await tx.alqConcepto.findMany({
      where: { origenId: { in: ids }, claveGeneracion: { contains: MARCA_PARTE_LIQUIDADA } },
      select: { origenId: true, importe: true },
    });
    const yaLiquidado = new Map<string, number>();
    for (const x of separadas)
      yaLiquidado.set(x.origenId!, (yaLiquidado.get(x.origenId!) ?? 0) + decToNum(x.importe));
    return filas
      .filter((k) =>
        k.contrato?.partes.some((p) => p.papel === 'propietario' && p.personaId === k.personaId),
      )
      .map((k) => ({
        yaLiquidado: redondear2(yaLiquidado.get(k.id) ?? 0),
        id: k.id,
        personaId: k.personaId,
        moneda: k.moneda,
        tipo: k.tipo,
        sentido: k.sentido as 'a_cobrar' | 'a_pagar',
        saldo: redondear2(
          decToNum(k.importe) - k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0),
        ),
        clave: k.claveGeneracion,
        pagoGarantizado: k.contrato!.pagoGarantizado,
        contrato: {
          id: k.contrato!.id,
          codigo: k.contrato!.codigo,
          propiedad: [k.contrato!.propiedad.direccion, k.contrato!.propiedad.unidad]
            .filter(Boolean)
            .join(' '),
          inquilinos: k
            .contrato!.partes.filter((p) => p.papel === 'inquilino')
            .map((p) => p.persona.nombre),
        },
        descripcion: k.descripcion ?? k.tipo,
      }))
      .filter((k) => k.saldo > 0);
  }

  /**
   * Qué fracción de cada parte del mes ya pagó el inquilino (`parte#tipo` → 0
   * a 1): lo que se le libera al propietario (regla 22). Una consulta para
   * todos los contratos en juego.
   */
  private async partesPagadas(tx: Tx, pendientes: Pendiente[]): Promise<Map<string, number>> {
    const contratos = [
      ...new Set(
        pendientes
          .filter((c) => c.sentido === 'a_pagar' && parteDeClave(c.clave))
          .map((c) => c.contrato.id),
      ),
    ];
    if (contratos.length === 0) return new Map();
    // Solo los meses en juego: antes venían todos los alquileres de la historia de esos contratos.
    const periodos = [
      ...new Set(
        pendientes.map((c) => parteDeClave(c.clave)?.split('|')[2]).filter((x): x is string => !!x),
      ),
    ];
    const delInquilino = await tx.alqConcepto.findMany({
      where: {
        contratoId: { in: contratos },
        periodo: { in: periodos },
        sentido: 'a_cobrar',
        tipo: { in: ['alquiler', 'iva'] },
        anuladoEn: null,
        claveGeneracion: { not: null },
      },
      select: {
        tipo: true,
        importe: true,
        claveGeneracion: true,
        imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
      },
    });
    const cobrado = new Map<string, number>();
    for (const k of delInquilino) {
      const importe = decToNum(k.importe);
      const pagado = k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0);
      const fraccion = importe <= 0 ? 1 : Math.min(1, Math.max(0, pagado / importe));
      cobrado.set(`${parteDeClave(k.claveGeneracion)}#${k.tipo}`, fraccion);
    }
    return cobrado;
  }
}

function lineas(
  p: PropuestaLiquidacion,
  pendientes: Pendiente[],
): { aPagar: LineaLiquidacion[]; aDescontar: LineaLiquidacion[]; enEspera: LineaLiquidacion[] } {
  const porId = new Map(pendientes.map((c) => [c.id, c]));
  const linea = (c: ConceptoALiquidar): LineaLiquidacion => {
    const k = porId.get(c.id)!;
    return {
      conceptoId: k.id,
      contrato: k.contrato,
      tipo: k.tipo as TipoConcepto,
      // Un pago parcial del inquilino libera una parte: la línea lo dice.
      descripcion: c.parcial ? `${k.descripcion} · parte cobrada` : k.descripcion,
      importe: c.saldo,
    };
  };
  return {
    aPagar: p.aPagar.map(linea),
    aDescontar: p.aDescontar.map(linea),
    enEspera: p.enEspera.map(linea),
  };
}
