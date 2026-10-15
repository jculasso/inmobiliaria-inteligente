import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TenantConfigSchema,
  type CorreccionAplicadaDto,
  type CorreccionTramoDto,
  type CorregirImporteTramo,
} from '@vacker/types';
import {
  desdeSugerido,
  esDelTramo,
  estadoDeLosMeses,
  generarPeriodo,
  mesLargo,
  mesesDelTramo,
  parteDeClave,
  planDeCorreccion,
  type MesDeCorreccion,
} from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate } from '../tablero/tablero.util';
import { aFilas, aParaGenerar } from './conceptos.service';
import { feriadosDe } from './feriados';
import { plata, registrarEventos } from './historial';
import { IMPUTACION_ACTIVA } from './imputacion-activa';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/**
 * La marca que lleva la clave de un concepto anulado por una corrección. La
 * clave única (regla 10) es lo que impide generar dos veces el mismo mes; el
 * concepto anulado la libera —conserva el prefijo de su parte, como
 * `MARCA_PARTE_LIQUIDADA`— para que el mes se vuelva a generar con el importe
 * nuevo, y queda a la vista, tachado, con el motivo.
 */
export const MARCA_CORREGIDO = '|corr:';

const CONTRATO = {
  partes: { select: { personaId: true, papel: true, porcentaje: true } },
  tramos: {
    select: { id: true, numero: true, desde: true, hasta: true, importe: true },
    orderBy: { numero: 'asc' as const },
  },
} satisfies Prisma.AlqContratoInclude;

/**
 * Corregir el importe de un tramo ya confirmado (reglas 108 a 110). Florencia
 * (Vacker), 15/10/2026: «luego de una indexación de un cuatrimestre las
 * partes negocian por menos … cambiar los importes en forma manual y que
 * luego tome estos importes cambiados como base para indexaciones futuras».
 *
 * Nada se borra: lo generado de los meses que cambian se anula con el motivo
 * (regla 19) y el mes se vuelve a generar con el importe nuevo, con la misma
 * generación de siempre (`generarPeriodo`). Lo cobrado y lo liquidado no se
 * toca nunca.
 *
 * Las consultas son las mismas corrija uno o doce meses (regla 111): el
 * contrato, sus conceptos del tramo, la configuración, los feriados, una
 * anulación, el tramo, un `createMany` y el historial.
 */
@Injectable()
export class CorreccionTramoService {
  constructor(private readonly db: TenantPrismaService) {}

  /** Lo que se muestra antes de corregir: cada mes del tramo y desde cuál se propone. */
  async preparar(id: string, numero: number): Promise<CorreccionTramoDto> {
    return this.db.withTenant(async (tx) => {
      const l = await this.leer(tx, id, numero);
      return {
        numero,
        desde: l.tramo.desde,
        hasta: l.tramo.hasta,
        importe: l.importe,
        meses: l.meses,
        desdeSugerido: desdeSugerido(l.meses),
      };
    });
  }

