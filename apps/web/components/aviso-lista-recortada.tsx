import { LIMITE_LISTA } from '@vacker/types';

/**
 * Avisa que la lista está mostrando solo una parte.
 *
 * El tope de filas existía desde siempre, pero era MUDO: alguien con 1.240
 * operaciones veía 500 y no se enteraba. Eso no es lentitud, es tomar
 * decisiones con datos incompletos sin saberlo — y quien más lo sufre es el
 * implementador, que audita la base recorriendo estas listas.
 *
 * Mientras no haya paginación real, al menos que se vea.
 */
export function AvisoListaRecortada({ que }: { que: string }) {
  return (
    <div
      role="status"
      className="rounded-brand border border-line border-l-[3px] border-l-amber-500 bg-amber-50 px-4 py-3"
    >
      <p className="text-sm font-bold text-ink">
        Se están mostrando {LIMITE_LISTA} {que}, y hay más.
      </p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-ink/80">
        La lista muestra las más recientes. Para ver el resto, usá los filtros de arriba —por año o por
        período— hasta que el resultado baje de {LIMITE_LISTA}.
      </p>
    </div>
  );
}
