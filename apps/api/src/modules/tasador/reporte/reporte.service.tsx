import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { Prisma } from '@prisma/client';
import type { EstadoTasacion, TasadorKpiFiltro } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope } from '../../tablero/scope.util';
import { decToNum } from '../../tablero/tablero.util';
import { SupabaseStorageService } from '../informes/supabase-storage.service';
import { agregar, ranking as rankingDe, type TasacionCalc } from '../kpis/kpis.calc';
import { ReporteDocument, type ReporteFila } from './reporte.template';

const filaSelect = {
  id: true,
  agenteId: true,
  fecha: true,
  direccion: true,
  barrio: true,
  cliente: true,
  estado: true,
  exclusividad: true,
  motivoNoCaptada: true,
  valorRecomendado: true,
  agente: { select: { nombre: true } },
} satisfies Prisma.TasacionSelect;

/** Reporte de tasaciones del período: KPIs + distribución + ranking + tabla, en PDF. */
@Injectable()
export class ReporteService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async generar(filtro: TasadorKpiFiltro, ctx: TenantContext): Promise<{ url: string }> {
    // Antes: resumen() y ranking() traían las tasaciones del período cada uno
    // en su propia transacción, y esta función las volvía a traer una
    // tercera vez con otro `select` para armar la tabla — 3 round trips
    // trayendo básicamente las mismas filas. Ahora se trae una sola vez
    // (con el `select` que alcanza para las tres cosas) y el resumen/ranking
    // se calculan en memoria con las mismas funciones puras de kpis.calc.
    const { filas, resumen, ranking, tenantNombre, logoUrl, colorPrimario } = await this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const where: Prisma.TasacionWhereInput = { fecha: rangoDeFecha(filtro) };
      if (scope.usuarioIds !== null) where.agenteId = { in: scope.usuarioIds };

      const [rows, tenant] = await Promise.all([
        tx.tasacion.findMany({ where, select: filaSelect, orderBy: { fecha: 'desc' } }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
      ]);

      const scopeSet = scope.usuarioIds === null ? null : new Set(scope.usuarioIds);
      const calc: TasacionCalc[] = rows.map((r) => ({
        id: r.id,
        agenteId: r.agenteId,
        nombre: r.agente.nombre,
        estado: r.estado as EstadoTasacion,
      }));

      const config = tenant.config as { logoUrl?: string; colorPrimario?: string } | null;
      const mapped: ReporteFila[] = rows.map((r) => ({
        id: r.id,
        fecha: r.fecha.toISOString().slice(0, 10),
        direccion: r.direccion,
        barrio: r.barrio,
        cliente: r.cliente,
        agenteNombre: r.agente.nombre,
        estado: r.estado as EstadoTasacion,
        exclusividad: r.exclusividad as ReporteFila['exclusividad'],
        motivoNoCaptada: r.motivoNoCaptada,
        valorRecomendado: r.valorRecomendado == null ? null : decToNum(r.valorRecomendado),
      }));
      return {
        filas: mapped,
        resumen: agregar(calc, scopeSet),
        ranking: rankingDe(calc, scopeSet),
        tenantNombre: tenant.nombre,
        logoUrl: config?.logoUrl ?? null,
        colorPrimario: config?.colorPrimario ?? null,
      };
    });

    const periodoLabel = etiquetaPeriodo(filtro);
    const buffer = await renderToBuffer(
      <ReporteDocument
        resumen={resumen}
        ranking={ranking}
        filas={filas}
        periodoLabel={periodoLabel}
        tenantNombre={tenantNombre}
        logoUrl={logoUrl}
        colorPrimario={colorPrimario}
      />,
    );

    const path = `${ctx.tenantId}/reportes/${slug(periodoLabel)}-${Date.now()}.pdf`;
    const url = await this.storage.upload('informes-tasador', path, buffer, 'application/pdf');
    return { url };
  }
}

/** Mismo criterio de rango que `kpis.service.ts` (no se toca ese archivo — ver plan §3). */
function rangoDeFecha(filtro: TasadorKpiFiltro): Prisma.DateTimeFilter {
  const { anio, periodo } = filtro;
  if (periodo === 'mensual') {
    const mes = filtro.mes ?? 1;
    return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
  }
  if (periodo === 'trimestral') {
    const trimestre = filtro.trimestre ?? 1;
    const mesInicio = (trimestre - 1) * 3;
    return { gte: new Date(Date.UTC(anio, mesInicio, 1)), lt: new Date(Date.UTC(anio, mesInicio + 3, 1)) };
  }
  return { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function etiquetaPeriodo(filtro: TasadorKpiFiltro): string {
  if (filtro.periodo === 'mensual') return `${MESES[(filtro.mes ?? 1) - 1]} ${filtro.anio}`;
  if (filtro.periodo === 'trimestral') return `Trimestre ${filtro.trimestre ?? 1} · ${filtro.anio}`;
  return `Año ${filtro.anio}`;
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