  async corregir(
    ctx: TenantContext,
    id: string,
    numero: number,
    dto: CorregirImporteTramo,
  ): Promise<CorreccionAplicadaDto> {
    return this.db.withTenant(async (tx) => {
      const l = await this.leer(tx, id, numero);
      const importe = Math.round(dto.importe * 100) / 100;
      if (importe === l.importe)
        throw new BadRequestException(`El tramo ${numero} ya tiene ese importe.`);
      if (!l.meses.some((m) => m.periodo === dto.desde))
        throw new BadRequestException(
          `${capital(mesLargo(`${dto.desde}-01`))} no es un mes del tramo ${numero}.`,
        );

      const plan = planDeCorreccion(l.meses, dto.desde);
      const aAnular = l.conceptos.filter(
        (k) => k.anuladoEn == null && k.periodo != null && plan.regenerar.includes(k.periodo),
      );
      const motivo = `corrección del importe del tramo ${numero}: ${dto.motivo}`;
      if (aAnular.length) {
        // Una sola sentencia para todos: cada uno conserva su clave con la
        // marca y su propio id (la clave tiene que seguir siendo única). Las
        // condiciones repiten las de `estadoDeLosMeses` en la base: si alguien
        // cobró o liquidó algo mientras tanto, no se anula nada.
        const anulados = await tx.$executeRaw`
          UPDATE alq_concepto k
             SET anulado_en = now(),
                 anulado_por_id = ${ctx.userId}::uuid,
                 motivo_anulacion = ${motivo},
                 clave_generacion = k.clave_generacion || ${MARCA_CORREGIDO} || k.id::text,
                 updated_at = now()
           WHERE k.id IN (${Prisma.join(aAnular.map((k) => Prisma.sql`${k.id}::uuid`))})
             AND k.anulado_en IS NULL
             AND k.liquidacion_id IS NULL
             AND NOT EXISTS (
               SELECT 1
                 FROM alq_imputacion i
                 JOIN alq_cobro c ON c.id = i.cobro_id
                 JOIN alq_cobro r ON r.id = i.registrada_en_cobro_id
                WHERE i.concepto_id = k.id
                  AND c.anulado_en IS NULL
                  AND r.anulado_en IS NULL)`;
        if (anulados !== aAnular.length)
          throw new ConflictException(
            'Algo de estos meses se cobró o se liquidó mientras tanto. Recargá la página.',
          );
      }

      // `importe` en el where: si otra persona lo corrigió mientras tanto, no se pisa.
      const { count } = await tx.alqTramo.updateMany({
        where: { id: l.tramoId, importe: l.importe },
        data: { importe },
      });
      if (count === 0)
        throw new ConflictException('Otra persona acaba de cambiar este tramo. Recargá la página.');

      // Se vuelve a generar exactamente lo anulado: las mismas partes del mes,
      // con el tramo ya corregido. Lo que el mismo mes tenía de otro tramo (un
      // cambio a mitad de mes) no se tocó y la clave única lo saltea.
      const partes = new Set(aAnular.map((k) => parteDeClave(k.claveGeneracion)));
      if (partes.size) {
        const [tenant, feriados] = await Promise.all([
          tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { config: true } }),
          feriadosDe(tx, plan.regenerar),
        ]);
        const iva = TenantConfigSchema.parse(tenant.config ?? {}).ivaHonorariosPct;
        const corregido = {
          ...l.contrato,
          tramos: l.contrato.tramos.map((t) =>
            t.numero === numero ? { ...t, importe: new Prisma.Decimal(importe) } : t,
          ),
        };
        const filas = plan.regenerar.flatMap((periodo) =>
          aFilas(
            ctx.tenantId,
            id,
            generarPeriodo(aParaGenerar(corregido), periodo, iva, feriados).conceptos.filter((x) =>
              partes.has(parteDeClave(x.clave)),
            ),
          ),
        );
        if (filas.length) await tx.alqConcepto.createMany({ data: filas, skipDuplicates: true });
      }

      const moneda = l.contrato.moneda;
      const quedan = plan.quedan.map((m) => `${mesLargo(`${m.periodo}-01`)} (${ESTADO[m.estado]})`);
      await registrarEventos(tx, ctx, {
        entidad: 'tramo',
        entidadId: l.tramoId,
        contratoId: id,
        accion: 'edicion',
        resumen:
          `Corrigió el importe del tramo ${numero}: ${plata(l.importe, moneda)} → ${plata(importe, moneda)} desde ${mesLargo(`${dto.desde}-01`)}. Motivo: ${dto.motivo}` +
          (plan.regenerar.length
            ? `. Se volvió a generar ${plan.regenerar.map((p) => mesLargo(`${p}-01`)).join(', ')}`
            : '') +
          (quedan.length ? `. Quedaron como estaban: ${quedan.join(', ')}` : ''),
        detalle: {
          antes: l.importe,
          despues: importe,
          desde: dto.desde,
          motivo: dto.motivo,
          regenerados: plan.regenerar,
          quedan: plan.quedan.map((m) => ({ periodo: m.periodo, estado: m.estado })),
        },
      });
      return {
        numero,
        importeAnterior: l.importe,
        importe,
        desde: dto.desde,
        regenerados: plan.regenerar,
        quedan: plan.quedan,
      };
    });
  }

  /** El contrato, el tramo y el estado de cada uno de sus meses: dos consultas. */
  private async leer(tx: Tx, id: string, numero: number) {
    const contrato = await tx.alqContrato.findUnique({ where: { id }, include: CONTRATO });
    if (!contrato) throw new NotFoundException('Contrato no encontrado.');
    if (contrato.estado !== 'vigente')
      throw new BadRequestException('Solo se corrige el importe de un contrato vigente.');
    const t = contrato.tramos.find((x) => x.numero === numero);
    if (!t) throw new NotFoundException(`El contrato no tiene tramo ${numero}.`);
    if (t.importe == null)
      throw new BadRequestException(
        `El tramo ${numero} todavía no tiene importe: se confirma desde «A indexar».`,
      );
    const tramo = { desde: fromDate(t.desde)!, hasta: fromDate(t.hasta)! };
    const meses = mesesDelTramo(tramo, fromDate(contrato.administradoDesde));
    const filas = await tx.alqConcepto.findMany({
      where: {
        contratoId: id,
        periodo: { in: meses },
        claveGeneracion: { startsWith: `alq|${id}|` },
      },
      select: {
        id: true,
        periodo: true,
        claveGeneracion: true,
        anuladoEn: true,
        liquidacionId: true,
        _count: { select: { imputaciones: { where: IMPUTACION_ACTIVA } } },
      },
    });
    const conceptos = filas.filter((k) => esDelTramo(k.claveGeneracion, tramo));
    const estados: MesDeCorreccion[] = estadoDeLosMeses(
      meses,
      conceptos.map((k) => ({
        periodo: k.periodo,
        anulado: k.anuladoEn != null,
        cobrado: k._count.imputaciones > 0,
        liquidado: k.liquidacionId != null,
      })),
    );
    return {
      contrato,
      tramoId: t.id,
      tramo,
      importe: decToNum(t.importe),
      meses: estados,
      conceptos,
    };
  }
}

const ESTADO: Record<MesDeCorreccion['estado'], string> = {
  cobrado: 'cobrado',
  liquidado: 'liquidado',
  generado: 'generado',
  anulado: 'anulado',
  sin_generar: 'sin generar',
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
