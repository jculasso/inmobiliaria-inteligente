import type { AccionEvento, EventoDto } from '@vacker/types';
import { fmtFechaHora } from '../../lib/format';
import { Bloque, VacioBloque } from './piezas';

const ICONO: Record<AccionEvento, string> = {
  alta: '➕',
  edicion: '✏️',
  estado: '🔁',
  anulacion: '🚫',
  borrado: '🗑️',
  indexacion: '📈',
  generacion: '⚙️',
  documento: '📄',
  envio: '✉️',
};

/**
 * Quién hizo qué y cuándo (pedido de Javier del 6/10/2026: «quién es el
 * operador que registra la transacción»). Lo más nuevo arriba; no se edita ni
 * se borra.
 */
export function Historial({ eventos }: { eventos: EventoDto[] }) {
  return (
    <Bloque
      icono="🕓"
      titulo="Historial"
      detalle={
        eventos.length
          ? `${eventos.length} ${eventos.length === 1 ? 'movimiento' : 'movimientos'}`
          : undefined
      }
    >
      {eventos.length === 0 ? (
        <VacioBloque>
          Todavía no hay movimientos registrados. Lo anterior al 6/10/2026 no tiene historial.
        </VacioBloque>
      ) : (
        <ol className="max-h-[28rem] divide-y divide-line overflow-y-auto text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
              <span aria-hidden className="w-5 shrink-0 text-center">
                {ICONO[e.accion]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{e.resumen}</span>
                <span className="block text-xs text-muted">
                  {e.usuario ?? 'Sin operador'} · {fmtFechaHora(e.en)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Bloque>
  );
}
