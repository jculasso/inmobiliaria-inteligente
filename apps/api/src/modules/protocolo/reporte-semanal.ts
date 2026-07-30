import { SEMANAS, type AlertaProtocolo, type NivelAlerta } from '@vacker/types';
import {
  avanceSemana,
  calcularAlertas,
  estaAtrasada,
  hoyArgentina,
  prioridad,
  semanaActual,
  type AccionCalc,
  type DatosAlertas,
} from './protocolo.calc';

// Generador del reporte semanal que se le manda por mail a la dirección.
//
// Es una función PURA a propósito: no toca Prisma, no manda mails y no sabe
// qué día es salvo que se lo digan. Así se puede escribir y verificar entero
// antes de que exista el proveedor de envío, y el día que se cambie el
// proveedor esto no se toca.
//
// Especificación: docs/specs/reporte-semanal-protocolo.md — los números de
// regla que aparecen en los comentarios son los de ese documento.

/** Estado de una de las cinco semanas del protocolo (regla 6). */
export type EstadoSemana = 'futura' | 'completa' | 'en_curso' | 'incompleta';

export interface SemanaEnReporte {
  semana: number;
  estado: EstadoSemana;
  /** Acciones vencidas y sin cerrar de esta semana. */
  atrasadas: number;
  /** Acciones aplicables todavía sin realizar (incluye las atrasadas). */
  pendientes: number;
  /** Alertas atribuidas a esta semana (regla 7). */
  alertas: AlertaProtocolo[];
}

/** Lo que el generador necesita de un protocolo. Deliberadamente chico. */
export interface ProtocoloParaReporte {
  id: string;
  direccion: string;
  estado: 'activa' | 'archivada';
  fechaInicio: string;
  vencimientoAutorizacion: string | null;
  actualizadoEn: string | null;
  consultas: number;
  visitas: number;
  acciones: AccionCalc[];
  agente: { id: string; nombre: string };
}

export interface PropiedadEnReporte {
  protocoloId: string;
  direccion: string;
  semanaActual: number;
  prioridad: NivelAlerta;
  /** Alertas sin semana: son de la propiedad, no del proceso (regla 7). */
  alertasGenerales: AlertaProtocolo[];
  semanas: SemanaEnReporte[];
}

export interface VendedorEnReporte {
  vendedorId: string;
  vendedorNombre: string;
  propiedades: PropiedadEnReporte[];
  /** Cuántas de sus propiedades tienen al menos una alerta roja. */
  conRojas: number;
}

export interface ResumenReporte {
  activas: number;
  conRojas: number;
  autorizacionesEnRiesgo: number;
  listasParaCierre: number;
}

export interface ItemDecision {
  vendedorNombre: string;
  direccion: string;
  protocoloId: string;
  alertas: AlertaProtocolo[];
}

export interface ReporteSemanal {
  generadoEl: string;
  resumen: ResumenReporte;
  /**
   * Si es `false` no hay nada rojo y el mail va corto: solo el resumen
   * (regla 9). Un mail que mide siempre lo mismo se ignora enseguida.
   */
  necesitaAtencion: boolean;
  /** Solo lo rojo, de todos los vendedores. Es lo primero que se lee (regla 5). */
  necesitaDecision: ItemDecision[];
  porVendedor: VendedorEnReporte[];
}

const ORDEN_NIVEL: Record<NivelAlerta, number> = { roja: 0, ambar: 1, verde: 2 };

/** Compara textos como los ordenaría una persona (acentos y ñ incluidos). */
function porTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

function estadoDeSemana(
  semana: number,
  enCurso: number,
  acciones: AccionCalc[],
): EstadoSemana {
  if (semana > enCurso) return 'futura';
  // Una semana sin acciones aplicables cuenta como completa: `avanceSemana`
  // devuelve 1 para el conjunto vacío, así que las "no corresponde" no la
  // dejan colgada para siempre.
  if (avanceSemana(acciones, semana) === 1) return 'completa';
  return semana === enCurso ? 'en_curso' : 'incompleta';
}

