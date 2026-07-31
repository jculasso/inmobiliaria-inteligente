import {
  TOTAL_SEMANAS,
  type AlertaProtocolo,
  type EmbudoProtocolo,
  type EstadoAccion,
} from '@vacker/types';

// Reglas de negocio del protocolo (semana en curso, avance, embudo y alertas).
// Puras y sin dependencias de Prisma: se testean solas y se reutilizan en el
// informe PDF. Réplica de la lógica del prototipo HTML.

/** Una acción, reducida a lo que estos cálculos necesitan. */
export interface AccionCalc {
  semana: number;
  estado: EstadoAccion;
  fechaPrevista: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Hoy en Argentina (YYYY-MM-DD). Offset fijo -03:00: el país no tiene DST. */
export function hoyArgentina(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Fecha en castellano para los textos que lee una persona: "20 de julio".
 *
 * El año solo aparece si no es el corriente — en un reporte semanal, "vence el
 * 4 de agosto de 2026" sobra, pero una autorización que venció el año pasado
 * necesita decirlo. Los mensajes de alerta mostraban la fecha ISO cruda
 * (`2026-07-20`), que en un informe para la dirección se lee como un dato de
 * sistema, no como una fecha.
 */
export function fechaEnPalabras(iso: string, hoy = hoyArgentina()): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  if (!anio || !mes || !dia) return iso;
  const texto = `${dia} de ${MESES[mes - 1]}`;
  return anio === Number(hoy.slice(0, 4)) ? texto : `${texto} de ${anio}`;
}

/** Días calendario entre dos fechas ISO (b - a). Negativo si b es anterior. */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);
}

/** Suma días a una fecha ISO. */
export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/**
 * Semana en curso (1..5). El protocolo no "termina" solo: pasadas las 5
 * semanas queda clavado en 5 hasta que alguien archive la propiedad.
 */
export function semanaActual(fechaInicio: string, hoy = hoyArgentina()): number {
  const dias = diasEntre(fechaInicio, hoy);
  if (dias < 0) return 1;
  return Math.min(TOTAL_SEMANAS, Math.floor(dias / 7) + 1);
}

/** Días desde el inicio, contando el día de inicio como día 1. */
export function diasPublicada(fechaInicio: string, hoy = hoyArgentina()): number {
  return Math.max(0, diasEntre(fechaInicio, hoy) + 1);
}

/** Fecha prevista de las acciones de una semana: último día de esa semana. */
export function fechaPrevistaDeSemana(fechaInicio: string, semana: number): string {
  return sumarDias(fechaInicio, semana * 7 - 1);
}

/** Avance 0..1 sobre las acciones que corresponden (las "no corresponde" no cuentan). */
export function avance(acciones: AccionCalc[]): number {
  const cuentan = acciones.filter((a) => a.estado !== 'no_corresponde');
  if (cuentan.length === 0) return 0;
  return cuentan.filter((a) => a.estado === 'realizada').length / cuentan.length;
}

/** Avance 0..1 de una semana puntual. Una semana sin acciones aplicables está completa. */
export function avanceSemana(acciones: AccionCalc[], semana: number): number {
  const deLaSemana = acciones.filter((a) => a.semana === semana && a.estado !== 'no_corresponde');
  if (deLaSemana.length === 0) return 1;
  return deLaSemana.filter((a) => a.estado === 'realizada').length / deLaSemana.length;
}

/** Una acción está atrasada si venció y no se cerró. */
export function estaAtrasada(accion: AccionCalc, hoy = hoyArgentina()): boolean {
  if (accion.estado === 'realizada' || accion.estado === 'no_corresponde') return false;
  return accion.fechaPrevista != null && accion.fechaPrevista < hoy;
}

/**
 * Demorada = venció sin cerrarse, **o** quedó pendiente en una semana que ya
 * pasó, tenga fecha prevista o no.
 *
 * La segunda mitad importa: `fechaPrevista` se puede borrar desde la ficha
 * (`UpdateAccionSchema` la acepta nullable), y sin ella `estaAtrasada` nunca
 * daba verdadero. Una acción de la semana 1 sin fecha, con el protocolo en la
 * semana 5, no aparecía en ningún lado. Si la semana terminó y la acción sigue
 * abierta, está demorada — la fecha es un detalle, no la definición.
 */
export function estaDemorada(
  accion: AccionCalc,
  semanaEnCurso: number,
  hoy = hoyArgentina(),
): boolean {
  if (accion.estado === 'realizada' || accion.estado === 'no_corresponde') return false;
  if (accion.semana < semanaEnCurso) return true;
  return accion.fechaPrevista != null && accion.fechaPrevista < hoy;
}

export function calcularEmbudo(m: {
  consultas: number;
  consultasCalificadas: number;
  visitas: number;
  interesadosActivos: number;
  ofertas: number;
}): EmbudoProtocolo {
  return {
    ...m,
    conversionVisita: m.consultas > 0 ? m.visitas / m.consultas : 0,
    conversionOferta: m.visitas > 0 ? m.ofertas / m.visitas : 0,
  };
}

