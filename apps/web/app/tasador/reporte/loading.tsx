/**
 * Skeleton propio de "Reporte" (misma razón que tasaciones/loading.tsx: el
 * genérico del dashboard no se parece a esta pantalla).
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-48 animate-pulse rounded bg-line" />
        <div className="h-9 w-64 animate-pulse rounded-brand bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-brand border border-line bg-white" />
    </div>
  );
}
