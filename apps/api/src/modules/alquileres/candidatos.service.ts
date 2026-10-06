import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CandidatoDto, MonedaAlquiler } from '@vacker/types';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum } from '../tablero/tablero.util';
import { LiquidacionesService } from './liquidaciones.service';

/**
 * A quién se le cobra y a quién se le liquida (punto 6 de Javier, 6/10/2026).
 * En vez de todas las personas: los inquilinos con sus contratos y lo que
 * deben, o los propietarios con lo que hay para liquidarles. Los que tienen
 * algo pendiente van primero.
 *
 * Consultas fijas, sean cuantos sean los contratos: las partes en una, y lo
 * pendiente en una agregación SQL (inquilinos) o en la bandeja de
 * liquidaciones (propietarios), que ya resuelve qué se puede liquidar.
 */
@Injectable()
export class CandidatosService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  async listar(papel: 'inquilino' | 'propietario'): Promise<CandidatoDto[]> {
    const [partes, deudas] = await this.db.withTenant(async (tx) =>
      Promise.all([
        tx.alqContratoParte.findMany({
          where: { papel, contrato: { estado: { notIn: ['borrador', 'anulado'] } } },
          select: {
            persona: { select: { id: true, nombre: true } },
            contrato: {
              select: {
                id: true,
                codigo: true,
                codigoNum: true,
                propiedad: { select: { direccion: true, unidad: true } },
              },
            },
          },
        }),
        papel === 'inquilino'
          ? tx.$queryRaw<{ persona_id: string; moneda: string; pendiente: Prisma.Decimal }[]>`
              SELECT persona_id, moneda, SUM(saldo) AS pendiente FROM (
                SELECT k.persona_id, k.moneda,
                       k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) AS saldo
                  FROM alq_concepto k
                  LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
                  LEFT JOIN alq_cobro co ON co.id = im.cobro_id
                  LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
                 WHERE k.sentido = 'a_cobrar' AND k.anulado_en IS NULL AND k.liquidacion_id IS NULL
                   AND NOT EXISTS (SELECT 1 FROM alq_contrato_parte pp
                                    WHERE pp.contrato_id = k.contrato_id AND pp.persona_id = k.persona_id AND pp.papel = 'propietario')
                 GROUP BY k.id
              ) s
              WHERE saldo > 0
              GROUP BY persona_id, moneda`
          : Promise.resolve([]),
      ]),
    );

    const pendiente = new Map<string, { moneda: MonedaAlquiler; importe: number }[]>();
    const sumar = (personaId: string, moneda: MonedaAlquiler, importe: number) => {
      if (importe <= 0) return;
      pendiente.set(personaId, [
        ...(pendiente.get(personaId) ?? []),
        { moneda, importe: Math.round(importe * 100) / 100 },
      ]);
    };
    if (papel === 'inquilino') {
      for (const d of deudas)
        sumar(d.persona_id, d.moneda as MonedaAlquiler, decToNum(d.pendiente));
    } else {
      for (const p of await this.liquidaciones.pendientes()) sumar(p.persona.id, p.moneda, p.neto);
    }

    const porPersona = new Map<string, CandidatoDto & { orden: number }>();
    for (const p of partes) {
      const c = p.contrato;
      const actual = porPersona.get(p.persona.id) ?? {
        persona: p.persona,
        papel,
        contratos: [],
        pendiente: pendiente.get(p.persona.id) ?? [],
        orden: Infinity,
      };
      actual.contratos.push({
        id: c.id,
        codigo: c.codigo,
        propiedad: [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' '),
      });
      actual.orden = Math.min(actual.orden, c.codigoNum ? decToNum(c.codigoNum) : Infinity);
      porPersona.set(p.persona.id, actual);
    }
    const total = (x: CandidatoDto) =>
      x.pendiente.reduce((s, p) => s + (p.moneda === 'ARS' ? p.importe : 0), 0);
    return [...porPersona.values()]
      .sort(
        (a, b) =>
          Number(b.pendiente.length > 0) - Number(a.pendiente.length > 0) ||
          total(b) - total(a) ||
          a.persona.nombre.localeCompare(b.persona.nombre, 'es'),
      )
      .map(({ orden: _orden, ...x }) => ({
        ...x,
        contratos: x.contratos.sort((a, b) =>
          a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
        ),
      }));
  }
}
