import { ColdStartHint } from '../components/cold-start-hint';

/**
 * Se muestra automáticamente mientras `app/page.tsx` (Server Component
 * async) espera la respuesta de la API — sin esto, con la API en el free
 * tier de Render (se duerme por inactividad, el primer request tras
 * dormirse tarda bastante) la navegación quedaba en blanco sin ningún
 * feedback hasta que la respuesta llegaba o Vercel cortaba por timeout.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-line" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-40 animate-pulse rounded bg-line" />
          <div className="h-7 w-72 animate-pulse rounded bg-line" />
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted">Cargando…</p>
      <ColdStartHint />
    </main>
  );
}
