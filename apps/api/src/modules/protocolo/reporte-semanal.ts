import {
  SEMANAS,
  type AlertaProtocolo,
  type EstadoSemana,
  type ItemUrgente,
  type NivelAlerta,
  type PropiedadEnReporte,
  type ReporteSemanal,
  type ResumenReporte,
  type SemanaEnReporte,
  type VendedorEnReporte,
} from '@vacker/types';
import {
  avanceSemana,
  calcularAlertas,
  diasPublicada,
  estaDemorada,
  hoyArgentina,
  prioridad,
  semanaActual,
  type AccionCalc,
  type DatosAlertas,
} from './protocolo.calc';

// Generador del reporte semanal que se le manda por mail a la dirección y que
// el CEO también puede correr a pedido desde la aplicación.
//
// Es una función PURA a propósito: no toca Prisma, no manda mails y no sabe
// qué día es salvo que se lo digan. Así se puede escribir y verificar entero
// antes de que exista el proveedor de envío, y el día que se cambie el
// proveedor esto no se toca.
//
// El contrato de salida vive en @vacker/types porque lo consumen los dos
// lados. Especificación: docs/specs/reporte-semanal-protocolo.md — los
// números de regla de los comentarios son los de ese documento.

/** Lo que el generador necesita de un protocolo. Deliberadamente chico. */
export interface ProtocoloParaReporte {
  id: string;
  direccion: string;
  /** Key o URL de la portada; el servicio la firma después de generar. */
  fotoUrl: string | null;
  estado: 'activa' | 'archivada';
  fechaInicio: string;
  vencimientoAutorizacion: string | null;
  actualizadoEn: string | null;
  consultas: number;
  visitas: number;
  acciones: AccionCalc[];
  agente: { id: string; nombre: string };
}

const ORDEN_NIVEL: Record<NivelAlerta, number> = { roja: 0, ambar: 1, verde: 2 };

const TITULO_CIERRE = 'Protocolo listo para cierre';

/** Compara textos como los ordenaría una persona (acentos y ñ incluidos). */
function porTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

function estadoDeSemana(semana: number, enCurso: number, acciones: AccionCalc[]): EstadoSemana {
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

  const semanas: SemanaEnReporte[] = SEMANAS.map((semana) => {
    const aplicables = p.acciones.filter(
      (a) => a.semana === semana && a.estado !== 'no_corresponde',
    );
    return {
      semana,
      estado: estadoDeSemana(semana, enCurso, p.acciones),
      atrasadas: aplicables.filter((a) => estaDemorada(a, enCurso, hoy)).length,
      pendientes: aplicables.filter((a) => a.estado !== 'realizada').length,
      // El verde de cierre NO se repite acá: ya lo dice `listoParaCierre` con
      // su frase, y ponerlo además como alerta al lado de una roja era
      // justamente lo que se leía como contradicción.
      alertas: alertas.filter((a) => a.semana === semana && a.titulo !== TITULO_CIERRE),
    };
  });

  // El protocolo se puede cerrar con tareas pendientes —decisión de la
  // dirección el 30/07/2026— pero el reporte tiene que decirlo. Antes el verde
  // aparecía pelado al lado de una alerta roja y parecía una contradicción.
  const listoParaCierre = alertas.some((a) => a.titulo === TITULO_CIERRE);
  const pendientesArrastrados = p.acciones.filter(
    (a) => a.semana < enCurso && a.estado !== 'realizada' && a.estado !== 'no_corresponde',
  ).length;

  return {
    protocoloId: p.id,
    direccion: p.direccion,
    fotoUrl: p.fotoUrl,
    fechaInicio: p.fechaInicio,
    diasTranscurridos: diasPublicada(p.fechaInicio, hoy),
    semanaActual: enCurso,
    prioridad: prioridad(alertas),
    listoParaCierre,
    pendientesArrastrados,
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
  const urgencias: ItemUrgente[] = [];
  for (const grupo of porVendedor) {
    for (const propiedad of grupo.propiedades) {
      const rojas = rojasDe(propiedad);
      if (rojas.length > 0) {
        urgencias.push({
          vendedorNombre: grupo.vendedorNombre,
          direccion: propiedad.direccion,
          protocoloId: propiedad.protocoloId,
          alertas: rojas,
        });
      }
    }
  }

  const todas = porVendedor.flatMap((g) => g.propiedades);
  const listas = todas.filter((p) => p.listoParaCierre);
  const resumen: ResumenReporte = {
    activas: todas.length,
    conRojas: todas.filter((p) => p.prioridad === 'roja').length,
    autorizacionesEnRiesgo: todas.filter((p) => p.alertasGenerales.some(esDeAutorizacion)).length,
    listasParaCierre: listas.length,
    listasConPendientes: listas.filter((p) => p.pendientesArrastrados > 0).length,
  };

  return {
    generadoEl: hoy,
    resumen,
    hayUrgencias: urgencias.length > 0,
    urgencias,
    porVendedor,
  };
}
