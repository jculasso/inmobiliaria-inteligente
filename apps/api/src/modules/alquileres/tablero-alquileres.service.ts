import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TRAMOS_MORA,
  type FilaTablero,
  type Indicador,
  type MonedaAlquiler,
  type TableroAlquileresDto,
  type TramoMora,
} from '@vacker/types';
import { diasInclusive, fechaCorta, redondear2, sumarDiasIso, sumarMesesIso, tramoDeMora } from '@vacker/domain';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { IMPUTACION_ACTIVA } from './imputacion-activa';
import { IndexacionesService } from './indexaciones.service';
import { LiquidacionesService } from './liquidaciones.service';

const aContrato = (id: string) => `/alquileres/contratos/${id}`;
const aPersona = (id: string) => `/alquileres/personas/${id}`;

/** Un número que suma sus filas (regla 26): el valor sale de las filas, nunca aparte. */
function porImporte(filas: FilaTablero[]): Indicador {
  return { valor: redondear2(filas.reduce((s, f) => s + (f.importe ?? 0), 0)), filas };
}
function porCantidad(filas: FilaTablero[]): Indicador {
  return { valor: filas.length, filas };
}

interface FilaMora {
  id: string;
  moneda: string;
  vencimiento: Date;
  descripcion: string | null;
  tipo: string;
  saldo: Prisma.Decimal;
  contrato_id: string | null;
  codigo: string | null;
  persona_id: string;
  nombre: string;
}

/**
 * El tablero del módulo Alquileres (spec alquileres-fase-1.md, reglas 26 a 32).
 *
 * Lo que crece con la historia se calcula en la base: la morosidad trae solo
 * los conceptos con saldo, y la evolución y los ingresos vienen agregados por
 * mes. Lo del mes y la cartera, que no crecen, se arman en memoria. En los
 * dos casos, las consultas son las mismas tenga la inmobiliaria 10 contratos
 * o 1.000.
 */
@Injectable()
export class TableroAlquileresService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly indexaciones: IndexacionesService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  async tablero(hoy = hoyArgentina()): Promise<TableroAlquileresDto> {
    const mes = hoy.slice(0, 7);
    const [datos, bandeja, aLiquidar] = await Promise.all([
      this.db.withTenant((tx) => this.leer(tx, hoy, mes)),
      this.indexaciones.bandeja(hoy),
      this.liquidaciones.pendientes(),
    ]);
    const { contratos, delMes, mora, evolucion, ingresos } = datos;

    // --- Cartera (regla 27) ---
    const vigentes = contratos.filter((c) => c.estado === 'vigente');
    const inquilinosDe = (c: (typeof contratos)[number]) => c.partes.filter((p) => p.papel === 'inquilino');
    const filaContrato = (c: (typeof contratos)[number], importe: number | null, detalle?: string): FilaTablero => ({
      id: c.id,
      href: aContrato(c.id),
      contrato: c.codigo,
      persona: inquilinosDe(c).map((p) => p.persona.nombre).join(', ') || null,
      detalle: detalle ?? `${c.propiedad.direccion}${c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}`,
      fecha: fromDate(c.fin),
      importe,
    });
    const importeDeHoy = (c: (typeof contratos)[number]) => {
      const conImporte = c.tramos.filter((t) => t.importe != null && fromDate(t.desde)! <= hoy);
      return conImporte.length ? decToNum(conImporte.at(-1)!.importe) : null;
    };
    const monedas = [...new Set(vigentes.map((c) => c.moneda))].sort() as MonedaAlquiler[];
    const personasCon = (papel: string) => {
      const vistas = new Map<string, FilaTablero>();
      for (const c of vigentes) {
        for (const p of c.partes.filter((x) => x.papel === papel)) {
          vistas.set(p.personaId, { id: p.personaId, href: aPersona(p.personaId), contrato: null, persona: p.persona.nombre, detalle: `Contrato ${c.codigo}`, fecha: null, importe: null });
        }
      }
      return porCantidad([...vistas.values()].sort((a, b) => (a.persona ?? '').localeCompare(b.persona ?? '')));
    };