export interface DatosAlertas {
  estado: 'activa' | 'archivada';
  fechaInicio: string;
  vencimientoAutorizacion: string | null;
  /** Última modificación de la ficha, ISO date. */
  actualizadoEn: string | null;
  acciones: AccionCalc[];
  consultas: number;
  visitas: number;
}

/**
 * Alertas de una propiedad, calculadas al vuelo (no se persisten). Mismo
 * criterio que el prototipo: rojo = urge, ámbar = avisa, verde = confirma.
 * Una propiedad archivada ya no alerta.
 */
export function calcularAlertas(d: DatosAlertas, hoy = hoyArgentina()): AlertaProtocolo[] {
  if (d.estado === 'archivada') return [];

  const alertas: AlertaProtocolo[] = [];
  const semana = semanaActual(d.fechaInicio, hoy);

  const atrasadas = d.acciones.filter((a) => estaDemorada(a, semana, hoy));
  if (atrasadas.length > 0) {
    // Se apunta a la semana más vieja con atraso: es por donde hay que empezar.
    const primera = Math.min(...atrasadas.map((a) => a.semana));
    const una = atrasadas.length === 1;
    alertas.push({
      nivel: 'roja',
      titulo: una ? '1 acción atrasada' : `${atrasadas.length} acciones atrasadas`,
      detalle: una
        ? `Venció sin cerrarse. Es de la semana ${primera}.`
        : `Vencieron sin cerrarse. La más antigua es de la semana ${primera}.`,
      semana: primera,
    });
  }

  const vencenHoy = d.acciones.filter(
    (a) => a.estado !== 'realizada' && a.estado !== 'no_corresponde' && a.fechaPrevista === hoy,
  );
  if (vencenHoy.length > 0) {
    const una = vencenHoy.length === 1;
    alertas.push({
      nivel: 'ambar',
      titulo: una ? '1 acción vence hoy' : `${vencenHoy.length} acciones vencen hoy`,
      detalle: una ? 'Si no se cierra hoy, mañana queda atrasada.' : 'Si no se cierran hoy, mañana quedan atrasadas.',
      semana: Math.min(...vencenHoy.map((a) => a.semana)),
    });
  }

  if (d.vencimientoAutorizacion) {
    const restan = diasEntre(hoy, d.vencimientoAutorizacion);
    const cuando = fechaEnPalabras(d.vencimientoAutorizacion, hoy);
    if (restan < 0) {
      alertas.push({
        nivel: 'roja',
        titulo: 'Autorización vencida',
        detalle: `Venció el ${cuando}. Hay que renovarla con el propietario para seguir comercializando.`,
        semana: null,
      });
    } else if (restan <= 10) {
      alertas.push({
        nivel: 'ambar',
        titulo: 'Autorización por vencer',
        detalle:
          restan === 0
            ? `Vence hoy, ${cuando}. Conviene renovarla con el propietario.`
            : `Vence el ${cuando}, en ${restan} ${restan === 1 ? 'día' : 'días'}. Conviene renovarla antes.`,
        semana: null,
      });
    }
  }

  // NO existe una alerta de "semana anterior incompleta". La había y era ruido:
  // toda acción pendiente de una semana pasada ya venció —su fecha prevista es
  // el último día de esa semana—, así que SIEMPRE estaba contenida en "N
  // acciones atrasadas", que además apunta a la misma semana. Decir dos veces lo
  // mismo con distinto color le resta autoridad a las dos.

  if (d.actualizadoEn) {
    const inactividad = diasEntre(d.actualizadoEn, hoy);
    if (inactividad >= 7) {
      alertas.push({
        nivel: 'ambar',
        titulo: 'Sin movimiento hace más de una semana',
        detalle: `Pasaron ${inactividad} días sin registrar avances en la ficha.`,
        semana: null,
      });
    }
  }

  if (semana >= TOTAL_SEMANAS && d.consultas === 0 && d.visitas === 0) {
    alertas.push({
      nivel: 'ambar',
      titulo: 'Faltan los resultados comerciales',
      detalle: 'Sin consultas ni visitas cargadas, el informe al propietario queda sin respaldo.',
      semana: null,
    });
  }

  if (semana === TOTAL_SEMANAS && avanceSemana(d.acciones, TOTAL_SEMANAS) === 1) {
    alertas.push({
      nivel: 'verde',
      titulo: 'Protocolo listo para cierre',
      detalle: 'Se completaron las cinco semanas. Corresponde emitir el informe final y acordar con el propietario cómo sigue.',
      semana: TOTAL_SEMANAS,
    });
  }

  return alertas;
}

/** Nivel más urgente de un conjunto de alertas. */
export function prioridad(alertas: AlertaProtocolo[]): 'roja' | 'ambar' | 'verde' {
  if (alertas.some((a) => a.nivel === 'roja')) return 'roja';
  if (alertas.some((a) => a.nivel === 'ambar')) return 'ambar';
  return 'verde';
}
