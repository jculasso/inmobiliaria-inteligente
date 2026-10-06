import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
import { parteDeClave, proponerLiquidacion, redondear2, type ConceptoALiquidar, type PropuestaLiquidacion } from '@vacker/domain';
import { z } from 'zod';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { IMPUTACION_ACTIVA } from './imputacion-activa';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** Lo que un propietario puede deber por fuera de los honorarios: los gastos sueltos (regla 14). */
const SUELTOS = ['expensa', 'impuesto', 'servicio', 'reparacion', 'otro'];

/** El detalle que se guarda en la liquidación, tal como se liquidó. */
const DetalleSchema = z.object({ aPagar: z.array(LineaLiquidacionSchema), aDescontar: z.array(LineaLiquidacionSchema) });

interface Pendiente extends ConceptoALiquidar {
  personaId: string;
  moneda: string;
  contrato: ContratoDeLiquidacion;
  descripcion: string;
}

/** Los contratos de un grupo de líneas, una vez cada uno y en el orden en que aparecen. */
function contratosDe(lineas: { contrato: ContratoDeLiquidacion | null }[]): ContratoDeLiquidacion[] {
  const vistos = new Map<string, ContratoDeLiquidacion>();
  for (const l of lineas) if (l.contrato && !vistos.has(l.contrato.id)) vistos.set(l.contrato.id, l.contrato);
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

  async preparar(personaId: string, moneda: MonedaAlquiler, fecha: string, excluidos: string[] = []): Promise<PreparacionLiquidacionDto> {
    return this.db.withTenant(async (tx) => {
      const persona = await this.persona(tx, personaId);
      const fuera = new Set(excluidos);
      const pendientes = (await this.pendientesDe(tx, { personaId, moneda })).filter((c) => !fuera.has(c.id));
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
      for (const c of todos) grupos.set(`${c.personaId}|${c.moneda}`, [...(grupos.get(`${c.personaId}|${c.moneda}`) ?? []), c]);
      const nombres = new Map(
        (await tx.alqPersona.findMany({ where: { id: { in: [...new Set(todos.map((c) => c.personaId))] } }, select: { id: true, nombre: true } })).map((p) => [p.id, p]),
      );
      const filas: PendienteLiquidarDto[] = [];
      for (const [clave, conceptos] of grupos) {
        const [personaId, moneda] = clave.split('|') as [string, MonedaAlquiler];
        const p = proponerLiquidacion(conceptos, pagadas);
        const enEspera = redondear2(p.enEspera.filter((c) => c.sentido === 'a_pagar').reduce((s, c) => s + c.saldo, 0));
        if (p.aPagar.length === 0 && enEspera === 0) continue;
        filas.push({ persona: nombres.get(personaId)!, moneda, neto: p.aPagar.length ? p.neto : 0, enEspera, contratos: contratosDe(conceptos) });
      }
      return filas.sort((a, b) => b.neto - a.neto);
    });
  }

  async liquidar(ctx: TenantContext, dto: Liquidacion): Promise<LiquidacionDto> {
    return this.db.withTenant(async (tx) => {
      await this.persona(tx, dto.personaId);
      const excluidos = new Set(dto.excluidos);
      const pendientes = (await this.pendientesDe(tx, { personaId: dto.personaId, moneda: dto.moneda })).filter((c) => !excluidos.has(c.id));
      const p = proponerLiquidacion(pendientes, await this.partesPagadas(tx, pendientes));
      if (p.aPagar.length === 0) throw new BadRequestException('No hay nada para liquidarle: lo suyo espera a que paguen los inquilinos.');
      if (p.neto < 0) {
        throw new BadRequestException('Lo que se descuenta supera lo que se le paga. Dejá algún descuento para la próxima liquidación.');
      }
      const detalle = lineas(p, pendientes);
      const ids = [...p.aPagar, ...p.aDescontar].map((c) => c.id);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId} || ':alq_liquidacion'))`;
      const ultimo = await tx.alqLiquidacion.aggregate({ _max: { numero: true } });
      const liq = await tx.alqLiquidacion.create({
        data: {
          tenantId: ctx.tenantId,
          numero: (ultimo._max.numero ?? 0) + 1,
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
      if (count !== ids.length) throw new ConflictException('Algo de esta liquidación cambió mientras tanto. Recargá la página.');
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
          contratos: detalle.success ? contratosDe([...detalle.data.aPagar, ...detalle.data.aDescontar]) : [],
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
        throw existe ? new ConflictException('La liquidación ya está anulada.') : new NotFoundException('La liquidación no existe.');
      }
      await tx.alqConcepto.updateMany({ where: { liquidacionId: id }, data: { liquidacionId: null } });
      return this.obtenerEn(tx, id);
    });
  }

  private async obtenerEn(tx: Tx, id: string): Promise<LiquidacionDto> {
    const l = await tx.alqLiquidacion.findUnique({ where: { id }, include: { persona: { select: { id: true, nombre: true } } } });
    if (!l) throw new NotFoundException('La liquidación no existe.');
    const detalle = DetalleSchema.parse(l.detalle);
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
      anulado: l.anuladoEn ? { en: l.anuladoEn.toISOString(), motivo: l.motivoAnulacion ?? '' } : null,
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
  private async pendientesDe(tx: Tx, filtro: { personaId?: string; moneda?: MonedaAlquiler }): Promise<Pendiente[]> {
    const filas = await tx.alqConcepto.findMany({
      where: {
        ...filtro,
        anuladoEn: null,
        liquidacionId: null,
        contratoId: { not: null },
        OR: [{ sentido: 'a_pagar' }, { sentido: 'a_cobrar', tipo: { in: ['honorarios', ...SUELTOS] } }],
      },
      include: {
        // La propiedad y los inquilinos viajan en la misma consulta: la
        // liquidación los muestra en cada línea y no cuesta un viaje más.
        contrato: {
          select: {
            id: true,
            codigo: true,
            pagoGarantizado: true,
            propiedad: { select: { direccion: true, unidad: true } },
            partes: { where: { papel: { in: ['propietario', 'inquilino'] } }, select: { personaId: true, papel: true, persona: { select: { nombre: true } } } },
          },
        },
        imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
      },
      orderBy: [{ vencimiento: 'asc' }, { createdAt: 'asc' }],
    });
    return filas
      .filter((k) => k.contrato?.partes.some((p) => p.papel === 'propietario' && p.personaId === k.personaId))
      .map((k) => ({
        id: k.id,
        personaId: k.personaId,
        moneda: k.moneda,
        tipo: k.tipo,
        sentido: k.sentido as 'a_cobrar' | 'a_pagar',
        saldo: redondear2(decToNum(k.importe) - k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0)),
        clave: k.claveGeneracion,
        pagoGarantizado: k.contrato!.pagoGarantizado,
        contrato: {
          id: k.contrato!.id,
          codigo: k.contrato!.codigo,
          propiedad: [k.contrato!.propiedad.direccion, k.contrato!.propiedad.unidad].filter(Boolean).join(' '),
          inquilinos: k.contrato!.partes.filter((p) => p.papel === 'inquilino').map((p) => p.persona.nombre),
        },
        descripcion: k.descripcion ?? k.tipo,
      }))
      .filter((k) => k.saldo > 0);
  }

  /**
   * Las partes del mes que el inquilino ya pagó del todo (`parte#tipo`). Una
   * consulta para todos los contratos en juego.
   */
  private async partesPagadas(tx: Tx, pendientes: Pendiente[]): Promise<Set<string>> {
    const contratos = [...new Set(pendientes.filter((c) => c.sentido === 'a_pagar' && parteDeClave(c.clave)).map((c) => c.contrato.id))];
    if (contratos.length === 0) return new Set();
    const delInquilino = await tx.alqConcepto.findMany({
      where: { contratoId: { in: contratos }, sentido: 'a_cobrar', tipo: { in: ['alquiler', 'iva'] }, anuladoEn: null, claveGeneracion: { not: null } },
      select: { tipo: true, importe: true, claveGeneracion: true, imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } } },
    });
    const pagadas = new Set<string>();
    for (const k of delInquilino) {
      const saldo = redondear2(decToNum(k.importe) - k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0));
      if (saldo <= 0) pagadas.add(`${parteDeClave(k.claveGeneracion)}#${k.tipo}`);
    }
    return pagadas;
  }
}

function lineas(p: PropuestaLiquidacion, pendientes: Pendiente[]): { aPagar: LineaLiquidacion[]; aDescontar: LineaLiquidacion[]; enEspera: LineaLiquidacion[] } {
  const porId = new Map(pendientes.map((c) => [c.id, c]));
  const linea = (c: ConceptoALiquidar): LineaLiquidacion => {
    const k = porId.get(c.id)!;
    return { conceptoId: k.id, contrato: k.contrato, tipo: k.tipo as TipoConcepto, descripcion: k.descripcion, importe: k.saldo };
  };
  return { aPagar: p.aPagar.map(linea), aDescontar: p.aDescontar.map(linea), enEspera: p.enEspera.map(linea) };
}
