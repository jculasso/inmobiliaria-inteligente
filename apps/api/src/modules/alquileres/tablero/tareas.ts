import { Prisma } from '@prisma/client';
import {
  DIAS_TABLERO_PROXIMOS,
  NOMBRE_ESTADO_CONTRATO,
  PrioridadReclamoSchema,
  nombrePrioridad,
  textoCuota,
  type CicloDelMes,
  type EstadoContrato,
  type FilaTablero,
  type FiltroTipoContrato,
  type MonedaAlquiler,
  type TableroAlquileresDto,
} from '@vacker/types';
import { diasInclusive, mesLargo, redondear2, sumarDiasIso } from '@vacker/domain';
import { decToNum, fromDate } from '../../tablero/tablero.util';
import { plata } from '../historial';
import type { IndexacionesService } from '../indexaciones.service';
import type { LiquidacionesService } from '../liquidaciones.service';
import { tareasDeReservas } from '../tablero-reservas';
import { aContrato, aPersona, enDias, porCantidad } from './comun';
import type { ContratoLeido, Fichas } from './fichas';
import { faltaGenerar } from './generar';
import type { DatosTablero } from './lectura';
import type { moraAl } from './morosidad';

/** Una diferencia de liquidación final que el inquilino todavía no pagó (regla 139). */
export interface FilaFinalPendiente {
  id: string;
  contrato_id: string;
  tipo_contrato: string | null;
  persona_id: string;
  nombre: string;
  periodo: string;
  moneda: string;
  vencimiento: Date;
  saldo: Prisma.Decimal;
}

/**
 * Regla 139: lo que el inquilino todavía debe de cada liquidación final —el
 * alquiler, los gastos y el IVA de la diferencia—, venza cuando venza. Lo de
 * un propietario en su contrato no entra: se descuenta al liquidar.
 */
export function sqlFinalesPendientes() {
  return Prisma.sql`
    SELECT * FROM (
      SELECT k.id, k.contrato_id, c.tipo AS tipo_contrato, p.id AS persona_id, p.nombre,
             k.periodo, k.moneda, k.vencimiento,
             k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) AS saldo
        FROM alq_concepto k
        JOIN alq_persona p ON p.id = k.persona_id
        JOIN alq_contrato c ON c.id = k.contrato_id
        LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
        LEFT JOIN alq_cobro co ON co.id = im.cobro_id
        LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
       WHERE k.etapa = 'final' AND k.sentido = 'a_cobrar' AND k.tipo <> 'honorarios'
         AND k.anulado_en IS NULL AND k.liquidacion_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM alq_contrato_parte pp
                          WHERE pp.contrato_id = k.contrato_id AND pp.persona_id = k.persona_id AND pp.papel = 'propietario')
       GROUP BY k.id, c.id, p.id
    ) s
     WHERE s.saldo > 0
     ORDER BY s.vencimiento, s.id`;
}

/**
 * Lo que necesitan las tareas, ya filtrado por el corte (todos, particulares
 * o comerciales). Reclamos, boletas y pólizas se filtran acá, con `delTipo`.
 */
export interface ParaLasTareas {
  hoy: string;
  tipo: FiltroTipoContrato;
  f: Fichas;
  /** Los contratos del corte. */
  contratos: ContratoLeido[];
  /** De esos, los vigentes a hoy (regla 27). */
  vigentes: ContratoLeido[];
  /** Los ids de los contratos del corte. */
  delTipo: Set<string>;
  bandeja: Awaited<ReturnType<IndexacionesService['bandeja']>>;
  aLiquidar: Awaited<ReturnType<LiquidacionesService['pendientes']>>;
  finales: FilaFinalPendiente[];
  /** La deuda a hoy, concepto por concepto. */
  filasMora: ReturnType<typeof moraAl>;
  reclamos: DatosTablero['reclamos'];
  polizas: DatosTablero['polizas'];
  boletas: DatosTablero['boletas'];
  reservas: DatosTablero['reservas'];
  /** El mes en curso, `AAAA-MM`. */
  mes: string;
  /** Las claves de los alquileres ya generados del mes en curso y del siguiente (regla 181). */
  generados: ReadonlySet<string>;
  /** La línea del mes (regla 178): desde cuándo se avisa que hay que generar el siguiente. */
  ciclo: CicloDelMes;
}

