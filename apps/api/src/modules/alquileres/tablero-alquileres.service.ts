import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DIAS_TABLERO_PROXIMOS,
  NOMBRE_ESTADO_CONTRATO,
  TRAMOS_MORA,
  type EstadoContrato,
  type FiltroTipoContrato,
  type FilaTablero,
  type Indicador,
  type MonedaAlquiler,
  type TableroAlquileresDto,
  type TramoMora,
} from '@vacker/types';
import {
  alquilerDeHoy,
  diasInclusive,
  proximoCambio,
  redondear2,
  sumarDiasIso,
  tramoDeMora,
} from '@vacker/domain';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { plata } from './historial';
import { IMPUTACION_ACTIVA } from './imputacion-activa';
import { IndexacionesService } from './indexaciones.service';
import { LiquidacionesService } from './liquidaciones.service';

const aContrato = (id: string) => `/alquileres/contratos/${id}`;
const aPersona = (id: string) => `/alquileres/personas/${id}`;

/** Un número que suma sus filas (regla 26): el valor sale de las filas, nunca aparte. */
function porImporte(filas: FilaTablero[]): Indicador {
  return { valor: redondear2(filas.reduce((s, f) => s + (f.importe ?? 0), 0)), filas };
}
/**
 * Suma filas agregadas que vienen separadas por tipo de contrato: con «todos»,
 * particulares y comerciales del mismo mes y moneda van juntos.
 */
