import type { Prisma } from '@prisma/client';
import { TenantConfigSchema, type DiferenciasFinalesDto, type MonedaAlquiler } from '@vacker/types';
import {
  diferenciasDeLiquidacionFinal,
  mesLargo,
  resumenDeDiferencias,
  sumarDiasIso,
  vencimientoDeLaDiferencia,
  type EtapaLiquidacion,
} from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, toDate } from '../tablero/tablero.util';
import { aParaGenerar } from './conceptos.service';
import { nombreDelIndice } from './esperas-indice';
import { feriadosDe } from './feriados';
import { plata, registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** «octubre y noviembre de 2026», para el historial. */
function meses(periodos: string[]): string {
  const nombres = periodos.map((p) => mesLargo(`${p}-01`));
  return nombres.length <= 1
    ? (nombres[0] ?? '')
    : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

/**
 * Reglas 131 a 135 y 137: las diferencias de la liquidación final de un tramo
 * que se acaba de confirmar con `importe` (o que se va a confirmar, para la
 * vista previa: `crear: false`).
 *
 * Cuatro consultas, sean cuantos sean los meses cobrados como parcial: las
 * parciales y finales de ese tramo, el contrato con sus partes y tramos, la
 * configuración de la inmobiliaria y los feriados del vencimiento. Si el tramo
 * no tiene parciales, una sola y devuelve `null`. Las cuentas son de
 * @vacker/domain.
 *
 * `desde` (`AAAA-MM`): al corregir el importe de un tramo ya confirmado
 * (regla 108), solo los meses desde el elegido reciben otra final (regla 135).
 *
 * Corre dentro de la transacción de la confirmación: si algo falla, el tramo
 * tampoco queda confirmado.
 */
export async function diferenciasFinales(
  tx: Tx,
  p: {
    tenantId: string;
    contratoId: string;
    tramo: number;
    importe: number;
    hoy: string;
    crear: { ctx: TenantContext } | null;
    desde?: string;
  },
): Promise<DiferenciasFinalesDto | null> {
  const existentes = await tx.alqConcepto.findMany({
    where: { contratoId: p.contratoId, tramoNumero: p.tramo, etapa: { not: null } },
    select: {
      claveGeneracion: true,
      sentido: true,
      importe: true,
      etapa: true,
      anuladoEn: true,
    },
  });
  if (!existentes.some((k) => k.etapa === 'parcial')) return null;

  const [contrato, tenant, feriados] = await Promise.all([
    tx.alqContrato.findUniqueOrThrow({
      where: { id: p.contratoId },
      include: {
        partes: { select: { personaId: true, papel: true, porcentaje: true } },
        tramos: {
          select: { numero: true, desde: true, hasta: true, importe: true },
          orderBy: { numero: 'asc' },
        },
      },
    }),
    tx.tenant.findUniqueOrThrow({ where: { id: p.tenantId }, select: { config: true } }),
    // Los meses en que puede caer el vencimiento: el de hoy y el de hoy + 60 días (el tope).
    feriadosDe(tx, [p.hoy.slice(0, 7), sumarDiasIso(p.hoy, 60).slice(0, 7)]),
  ]);
  const config = TenantConfigSchema.parse(tenant.config ?? {});
  const paraGenerar = aParaGenerar(contrato);
  // El importe definitivo: el que se acaba de guardar, o el que se va a guardar.
  paraGenerar.tramos = paraGenerar.tramos.map((t) =>
    t.numero === p.tramo ? { ...t, importe: p.importe } : t,
  );
  const vencimiento = vencimientoDeLaDiferencia(p.hoy, config.diasDiferenciaFinal, feriados);
  const diferencias = diferenciasDeLiquidacionFinal({
    contrato: paraGenerar,
    tramo: p.tramo,
    ivaInmobiliariaPct: config.ivaHonorariosPct,
    existentes: existentes.map((k) => ({
      clave: k.claveGeneracion ?? '',
      sentido: k.sentido as 'a_cobrar' | 'a_pagar',
      importe: decToNum(k.importe),
      etapa: k.etapa as EtapaLiquidacion,
      anulado: k.anuladoEn != null,
    })),
    vencimiento,
    indice: nombreDelIndice(contrato.indice),
    desde: p.desde,
  });
  const resumen = resumenDeDiferencias(diferencias);
  const dto: DiferenciasFinalesDto = {
    moneda: contrato.moneda as MonedaAlquiler,
    periodos: resumen.periodos,
    inquilino: resumen.inquilino,
    propietarios: resumen.propietarios,
    vencimiento,
    conceptos: diferencias.length,
  };
  if (!p.crear || diferencias.length === 0) return dto;

  const { ctx } = p.crear;
  // Sin `skipDuplicates`: cada clave es nueva (la versión sube con cada final),
  // y si chocara, mejor que la confirmación entera se deshaga a que quede a medias.
  await tx.alqConcepto.createMany({
    data: diferencias.map((d): Prisma.AlqConceptoCreateManyInput => ({
      tenantId: ctx.tenantId,
      contratoId: p.contratoId,
      personaId: d.personaId,
      tipo: d.tipo,
      sentido: d.sentido,
      moneda: d.moneda,
      periodo: d.periodo,
      vencimiento: toDate(d.vencimiento)!,
      importe: d.importe,
      descripcion: d.descripcion,
      claveGeneracion: d.clave,
      etapa: d.etapa,
      tramoNumero: d.tramo,
      creadoPorId: ctx.userId,
    })),
  });
  await registrarEventos(tx, ctx, {
    entidad: 'contrato',
    entidadId: p.contratoId,
    contratoId: p.contratoId,
    accion: 'generacion',
    resumen: `Generó la liquidación final de ${meses(resumen.periodos)}: inquilino ${plata(resumen.inquilino, dto.moneda)}, propietarios ${plata(resumen.propietarios, dto.moneda)}`,
  });
  return dto;
}
