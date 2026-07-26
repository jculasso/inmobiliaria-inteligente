import { ColdStartHint } from '../components/cold-start-hint';

/**
 * Se muestra automáticamente mientras `app/page.tsx` (Server Component
 * async) espera la respuesta de la API — sin esto, con la API en el free
 * tier de Render (se duerme por inactividad, el primer request tras
 * dormirse tarda bastante) la navegación quedaba en blanco sin ningún
 * feedback hasta que la respuesta llegaba o Vercel cortaba por timeout.
 *
 * Los tamaños y márgenes replican los de `home-view` a propósito: si el
 * esqueleto no coincide con lo que aparece después, al terminar de cargar todo
 * se reacomoda de golpe. Además, una de las barras tenía ancho fijo (288px) y
 * en un celular de 375px desbordaba la pantalla a lo ancho.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-line sm:h-14 sm:w-14" />
        {/* `min-w-0` + anchos relativos: nunca empujan más allá de la pantalla. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-3 w-32 max-w-full animate-pulse rounded bg-line" />
          <div className="h-6 w-64 max-w-full animate-pulse rounded bg-line" />
        </div>
      </div>

      <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-line" />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-52 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted">Cargando…</p>
      <ColdStartHint />
    </main>
  );
}
