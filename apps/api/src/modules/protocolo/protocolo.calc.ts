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

  const atrasadas = d.acciones.filter((a) => estaAtrasada(a, hoy));
  if (atrasadas.length > 0) {
    // Se apunta a la semana más vieja con atraso: es por donde hay que empezar.
    const primera = Math.min(...atrasadas.map((a) => a.semana));
    alertas.push({
      nivel: 'roja',
      titulo: atrasadas.length === 1 ? '1 acción atrasada' : `${atrasadas.length} acciones atrasadas`,
      detalle: 'Vencieron sin cerrarse. Revisá la semana correspondiente.',
      semana: primera,
    });
  }

  const vencenHoy = d.acciones.filter(
    (a) => a.estado !== 'realizada' && a.estado !== 'no_corresponde' && a.fechaPrevista === hoy,
  );
  if (vencenHoy.length > 0) {
    alertas.push({
      nivel: 'ambar',
      titulo: vencenHoy.length === 1 ? '1 acción vence hoy' : `${vencenHoy.length} acciones vencen hoy`,
      detalle: 'Cerralas hoy para no arrastrar atraso a la semana siguiente.',
      semana: Math.min(...vencenHoy.map((a) => a.semana)),
    });
  }

  if (d.vencimientoAutorizacion) {
    const restan = diasEntre(hoy, d.vencimientoAutorizacion);
    if (restan < 0) {
      alertas.push({
        nivel: 'roja',
        titulo: 'Autorización vencida',
        detalle: `Venció el ${d.vencimientoAutorizacion}. Hay que renovarla con el propietario.`,
        semana: null,
      });
    } else if (restan <= 10) {
      alertas.push({
        nivel: 'ambar',
        titulo: 'Autorización por vencer',
        detalle: `Vence el ${d.vencimientoAutorizacion} (${restan} ${restan === 1 ? 'día' : 'días'}).`,
        semana: null,
      });
    }
  }

  if (semana > 1) {
    const pendientesPrevias = d.acciones.filter(
      (a) => a.semana < semana && a.estado !== 'realizada' && a.estado !== 'no_corresponde',
    );
    if (pendientesPrevias.length > 0) {
      alertas.push({
        nivel: 'ambar',
        titulo: 'Semana anterior incompleta',
        detalle: `Quedan ${pendientesPrevias.length} acciones sin cerrar antes de la semana ${semana}.`,
        semana: Math.min(...pendientesPrevias.map((a) => a.semana)),
      });
    }
  }

  if (d.actualizadoEn) {
    const inactividad = diasEntre(d.actualizadoEn, hoy);
    if (inactividad >= 7) {
      alertas.push({
        nivel: 'ambar',
        titulo: 'Sin actividad reciente',
        detalle: `Pasaron ${inactividad} días desde la última actualización.`,
        semana: null,
      });
    }
  }

  if (semana >= TOTAL_SEMANAS && d.consultas === 0 && d.visitas === 0) {
    alertas.push({
      nivel: 'ambar',
      titulo: 'Resultados comerciales sin cargar',
      detalle: 'Completá consultas y visitas: son los datos que alimentan el informe del propietario.',
      semana: null,
    });
  }

  if (semana === TOTAL_SEMANAS && avanceSemana(d.acciones, TOTAL_SEMANAS) === 1) {
    alertas.push({
      nivel: 'verde',
      titulo: 'Protocolo listo para cierre',
      detalle: 'Corresponde emitir el informe final y acordar la próxima estrategia.',
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