    // --- Cobranza del mes (regla 28) ---
    const cobranza = [...new Set(delMes.map((k) => k.moneda))].sort().map((moneda) => {
      const ks = delMes.filter((k) => k.moneda === moneda);
      const fila = (k: (typeof ks)[number], importe: number): FilaTablero => ({
        id: k.id,
        href: aPersona(k.persona.id),
        contrato: k.contrato?.codigo ?? null,
        persona: k.persona.nombre,
        detalle: k.descripcion ?? 'Alquiler',
        fecha: fromDate(k.vencimiento),
        importe,
      });
      const cobrado = (k: (typeof ks)[number]) => redondear2(k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0));
      return {
        moneda: moneda as MonedaAlquiler,
        emitidos: porCantidad(ks.map((k) => fila(k, decToNum(k.importe)))),
        cobrados: porCantidad(ks.filter((k) => cobrado(k) >= decToNum(k.importe)).map((k) => fila(k, decToNum(k.importe)))),
        importeEmitido: porImporte(ks.map((k) => fila(k, decToNum(k.importe)))),
        importeCobrado: porImporte(ks.filter((k) => cobrado(k) > 0).map((k) => fila(k, cobrado(k)))),
      };
    });

    // --- Morosidad (regla 29) ---
    const filasMora = mora.map((m) => {
      const vence = fromDate(m.vencimiento)!;
      const dias = diasInclusive(vence, hoy) - 1;
      return {
        moneda: m.moneda,
        tramo: tramoDeMora(dias),
        dias,
        personaId: m.persona_id,
        fila: {
          id: m.id,
          href: aPersona(m.persona_id),
          contrato: m.codigo,
          persona: m.nombre,
          detalle: `${m.descripcion ?? m.tipo} · ${dias} días`,
          fecha: vence,
          importe: decToNum(m.saldo),
        } satisfies FilaTablero,
      };
    });
    const morosidad = [...new Set(filasMora.map((f) => f.moneda))].sort().map((moneda) => {
      const fs = filasMora.filter((f) => f.moneda === moneda);
      return {
        moneda: moneda as MonedaAlquiler,
        total: porImporte(fs.map((f) => f.fila)),
        tramos: TRAMOS_MORA.map((tramo: TramoMora) => ({ tramo, indicador: porImporte(fs.filter((f) => f.tramo === tramo).map((f) => f.fila)) })),
      };
    });

    // --- Lo que hay que hacer (regla 31) ---
    const filaIndexacion = (t: (typeof bandeja.tramos)[number]): FilaTablero => ({
      id: t.tramoId,
      href: aContrato(t.contrato.id),
      contrato: t.contrato.codigo,
      persona: t.inquilinos.join(', ') || null,
      detalle: `Tramo ${t.numero} · ${t.indice}${t.estado === 'pendiente_indice' ? ' · espera el índice' : ''}`,
      fecha: t.desde,
      importe: t.importePropuesto,
    });
    const vencenEntre = (desde: number, hasta: number) =>
      porCantidad(
        vigentes
          .filter((c) => {
            const fin = fromDate(c.fin)!;
            return fin > sumarDiasIso(hoy, desde) && fin <= sumarDiasIso(hoy, hasta);
          })
          .map((c) => filaContrato(c, null)),
      );
    const depositos = contratos.filter((c) => {
      if (c.depositoImporte == null || decToNum(c.depositoImporte) <= 0 || c.depositoDevolucion != null) return false;
      const fin = c.estado === 'rescindido' && c.rescindidoEl ? fromDate(c.rescindidoEl)! : fromDate(c.fin)!;
      return c.estado !== 'vigente' || fin <= sumarDiasIso(hoy, 30);
    });
    const deudores = new Map<string, FilaTablero>();
    for (const f of filasMora.filter((x) => x.dias > 30)) {
      const previo = deudores.get(`${f.personaId}|${f.moneda}`);
      deudores.set(`${f.personaId}|${f.moneda}`, {
        id: `${f.personaId}|${f.moneda}`,
        href: aPersona(f.personaId),
        contrato: f.fila.contrato,
        persona: f.fila.persona,
        detalle: `Debe hace más de 30 días${f.moneda === 'USD' ? ' (dólares)' : ''}`,
        fecha: previo?.fecha && previo.fecha < f.fila.fecha ? previo.fecha : f.fila.fecha,
        importe: redondear2((previo?.importe ?? 0) + f.fila.importe),
      });
    }

    return {
      hoy,
      mes,
      cartera: {
        vigentes: porCantidad(vigentes.map((c) => filaContrato(c, importeDeHoy(c)))),
        vivienda: vigentes.filter((c) => c.tipo === 'vivienda').length,
        comercial: vigentes.filter((c) => c.tipo === 'comercial').length,
        alquilerMensual: monedas.map((moneda) => ({
          moneda,
          indicador: porImporte(vigentes.filter((c) => c.moneda === moneda && importeDeHoy(c) != null).map((c) => filaContrato(c, importeDeHoy(c)))),
        })),
        propietarios: personasCon('propietario'),
        inquilinos: personasCon('inquilino'),
      },
      cobranza,
      morosidad,
      evolucion: evolucion.map((e) => ({ mes: e.periodo, moneda: e.moneda as MonedaAlquiler, emitido: decToNum(e.emitido), cobrado: decToNum(e.cobrado) })),
      ingresos: ingresos.map((i) => ({
        mes: i.mes,
        moneda: i.moneda as MonedaAlquiler,
        honorarios: decToNum(i.honorarios),
        gastos: decToNum(i.gastos),
        punitorios: decToNum(i.punitorios),
      })),
      tareas: {
        indexacionesVencidas: porCantidad(bandeja.tramos.filter((t) => t.vencida).map(filaIndexacion)),
        indexacionesProximas: porCantidad(bandeja.tramos.filter((t) => !t.vencida).map(filaIndexacion)),
        vencen: [
          { dias: 30 as const, indicador: vencenEntre(0, 30) },
          { dias: 60 as const, indicador: vencenEntre(30, 60) },
          { dias: 90 as const, indicador: vencenEntre(60, 90) },
        ],
        depositos: porCantidad(depositos.map((c) => filaContrato(c, decToNum(c.depositoImporte), `Depósito · terminó o termina el ${fechaCorta(fromDate(c.rescindidoEl ?? c.fin)!)}`))),
        liquidaciones: porCantidad(
          aLiquidar
            .filter((p) => p.neto > 0)
            .map((p) => ({ id: `${p.persona.id}|${p.moneda}`, href: `/alquileres/liquidaciones/nueva?persona=${p.persona.id}`, contrato: null, persona: p.persona.nombre, detalle: 'Para liquidar', fecha: null, importe: p.neto })),
        ),
        deudores: porCantidad([...deudores.values()].sort((a, b) => (b.importe ?? 0) - (a.importe ?? 0))),
        // Regla 36: puede estar vigente sin firma electrónica (se firmó en
        // papel), pero el contrato firmado tiene que quedar cargado.
        sinFirmar: porCantidad(
          vigentes
            .filter((c) => !c.documentos.some((d) => d.estadoFirma === 'firmado'))
            .map((c) => filaContrato(c, null, c.documentos.length ? 'Falta completar la firma' : 'Falta cargar el contrato firmado')),
        ),
      },
    };
  }

  /** Cinco consultas, en una transacción: todas ven la misma foto de la base. */
  private async leer(tx: Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0], hoy: string, mes: string) {
    const desdeEvolucion = sumarMesesIso(`${mes}-01`, -11).slice(0, 7);
    const desdeIngresos = sumarMesesIso(`${mes}-01`, -23);
    const [contratos, delMes, mora, evolucion, ingresos] = await Promise.all([
      tx.alqContrato.findMany({
        where: { estado: { not: 'borrador' } },
        select: {
          id: true,
          codigo: true,
          estado: true,
          tipo: true,
          moneda: true,
          fin: true,
          rescindidoEl: true,
          depositoImporte: true,
          depositoDevolucion: true,
          propiedad: { select: { direccion: true, unidad: true } },
          partes: { select: { personaId: true, papel: true, persona: { select: { nombre: true } } } },
          tramos: { select: { desde: true, importe: true }, orderBy: { numero: 'asc' } },
          documentos: { select: { estadoFirma: true } },
        },
        orderBy: { codigo: 'asc' },
      }),
      // Los alquileres del mes, del lado del inquilino.
      tx.alqConcepto.findMany({
        where: { periodo: mes, tipo: 'alquiler', sentido: 'a_cobrar', anuladoEn: null },
        select: {
          id: true,
          moneda: true,
          importe: true,
          vencimiento: true,
          descripcion: true,
          persona: { select: { id: true, nombre: true } },
          contrato: { select: { codigo: true } },
          imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
        },
        orderBy: { vencimiento: 'asc' },
      }),
      // Deuda vencida de inquilinos: solo lo que tiene saldo. Lo de un
      // propietario en su contrato se descuenta al liquidar, no es mora.
      tx.$queryRaw<FilaMora[]>`
        SELECT k.id, k.moneda, k.vencimiento, k.descripcion, k.tipo,
               k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) AS saldo,
               c.id AS contrato_id, c.codigo, p.id AS persona_id, p.nombre
          FROM alq_concepto k
          JOIN alq_persona p ON p.id = k.persona_id
          LEFT JOIN alq_contrato c ON c.id = k.contrato_id
          LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
          LEFT JOIN alq_cobro co ON co.id = im.cobro_id
          LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
         WHERE k.sentido = 'a_cobrar' AND k.anulado_en IS NULL AND k.liquidacion_id IS NULL
           AND k.tipo <> 'honorarios' AND k.vencimiento < ${toDate(hoy)}
           AND NOT EXISTS (SELECT 1 FROM alq_contrato_parte pp
                            WHERE pp.contrato_id = k.contrato_id AND pp.persona_id = k.persona_id AND pp.papel = 'propietario')
         GROUP BY k.id, c.id, p.id
        HAVING k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) > 0
         ORDER BY k.vencimiento`,
      // Regla 29: lo emitido de cada mes y lo cobrado al cierre de ese mes.
      tx.$queryRaw<{ periodo: string; moneda: string; emitido: Prisma.Decimal; cobrado: Prisma.Decimal }[]>`
        SELECT k.periodo, k.moneda, SUM(k.importe) AS emitido, COALESCE(SUM(x.cobrado), 0) AS cobrado
          FROM alq_concepto k
          LEFT JOIN LATERAL (
            SELECT SUM(im.importe) AS cobrado
              FROM alq_imputacion im
              JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
              JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
             WHERE im.concepto_id = k.id
               AND re.fecha < (to_date(k.periodo, 'YYYY-MM') + INTERVAL '1 month')
          ) x ON true
         WHERE k.tipo = 'alquiler' AND k.sentido = 'a_cobrar' AND k.anulado_en IS NULL
           AND k.periodo BETWEEN ${desdeEvolucion} AND ${mes}
         GROUP BY k.periodo, k.moneda
         ORDER BY k.periodo, k.moneda`,
      // Regla 30: gastos y punitorios cobrados (por la fecha del cobro) y
      // honorarios descontados (por la fecha de la liquidación).
      tx.$queryRaw<{ mes: string; moneda: string; honorarios: Prisma.Decimal; gastos: Prisma.Decimal; punitorios: Prisma.Decimal }[]>`
        SELECT mes, moneda,
               SUM(importe) FILTER (WHERE tipo = 'honorarios') AS honorarios,
               SUM(importe) FILTER (WHERE tipo = 'gastos_adm') AS gastos,
               SUM(importe) FILTER (WHERE tipo = 'punitorio') AS punitorios
          FROM (
            SELECT to_char(re.fecha, 'YYYY-MM') AS mes, k.moneda, k.tipo, im.importe
              FROM alq_imputacion im
              JOIN alq_concepto k ON k.id = im.concepto_id
              JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
              JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
             WHERE k.tipo IN ('gastos_adm', 'punitorio') AND re.fecha >= ${toDate(desdeIngresos)}
            UNION ALL
            SELECT to_char(l.fecha, 'YYYY-MM'), k.moneda, k.tipo, k.importe
              FROM alq_concepto k
              JOIN alq_liquidacion l ON l.id = k.liquidacion_id AND l.anulado_en IS NULL
             WHERE k.tipo = 'honorarios' AND l.fecha >= ${toDate(desdeIngresos)}
          ) movimientos
         GROUP BY mes, moneda
         ORDER BY mes, moneda`,
    ]);
    return { contratos, delMes, mora, evolucion, ingresos };
  }
}
