import { ColdStartHint } from '../../../components/cold-start-hint';

/**
 * Skeleton propio de "Tasaciones" (antes reusaba el del dashboard, con forma
 * de KPIs+gráfico — no se parecía en nada a esta pantalla y se sentía como un
 * flash raro al cambiar de pestaña). Solo el `children` del layout: título,
 * nav y buscador reales quedan para cuando cargue la página.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-9 w-full max-w-sm animate-pulse rounded-brand bg-line" />
        <div className="h-9 w-36 animate-pulse rounded-brand bg-line" />
      </div>
      <div className="overflow-hidden rounded-brand border border-line bg-white">
        <div className="h-9 border-b border-line bg-surface" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse border-b border-line last:border-0" />
        ))}
      </div>
      <ColdStartHint />
    </div>
  );
}
