/**
 * Feedback instantáneo mientras el layout/página esperan la respuesta de la API
 * (ver app/loading.tsx).
 *
 * Los márgenes replican los de `TableroLayout` (`px-4 py-8 sm:px-6 sm:py-10`):
 * antes usaba `px-6 py-10` fijos, así que en el celular el esqueleto arrancaba
 * 8px más adentro y todo se corría al llegar el contenido.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-8 w-56 max-w-full animate-pulse rounded bg-line" />
      <div className="mt-6 flex gap-2 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-32 shrink-0 animate-pulse rounded-brand bg-line" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>
      <div className="mt-4 h-64 animate-pulse rounded-brand border border-line bg-white" />
    </main>
  );
}
