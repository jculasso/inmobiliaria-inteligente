'use client';

/**
 * Imprime la página actual, que en la práctica es "guardar como PDF".
 *
 * Se usa el diálogo del propio navegador en vez de generar el archivo en el
 * servidor por dos razones: sale SIEMPRE actualizado —es la misma página que
 * se está mirando— y no hay que esperar a que el backend despierte, que en el
 * plan gratis puede tardar bastante.
 *
 * Qué se imprime y qué no lo decide `globals.css` (bloque `@media print`).
 */
export function BotonImprimir({ nombre }: { nombre: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title={`Guardar “${nombre}” como PDF`}
      className="shrink-0 rounded-brand border border-line bg-white px-3 py-2 text-xs font-bold text-ink transition-colors hover:border-brand-red hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 print:hidden"
    >
      ⇩ Descargar PDF
    </button>
  );
}