function armarPropiedad(p: ProtocoloParaReporte, hoy: string): PropiedadEnReporte {
  const datos: DatosAlertas = {
    estado: p.estado,
    fechaInicio: p.fechaInicio,
    vencimientoAutorizacion: p.vencimientoAutorizacion,
    actualizadoEn: p.actualizadoEn,
    acciones: p.acciones,
    consultas: p.consultas,
    visitas: p.visitas,
  };
  // Regla 2: la MISMA función que el dashboard. No se reimplementa nada.
  const alertas = calcularAlertas(datos, hoy);
  const enCurso = semanaActual(p.fechaInicio, hoy);

  const semanas = SEMANAS.map((semana) => {
    const aplicables = p.acciones.filter(
      (a) => a.semana === semana && a.estado !== 'no_corresponde',
    );
    return {
      semana,
      estado: estadoDeSemana(semana, enCurso, p.acciones),
      atrasadas: aplicables.filter((a) => estaAtrasada(a, hoy)).length,
      pendientes: aplicables.filter((a) => a.estado !== 'realizada').length,
      alertas: alertas.filter((a) => a.semana === semana),
    };
  });

  return {
    protocoloId: p.id,
    direccion: p.direccion,
    semanaActual: enCurso,
    prioridad: prioridad(alertas),
    alertasGenerales: alertas.filter((a) => a.semana == null),
    semanas,
  };
}

/** Título de alerta que habla de la autorización, para el contador del resumen. */
function esDeAutorizacion(a: AlertaProtocolo): boolean {
  return a.titulo === 'Autorización vencida' || a.titulo === 'Autorización por vencer';
}

function rojasDe(p: PropiedadEnReporte): AlertaProtocolo[] {
  const deSemanas = p.semanas.flatMap((s) => s.alertas);
  return [...p.alertasGenerales, ...deSemanas].filter((a) => a.nivel === 'roja');
}

function todasLasAlertas(p: PropiedadEnReporte): AlertaProtocolo[] {
  return [...p.alertasGenerales, ...p.semanas.flatMap((s) => s.alertas)];
}

/**
 * Arma el reporte de una inmobiliaria a partir de sus protocolos.
 *
 * `hoy` se pasa siempre desde afuera —nunca se lee el reloj acá— para que los
 * tests sean deterministas y para que un reporte se pueda regenerar tal como
 * salió un lunes cualquiera.
 */
export function generarReporteSemanal(
  protocolos: ProtocoloParaReporte[],
  hoy: string = hoyArgentina(),
): ReporteSemanal {
  // Regla 1: solo activos. Los archivados no alertan y no son trabajo en curso.
  const activos = protocolos.filter((p) => p.estado === 'activa');

  const porVendedorMap = new Map<string, VendedorEnReporte>();
  for (const proto of activos) {
    const propiedad = armarPropiedad(proto, hoy);
    let grupo = porVendedorMap.get(proto.agente.id);
    if (!grupo) {
      grupo = {
        vendedorId: proto.agente.id,
        vendedorNombre: proto.agente.nombre,
        propiedades: [],
        conRojas: 0,
      };
      porVendedorMap.set(proto.agente.id, grupo);
    }
    grupo.propiedades.push(propiedad);
    if (propiedad.prioridad === 'roja') grupo.conRojas += 1;
  }

  const porVendedor = [...porVendedorMap.values()]
    // Regla 3: alfabético, no por urgencia. Semana a semana cada uno se
    // encuentra en el mismo lugar; lo urgente ya lo levanta necesitaDecision.
    .sort((a, b) => porTexto(a.vendedorNombre, b.vendedorNombre));

  for (const grupo of porVendedor) {
    // Regla 4: dentro del vendedor sí manda la urgencia.
    grupo.propiedades.sort(
      (a, b) =>
        ORDEN_NIVEL[a.prioridad] - ORDEN_NIVEL[b.prioridad] ||
        porTexto(a.direccion, b.direccion),
    );
  }

  // Regla 5: lo rojo primero, respetando el orden ya establecido.
  const necesitaDecision: ItemDecision[] = [];
  for (const grupo of porVendedor) {
    for (const propiedad of grupo.propiedades) {
      const rojas = rojasDe(propiedad);
      if (rojas.length > 0) {
        necesitaDecision.push({
          vendedorNombre: grupo.vendedorNombre,
          direccion: propiedad.direccion,
          protocoloId: propiedad.protocoloId,
          alertas: rojas,
        });
      }
    }
  }

  const todas = porVendedor.flatMap((g) => g.propiedades);
  const resumen: ResumenReporte = {
    activas: todas.length,
    conRojas: todas.filter((p) => p.prioridad === 'roja').length,
    autorizacionesEnRiesgo: todas.filter((p) => p.alertasGenerales.some(esDeAutorizacion))
      .length,
    listasParaCierre: todas.filter((p) =>
      todasLasAlertas(p).some((a) => a.titulo === 'Protocolo listo para cierre'),
    ).length,
  };

  return {
    generadoEl: hoy,
    resumen,
    necesitaAtencion: necesitaDecision.length > 0,
    necesitaDecision,
    porVendedor,
  };
}