/** Lo que hay que hacer (regla 31): siempre a hoy, cada tarea con su lista. */
export function tareasDelTablero(e: ParaLasTareas): TableroAlquileresDto['tareas'] {
  const { hoy, tipo, contratos, vigentes, delTipo, bandeja, aLiquidar, filasMora } = e;
  const { reclamos, polizas, boletas } = e;
  const { vacia, datosDe, filaContrato, filaDe, terminaEl, diasHasta } = e.f;

  const esperaElIndice = (t: (typeof bandeja.tramos)[number]) =>
    t.estado === 'pendiente_indice' && t.desde <= hoy;
  // Regla 139: una fila por inquilino, contrato y mes, con lo que falta de la diferencia.
  const porMes = new Map<string, { k: FilaFinalPendiente; vence: string; saldo: number }>();
  for (const k of e.finales) {
    const clave = `${k.contrato_id}|${k.periodo}|${k.persona_id}|${k.moneda}`;
    const vence = fromDate(k.vencimiento)!;
    const previo = porMes.get(clave);
    porMes.set(clave, {
      k,
      vence: previo && previo.vence < vence ? previo.vence : vence,
      saldo: redondear2((previo?.saldo ?? 0) + decToNum(k.saldo)),
    });
  }
  const finalesPendientes = [...porMes].map(([id, { k, vence, saldo }]) =>
    filaDe(k.contrato_id, {
      id,
      href: aPersona(k.persona_id),
      inquilino: k.nombre,
      persona: k.nombre,
      moneda: k.moneda as MonedaAlquiler,
      detalle: `Liquidación final de ${mesLargo(`${k.periodo}-01`)}`,
      fecha: vence,
      dias: diasHasta(vence),
      importe: saldo,
      estado:
        vence < hoy
          ? `Vencida hace ${enDias(-diasHasta(vence))}`
          : vence === hoy
            ? 'Vence hoy'
            : `Vence en ${enDias(diasHasta(vence))}`,
    }),
  );
  const filaIndexacion = (t: (typeof bandeja.tramos)[number]): FilaTablero =>
    filaDe(t.contrato.id, {
      id: t.tramoId,
      href: aContrato(t.contrato.id),
      detalle: `Tramo ${t.numero} · ${t.indice}`,
      fecha: t.desde,
      dias: diasHasta(t.desde),
      alquiler: t.importeAnterior,
      importe: t.importePropuesto,
      estado:
        t.estado === 'pendiente_indice'
          ? `Espera ${t.falta.join(' y ') || 'el índice'}`
          : t.vencida
            ? 'Lista para confirmar (vencida)'
            : 'Lista para confirmar',
    });
  // La primera ventana arranca sin piso: un contrato que ya terminó y sigue
  // «vigente» (nadie lo finalizó ni lo renovó) también hay que atenderlo.
  const vencenEntre = (desde: number | null, hasta: number) =>
    vigentes.filter((c) => {
      const fin = fromDate(c.fin)!;
      return (desde == null || fin > sumarDiasIso(hoy, desde)) && fin <= sumarDiasIso(hoy, hasta);
    });
  const filaVence = (c: ContratoLeido) => filaContrato(c, { dias: diasHasta(fromDate(c.fin)!) });
  const depositos = contratos.filter((c) => {
    if (
      c.depositoImporte == null ||
      decToNum(c.depositoImporte) <= 0 ||
      c.depositoDevolucion != null
    )
      return false;
    return c.estado !== 'vigente' || terminaEl(c) <= sumarDiasIso(hoy, 30);
  });
  const deudores = new Map<string, FilaTablero & { conceptos: number }>();
  for (const x of filasMora.filter((y) => y.dias > 30)) {
    const clave = `${x.personaId}|${x.moneda}`;
    const previo = deudores.get(clave);
    const desde = previo?.fecha && previo.fecha < x.fila.fecha! ? previo.fecha : x.fila.fecha;
    const conceptos = (previo?.conceptos ?? 0) + 1;
    deudores.set(clave, {
      ...x.fila,
      id: clave,
      conceptos,
      detalle: `${conceptos} ${conceptos === 1 ? 'concepto' : 'conceptos'} con más de 30 días`,
      fecha: desde,
      dias: desde ? diasInclusive(desde, hoy) - 1 : null,
      importe: redondear2((previo?.importe ?? 0) + x.fila.importe!),
    });
  }

  const paraGenerar = { contratos, generados: e.generados, bandeja, f: e.f };

  // --- Escalones por iniciar (Gexion): contratos escalonados que cambian de importe pronto ---
  const hasta = sumarDiasIso(hoy, DIAS_TABLERO_PROXIMOS);
  const escalones = vigentes.flatMap((c) =>
    c.ajuste !== 'escalonado'
      ? []
      : c.tramos
          .filter((t) => t.numero > 1 && fromDate(t.desde)! > hoy && fromDate(t.desde)! <= hasta)
          .map((t) =>
            filaContrato(c, {
              id: `${c.id}|${t.numero}`,
              detalle: `Escalón ${t.numero}`,
              fecha: fromDate(t.desde),
              dias: diasHasta(fromDate(t.desde)!),
              importe: t.importe == null ? null : decToNum(t.importe),
            }),
          ),
  );

  return {
    indexacionesVencidas: porCantidad(bandeja.tramos.filter((t) => t.vencida).map(filaIndexacion)),
    // Regla 7: las que ya empezaron y esperan un índice que no salió no
    // son vencidas ni próximas. Cada tramo, en una sola de las tres.
    indexacionesProximas: porCantidad(
      bandeja.tramos.filter((t) => !t.vencida && !esperaElIndice(t)).map(filaIndexacion),
    ),
    indexacionesEsperan: porCantidad(bandeja.tramos.filter(esperaElIndice).map(filaIndexacion)),
    finalesPendientes: porCantidad(finalesPendientes),
    vencen: [
      { dias: 30 as const, indicador: porCantidad(vencenEntre(null, 30).map(filaVence)) },
      { dias: 60 as const, indicador: porCantidad(vencenEntre(30, 60).map(filaVence)) },
      { dias: 90 as const, indicador: porCantidad(vencenEntre(60, 90).map(filaVence)) },
    ],
    depositos: porCantidad(
      depositos.map((c) =>
        filaContrato(c, {
          importe: decToNum(c.depositoImporte),
          estado:
            c.estado === 'vigente'
              ? `Termina en ${enDias(diasHasta(terminaEl(c)))}`
              : terminaEl(c) <= hoy
                ? `Terminó hace ${enDias(-diasHasta(terminaEl(c)))}`
                : (NOMBRE_ESTADO_CONTRATO[c.estado as EstadoContrato] ?? c.estado),
        }),
      ),
    ),
    liquidaciones: porCantidad(
      aLiquidar
        .filter((p) => p.neto > 0)
        .map((p) => ({
          ...vacia,
          ...datosDe(undefined),
          id: `${p.persona.id}|${p.moneda}`,
          href: `/alquileres/liquidaciones/nueva?persona=${p.persona.id}`,
          persona: p.persona.nombre,
          propietario: p.persona.nombre,
          contrato: p.contratos.map((c) => c.codigo).join(', ') || null,
          propiedad: p.contratos.map((c) => c.propiedad).join(' · ') || null,
          inquilino: [...new Set(p.contratos.flatMap((c) => c.inquilinos))].join(', ') || null,
          moneda: p.moneda,
          importe: p.neto,
          estado: p.enEspera > 0 ? `${plata(p.enEspera, p.moneda)} en espera` : null,
        })),
    ),
    deudores: porCantidad(
      [...deudores.values()]
        .sort((a, b) => (b.importe ?? 0) - (a.importe ?? 0))
        .map(({ conceptos: _c, ...x }) => x),
    ),
    // Regla 36: puede estar vigente sin firma electrónica (se firmó en
    // papel), pero el contrato firmado tiene que quedar cargado.
    sinFirmar: porCantidad(
      vigentes
        .filter((c) => !c.documentos.some((d) => d.estadoFirma === 'firmado'))
        .map((c) =>
          filaContrato(c, {
            fecha: fromDate(c.inicio),
            estado: c.documentos.length
              ? 'Falta completar la firma'
              : 'Falta cargar el contrato firmado',
          }),
        ),
    ),
    escalones: porCantidad(escalones.sort((a, b) => ((a.fecha ?? '') < (b.fecha ?? '') ? -1 : 1))),
    reclamos: porCantidad(
      reclamos
        .filter((r) => tipo === 'todos' || (r.contratoId != null && delTipo.has(r.contratoId)))
        .map((r) =>
          filaDe(r.contratoId, {
            id: r.id,
            href: `/alquileres/reclamos/${r.id}`,
            detalle: r.asunto,
            fecha: fromDate(r.createdAt),
            dias: diasInclusive(fromDate(r.createdAt)!, hoy) - 1,
            estado: nombrePrioridad(PrioridadReclamoSchema.catch('media').parse(r.prioridad)),
          }),
        ),
    ),
    // Entrega 19: las pólizas de los vigentes que vencen y lo que paga la inmobiliaria.
    polizas: porCantidad(
      polizas
        .filter(
          (p) =>
            p.contrato.estado === 'vigente' &&
            delTipo.has(p.contratoId) &&
            fromDate(p.hasta)! <= sumarDiasIso(hoy, DIAS_TABLERO_PROXIMOS),
        )
        .map((p) => {
          const hastaP = fromDate(p.hasta)!;
          return filaDe(p.contratoId, {
            id: p.id,
            href: aContrato(p.contratoId),
            detalle: `${p.aseguradora}${p.numero ? ` N° ${p.numero}` : ''}`,
            fecha: hastaP,
            dias: diasHasta(hastaP),
            estado: hastaP < hoy ? 'Vencida' : `Vence en ${enDias(diasHasta(hastaP))}`,
          });
        }),
    ),
    boletas: porCantidad(
      boletas
        .filter((b) => tipo === 'todos' || (b.contratoId != null && delTipo.has(b.contratoId)))
        .map((b) => {
          const vence = fromDate(b.vencimiento)!;
          return filaDe(b.contratoId, {
            id: b.id,
            href: '/alquileres/impuestos?ver=pagar',
            moneda: 'ARS',
            detalle: `${b.cuenta ? b.cuenta.servicio.nombre : `Póliza ${b.poliza?.aseguradora ?? ''}`}${b.cuota ? ` · ${textoCuota(b.cuota)}` : ''}`,
            fecha: vence,
            dias: diasHasta(vence),
            importe: decToNum(b.importe),
            estado:
              vence < hoy
                ? `Vencida hace ${enDias(-diasHasta(vence))}`
                : vence === hoy
                  ? 'Vence hoy'
                  : `Vence en ${enDias(diasHasta(vence))}`,
          });
        }),
    ),
    // Regla 166: las reservas que vencen y las aprobadas sin contrato.
    ...tareasDeReservas(e.reservas, hoy, tipo),
    // Regla 181: el mes en curso, desde el día 1; el siguiente, desde el aviso
    // de la línea del mes. Antes del aviso, la tarea no existe (`null`).
    generarMes: faltaGenerar({ ...paraGenerar, periodo: e.mes }),
    generarSiguiente:
      hoy >= e.ciclo.generarSiguiente.fecha
        ? faltaGenerar({ ...paraGenerar, periodo: e.ciclo.generarSiguiente.mes })
        : null,
  };
}
