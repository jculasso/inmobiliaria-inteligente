import { Injectable, Logger } from '@nestjs/common';

/**
 * Eventos de dominio en acciones facturables (tasacion_creada, tasacion_estado_cambiado,
 * tasacion_captada, informe_generado, ...). Fase 1 no tiene cola/bus de eventos
 * (CLAUDE.md difiere Redis/colas a la fase de escala) — por ahora es un log
 * estructurado, listo para conectar a un bus real más adelante sin tocar los
 * call sites. No específico de Tasador: cualquier módulo lo puede reusar.
 */
@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger('DomainEvent');

  emit(nombre: string, payload: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ evento: nombre, ...payload, timestamp: new Date().toISOString() }));
  }
}