function sumarPor<T extends object, K extends keyof T>(
  filas: T[],
  clave: (f: T) => string,
  campos: K[],
): (Omit<T, K> & Record<K, number>)[] {
  const juntos = new Map<string, Omit<T, K> & Record<K, number>>();
  for (const f of filas) {
    const k = clave(f);
    const previo = juntos.get(k);
    const fila = previo ?? ({ ...f } as Omit<T, K> & Record<K, number>);
    for (const c of campos) {
      const v = f[c] == null ? 0 : decToNum(f[c] as unknown as Prisma.Decimal);
      (fila as Record<K, number>)[c] = previo
        ? redondear2((previo as Record<K, number>)[c] + v)
        : v;
    }
    juntos.set(k, fila);
  }
  return [...juntos.values()];
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
  tipo_contrato: string | null;
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

  /**
   * `anio` elige el año de los gráficos (evolución e ingresos, con el año
   * anterior para comparar), como el Tablero Comercial. Lo demás —cartera,
   * cobranza del mes, morosidad, tareas— es siempre a hoy.
   */
  async tablero(
    hoy = hoyArgentina(),
    anio = Number(hoy.slice(0, 4)),
    tipo: FiltroTipoContrato = 'todos',
  ): Promise<TableroAlquileresDto> {
    return (await this.tableros(hoy, anio))[tipo];
  }

  /**
   * Los tres cortes —todos, particulares y comerciales— de una sola lectura.
   * El filtro tardaba cinco o seis segundos por toque porque cada uno volvía a
   * leer todo (Javier, 6/10/2026: «parece que no está funcionando»); ahora la
   * pantalla los trae juntos y cambiar de filtro no pide nada. Lo que se
   * agrega en la base viene separado por tipo y se suma acá.
   */
  async tableros(
    hoy = hoyArgentina(),
    anio = Number(hoy.slice(0, 4)),
  ): Promise<Record<FiltroTipoContrato, TableroAlquileresDto>> {
    const mes = hoy.slice(0, 7);
    const [datos, bandeja, aLiquidar] = await Promise.all([
      this.db.withTenant((tx) => this.leer(tx, hoy, mes, anio)),
      this.indexaciones.bandeja(hoy, DIAS_TABLERO_PROXIMOS),
      this.liquidaciones.pendientes(),
    ]);
    const armar = (tipo: FiltroTipoContrato) =>
      this.armar(datos, bandeja, aLiquidar, hoy, mes, anio, tipo);
    return { todos: armar('todos'), vivienda: armar('vivienda'), comercial: armar('comercial') };
  }

  private armar(
    datos: Awaited<ReturnType<TableroAlquileresService['leer']>>,
    bandejaTodas: Awaited<ReturnType<IndexacionesService['bandeja']>>,
    aLiquidarTodos: Awaited<ReturnType<LiquidacionesService['pendientes']>>,
    hoy: string,
    mes: string,
    anio: number,
    tipo: FiltroTipoContrato,
  ): TableroAlquileresDto {
    const { contratos: todos, delMes: delMesTodos, reclamos, polizas, boletas } = datos;
    const delTipoSql = <T extends { tipo_contrato: string | null }>(xs: T[]) =>
      tipo === 'todos' ? xs : xs.filter((x) => x.tipo_contrato === tipo);
    const mora = delTipoSql(datos.mora);
    // Evolución e ingresos vienen por tipo: con «todos» se suman los dos.
    const evolucion = sumarPor(delTipoSql(datos.evolucion), (e) => `${e.periodo}|${e.moneda}`, [
      'emitido',
      'cobrado',
    ]);
    const ingresos = sumarPor(delTipoSql(datos.ingresos), (i) => `${i.mes}|${i.moneda}`, [
      'honorarios',
      'gastos',
      'punitorios',
      'comisiones',
    ]);

    // El filtro Particulares / Comerciales (punto 8 de Javier) mira todo el
    // tablero: lo leído se filtra acá, sobre los contratos de la inmobiliaria.
    const contratos = tipo === 'todos' ? todos : todos.filter((c) => c.tipo === tipo);
    const delTipo = new Set(contratos.map((c) => c.id));
    const delMes =
      tipo === 'todos'
        ? delMesTodos
        : delMesTodos.filter((k) => k.contratoId != null && delTipo.has(k.contratoId));
    const bandeja =
      tipo === 'todos'
        ? bandejaTodas
        : {
            ...bandejaTodas,
            tramos: bandejaTodas.tramos.filter((t) => delTipo.has(t.contrato.id)),
          };
    const aLiquidar =
      tipo === 'todos'
        ? aLiquidarTodos
        : aLiquidarTodos.filter((p) => p.contratos.some((c) => delTipo.has(c.id)));

    // --- Lo que se sabe de cada contrato, para que cada fila del detalle sirva ---
    // (Javier, 6/10/2026: «Propietario, Inquilino, Importe Alquiler vigente,
    // cuando indexa, cuando vence»). Todo sale de lo ya leído: ninguna consulta más.
    type C = (typeof todos)[number];
    const porId = new Map(todos.map((c) => [c.id, c]));
    const nombresDe = (c: C, papel: string) =>
      c.partes
        .filter((p) => p.papel === papel)
        .map((p) => p.persona.nombre)
        .join(', ') || null;
    const direccionDe = (c: C) =>
      [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' ');
    const tramosDe = (c: C) =>
      c.tramos.map((t) => ({
        numero: t.numero,
        desde: fromDate(t.desde)!,
        importe: t.importe == null ? null : decToNum(t.importe),
      }));
    // Las mismas definiciones que la lista de contratos (@vacker/domain).
    const importeDeHoy = (c: C) => alquilerDeHoy(tramosDe(c), hoy);
    const proximaIndexacion = (c: C) => proximoCambio(tramosDe(c), hoy);
    const terminaEl = (c: C) => fromDate(c.rescindidoEl ?? c.fin)!;
    const vacia = { detalle: '', fecha: null, importe: null, dias: null, estado: null };
    const datosDe = (c: C | undefined) =>
      c
        ? {
            contrato: c.codigo,
            propiedad: direccionDe(c),
            inquilino: nombresDe(c, 'inquilino'),
            propietario: nombresDe(c, 'propietario'),
            persona: nombresDe(c, 'inquilino'),
            moneda: c.moneda as MonedaAlquiler,
            alquiler: importeDeHoy(c),
            indexa: c.estado === 'vigente' ? proximaIndexacion(c) : null,
            vence: terminaEl(c),
          }
        : {
            contrato: null,
            propiedad: null,
            inquilino: null,
            propietario: null,
            persona: null,
            moneda: null,
            alquiler: null,
            indexa: null,
            vence: null,
          };
    const filaContrato = (c: C, extra: Partial<FilaTablero> = {}): FilaTablero => ({
      id: c.id,
      href: aContrato(c.id),
      ...vacia,
      ...datosDe(c),
      ...extra,
    });
    /** Una fila de algo de un contrato (un concepto, un reclamo): los datos del contrato y lo propio. */
    const filaDe = (
      contratoId: string | null,
      extra: Partial<FilaTablero> & { id: string; href: string | null },
    ): FilaTablero => ({
      ...vacia,
      ...datosDe(contratoId ? porId.get(contratoId) : undefined),
      ...extra,
    });
    const diasHasta = (iso: string) => diasInclusive(hoy, iso) - 1;

    // --- Cartera (regla 27) ---
    const vigentes = contratos.filter((c) => c.estado === 'vigente');
    const monedas = [...new Set(vigentes.map((c) => c.moneda))].sort() as MonedaAlquiler[];

    // --- Cobranza del mes (regla 28) ---
    const cobranza = [...new Set(delMes.map((k) => k.moneda))].sort().map((moneda) => {
      const ks = delMes.filter((k) => k.moneda === moneda);
      const cobrado = (k: (typeof ks)[number]) =>
        redondear2(k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0));
      const estadoDe = (k: (typeof ks)[number]) => {
        const c = cobrado(k);
        const total = decToNum(k.importe);
        if (c >= total) return 'Cobrado';
        if (c > 0) return `Pagó ${plata(c, moneda)}, falta ${plata(redondear2(total - c), moneda)}`;
        const vence = fromDate(k.vencimiento)!;
        return vence < hoy ? `Vencido hace ${-diasHasta(vence)} días` : 'Pendiente';
      };
      const fila = (k: (typeof ks)[number], importe: number): FilaTablero =>
        filaDe(k.contratoId, {
          id: k.id,
          href: aPersona(k.persona.id),
          inquilino: k.persona.nombre,
          persona: k.persona.nombre,
          moneda: moneda as MonedaAlquiler,
          detalle: k.descripcion ?? 'Alquiler',
          fecha: fromDate(k.vencimiento),
          importe,
          estado: estadoDe(k),
        });
      return {
        moneda: moneda as MonedaAlquiler,
        emitidos: porCantidad(ks.map((k) => fila(k, decToNum(k.importe)))),
        cobrados: porCantidad(
          ks
            .filter((k) => cobrado(k) >= decToNum(k.importe))
            .map((k) => fila(k, decToNum(k.importe))),
        ),
        importeEmitido: porImporte(ks.map((k) => fila(k, decToNum(k.importe)))),
        importeCobrado: porImporte(
          ks.filter((k) => cobrado(k) > 0).map((k) => fila(k, cobrado(k))),
        ),
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
        contratoId: m.contrato_id,
        fila: filaDe(m.contrato_id, {
          id: m.id,
          href: aPersona(m.persona_id),
          inquilino: m.nombre,
          persona: m.nombre,
          moneda: m.moneda as MonedaAlquiler,
          detalle: m.descripcion ?? m.tipo,
          fecha: vence,
          dias,
          importe: decToNum(m.saldo),
        }),
      };
    });
    const morosidad = [...new Set(filasMora.map((f) => f.moneda))].sort().map((moneda) => {
      const fs = filasMora.filter((f) => f.moneda === moneda);
      return {
        moneda: moneda as MonedaAlquiler,
        total: porImporte(fs.map((f) => f.fila)),
        tramos: TRAMOS_MORA.map((tramo: TramoMora) => ({
          tramo,
          indicador: porImporte(fs.filter((f) => f.tramo === tramo).map((f) => f.fila)),
        })),
      };
    });

    // --- Lo que hay que hacer (regla 31) ---
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
    const filaVence = (c: C) => filaContrato(c, { dias: diasHasta(fromDate(c.fin)!) });
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
    for (const f of filasMora.filter((x) => x.dias > 30)) {
      const clave = `${f.personaId}|${f.moneda}`;
      const previo = deudores.get(clave);
      const desde = previo?.fecha && previo.fecha < f.fila.fecha! ? previo.fecha : f.fila.fecha;
      const conceptos = (previo?.conceptos ?? 0) + 1;
      deudores.set(clave, {
        ...f.fila,
        id: clave,
        conceptos,
        detalle: `${conceptos} ${conceptos === 1 ? 'concepto' : 'conceptos'} con más de 30 días`,
        fecha: desde,
        dias: desde ? diasInclusive(desde, hoy) - 1 : null,
        importe: redondear2((previo?.importe ?? 0) + f.fila.importe!),
      });
    }

    // --- Reparto de la cartera por tipo, siempre de todos (punto 8) ---
    const vigentesTodos = todos.filter((c) => c.estado === 'vigente');
    const pesosDe = (xs: typeof todos) =>
      redondear2(
        xs.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + (importeDeHoy(c) ?? 0), 0),
      );
    const totalPesos = pesosDe(vigentesTodos);
    const porTipo = (['vivienda', 'comercial'] as const).map((t) => {
      const xs = vigentesTodos.filter((c) => c.tipo === t);
      const importe = pesosDe(xs);
      return {
        tipo: t,
        cantidad: xs.length,
        importe,
        pct: totalPesos > 0 ? Math.round((importe / totalPesos) * 1000) / 10 : 0,
      };
    });

    // --- Contratos nuevos (punto 8): los que empiezan en cada mes ---
    const empiezaEn = (c: C) => fromDate(c.inicio)!.slice(0, 7);
    const importeInicial = (c: C) =>
      c.tramos[0]?.importe != null ? decToNum(c.tramos[0].importe) : 0;
    const meses = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const nuevosDe = (a: number, m: string) =>
      contratos.filter((c) => empiezaEn(c) === `${a}-${m}`);
    const nuevos = {
      porMes: meses.map((m) =>
        porCantidad(
          nuevosDe(anio, m).map((c) =>
            filaContrato(c, {
              fecha: fromDate(c.inicio),
              importe: importeInicial(c),
              estado: NOMBRE_ESTADO_CONTRATO[c.estado as EstadoContrato] ?? c.estado,
            }),
          ),
        ),
      ),
      importePorMes: meses.map((m) =>
        redondear2(
          nuevosDe(anio, m)
            .filter((c) => c.moneda === 'ARS')
            .reduce((s, c) => s + importeInicial(c), 0),
        ),
      ),
      anterior: meses.map((m) => nuevosDe(anio - 1, m).length),
    };

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
      hoy,
      mes,
      anio,
      tipo,
      nuevos,
      cartera: {
        porTipo,
        vigentes: porCantidad(vigentes.map((c) => filaContrato(c))),
        vivienda: vigentes.filter((c) => c.tipo === 'vivienda').length,
        comercial: vigentes.filter((c) => c.tipo === 'comercial').length,
        alquilerMensual: monedas.map((moneda) => ({
          moneda,
          indicador: porImporte(
            vigentes
              .filter((c) => c.moneda === moneda && importeDeHoy(c) != null)
              .map((c) => filaContrato(c, { importe: importeDeHoy(c) })),
          ),
        })),
      },
      cobranza,
      morosidad,
      evolucion: evolucion.map((e) => ({
        mes: e.periodo,
        moneda: e.moneda as MonedaAlquiler,
        emitido: e.emitido,
        cobrado: e.cobrado,
      })),
      ingresos: ingresos.map((i) => ({
        mes: i.mes,
        moneda: i.moneda as MonedaAlquiler,
        honorarios: i.honorarios,
        gastos: i.gastos,
        punitorios: i.punitorios,
        comisiones: i.comisiones,
      })),
      tareas: {
        indexacionesVencidas: porCantidad(
          bandeja.tramos.filter((t) => t.vencida).map(filaIndexacion),
        ),
        indexacionesProximas: porCantidad(
          bandeja.tramos.filter((t) => !t.vencida).map(filaIndexacion),
        ),
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
                  ? `Termina en ${diasHasta(terminaEl(c))} días`
                  : terminaEl(c) <= hoy
                    ? `Terminó hace ${-diasHasta(terminaEl(c))} días`
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
            .map(({ conceptos: _c, ...f }) => f),
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
        escalones: porCantidad(
          escalones.sort((a, b) => ((a.fecha ?? '') < (b.fecha ?? '') ? -1 : 1)),
        ),
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
                estado: `Prioridad ${r.prioridad}`,
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
                estado: hastaP < hoy ? 'Vencida' : `Vence en ${diasHasta(hastaP)} días`,
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
                href: '/alquileres/impuestos?ver=control',
                moneda: 'ARS',
                detalle: `${b.cuenta ? b.cuenta.servicio.nombre : `Póliza ${b.poliza?.aseguradora ?? ''}`}${b.cuota ? ` cuota ${b.cuota}` : ''}`,
                fecha: vence,
                dias: diasHasta(vence),
                importe: decToNum(b.importe),
                estado:
                  vence < hoy
                    ? `Vencida hace ${-diasHasta(vence)} días`
                    : vence === hoy
                      ? 'Vence hoy'
                      : `Vence en ${diasHasta(vence)} días`,
              });
            }),
        ),
      },
    };
  }

  /** Ocho consultas, siempre las mismas, en una transacción: todas ven la misma foto de la base. */
  private async leer(
    tx: Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0],
    hoy: string,
    mes: string,
    anio: number,
  ) {
    const desdeEvolucion = `${anio}-01`;
    const hastaEvolucion = `${anio}-12`;
    // El año elegido y el anterior, para el gráfico, y siempre el mes en
    // curso, para la tarjeta «Ingresos del mes» aunque se mire otro año.
    const anioHoy = Number(hoy.slice(0, 4));
    const desdeIngresos = `${Math.min(anio - 1, anioHoy)}-01-01`;
    const hastaIngresos = `${Math.max(anio, anioHoy) + 1}-01-01`;
    const [delMes, mora, evolucion, ingresos, reclamos, polizas, boletas] = await Promise.all([
      // Los alquileres del mes, del lado del inquilino.
      tx.alqConcepto.findMany({
        where: { periodo: mes, tipo: 'alquiler', sentido: 'a_cobrar', anuladoEn: null },
        select: {
          id: true,
          contratoId: true,
          moneda: true,
          importe: true,
          vencimiento: true,
          descripcion: true,
          persona: { select: { id: true, nombre: true } },
          imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
        },
        orderBy: { vencimiento: 'asc' },
      }),
      // Deuda vencida de inquilinos: solo lo que tiene saldo. Lo de un
      // propietario en su contrato se descuenta al liquidar, no es mora.
      tx.$queryRaw<FilaMora[]>`
        SELECT k.id, k.moneda, k.vencimiento, k.descripcion, k.tipo,
               k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) AS saldo,
               c.id AS contrato_id, c.codigo, c.tipo AS tipo_contrato, p.id AS persona_id, p.nombre
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
      tx.$queryRaw<
        {
          periodo: string;
          moneda: string;
          tipo_contrato: string | null;
          emitido: Prisma.Decimal;
          cobrado: Prisma.Decimal;
        }[]
      >`
        SELECT k.periodo, k.moneda, c.tipo AS tipo_contrato, SUM(k.importe) AS emitido, COALESCE(SUM(x.cobrado), 0) AS cobrado
          FROM alq_concepto k
          JOIN alq_contrato c ON c.id = k.contrato_id
          LEFT JOIN LATERAL (
            SELECT SUM(im.importe) AS cobrado
              FROM alq_imputacion im
              JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
              JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
             WHERE im.concepto_id = k.id
               AND re.fecha < (to_date(k.periodo, 'YYYY-MM') + INTERVAL '1 month')
          ) x ON true
         WHERE k.tipo = 'alquiler' AND k.sentido = 'a_cobrar' AND k.anulado_en IS NULL
           AND k.periodo BETWEEN ${desdeEvolucion} AND ${hastaEvolucion}
         GROUP BY k.periodo, k.moneda, c.tipo
         ORDER BY k.periodo, k.moneda`,
      // Regla 30: gastos y punitorios cobrados (por la fecha del cobro) y
      // honorarios descontados (por la fecha de la liquidación).
      tx.$queryRaw<
        {
          mes: string;
          moneda: string;
          tipo_contrato: string | null;
          honorarios: Prisma.Decimal;
          gastos: Prisma.Decimal;
          punitorios: Prisma.Decimal;
          comisiones: Prisma.Decimal | null;
        }[]
      >`
        SELECT mes, moneda, tipo_contrato,
               SUM(importe) FILTER (WHERE tipo = 'honorarios') AS honorarios,
               SUM(importe) FILTER (WHERE tipo = 'gastos_adm') AS gastos,
               SUM(importe) FILTER (WHERE tipo = 'punitorio') AS punitorios,
               SUM(importe) FILTER (WHERE tipo IN ('comision', 'informe')) AS comisiones
          FROM (
            SELECT to_char(re.fecha, 'YYYY-MM') AS mes, k.moneda, c.tipo AS tipo_contrato, k.tipo, im.importe
              FROM alq_imputacion im
              JOIN alq_concepto k ON k.id = im.concepto_id
              JOIN alq_contrato c ON c.id = k.contrato_id
              JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
              JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
             WHERE k.tipo IN ('gastos_adm', 'punitorio', 'comision', 'informe') AND re.fecha >= ${toDate(desdeIngresos)} AND re.fecha < ${toDate(hastaIngresos)}
                UNION ALL
            SELECT to_char(l.fecha, 'YYYY-MM'), k.moneda, c.tipo, k.tipo, k.importe
              FROM alq_concepto k
              JOIN alq_contrato c ON c.id = k.contrato_id
              JOIN alq_liquidacion l ON l.id = k.liquidacion_id AND l.anulado_en IS NULL
             WHERE k.tipo = 'honorarios' AND l.fecha >= ${toDate(desdeIngresos)} AND l.fecha < ${toDate(hastaIngresos)}
              ) movimientos
         GROUP BY mes, moneda, tipo_contrato
         ORDER BY mes, moneda`,
      // Reclamos abiertos o en curso (entrega 15).
      tx.alqReclamo.findMany({
        where: { estado: { in: ['abierto', 'en_curso'] } },
        select: { id: true, asunto: true, prioridad: true, contratoId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // La última póliza de cada contrato vigente: una vieja ya renovada no
      // es una póliza vencida (antes quedaba «Vencida» para siempre).
      tx.alqPoliza.findMany({
        where: { anuladoEn: null, contrato: { estado: 'vigente' } },
        distinct: ['contratoId'],
        orderBy: [{ contratoId: 'asc' }, { hasta: 'desc' }],
        select: {
          id: true,
          contratoId: true,
          aseguradora: true,
          numero: true,
          hasta: true,
          contrato: { select: { codigo: true, estado: true } },
        },
      }),
      tx.alqBoleta.findMany({
        where: {
          paga: 'inmobiliaria',
          pagadaEl: null,
          anuladoEn: null,
          vencimiento: { lte: toDate(sumarDiasIso(hoy, 7))! },
        },
        select: {
          id: true,
          contratoId: true,
          cuota: true,
          vencimiento: true,
          importe: true,
          cuenta: { select: { servicio: { select: { nombre: true } } } },
          poliza: { select: { aseguradora: true } },
        },
        orderBy: { vencimiento: 'asc' },
      }),
    ]);
    const nombrados = [
      ...new Set(
        [...delMes, ...reclamos, ...boletas]
          .map((x) => x.contratoId)
          .concat(mora.map((m) => m.contrato_id))
          .filter((x): x is string => !!x),
      ),
    ];
    const contratos = await tx.alqContrato.findMany({
      // No todos los de la historia (un tercio se renueva por año): los vigentes,
      // los que empezaron desde el año anterior al elegido (contratos nuevos y
      // su comparación), los que deben el depósito y los que nombran las
      // deudas, reclamos y boletas de arriba.
      where: {
        estado: { notIn: ['borrador', 'anulado'] },
        OR: [
          { estado: 'vigente' },
          { inicio: { gte: toDate(`${anio - 1}-01-01`)! } },
          { depositoImporte: { gt: 0 }, depositoDevolucion: null },
          { id: { in: nombrados } },
        ],
      },
      select: {
        id: true,
        codigo: true,
        estado: true,
        tipo: true,
        moneda: true,
        ajuste: true,
        inicio: true,
        fin: true,
        rescindidoEl: true,
        depositoImporte: true,
        depositoDevolucion: true,
        propiedad: { select: { direccion: true, unidad: true } },
        partes: { select: { personaId: true, papel: true, persona: { select: { nombre: true } } } },
        tramos: {
          select: { numero: true, desde: true, importe: true },
          orderBy: { numero: 'asc' },
        },
        documentos: { select: { estadoFirma: true } },
      },
      orderBy: [{ codigoNum: 'asc' }, { codigo: 'asc' }],
    });
    return { contratos, delMes, mora, evolucion, ingresos, reclamos, polizas, boletas };
  }
}
