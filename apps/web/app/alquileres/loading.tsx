import { ColdStartHint } from '../../components/cold-start-hint';

/**
 * Feedback instantáneo mientras la página espera a la API. Ocupa solo el
 * `children` del layout: el título y el menú ya los pinta `AlquileresLayout`.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>
      <ColdStartHint />
    </div>
  );
}
