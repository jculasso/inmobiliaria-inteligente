import { ColdStartHint } from './cold-start-hint';

/**
 * El esqueleto de una página mientras espera a la API. Ocupa solo el
 * `children` del layout: el título y el menú del módulo ya están pintados,
 * así que no se dibujan otra vez (un menú falso superpuesto con el real era el
 * «salto» que se veía). Con el aviso de que Render puede estar despertando.
 */
export function EsqueletoModulo({ tarjetas = 4 }: { tarjetas?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: tarjetas }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-brand border border-line bg-white" />
      <ColdStartHint />
    </div>
  );
}
