/**
 * Feedback instantáneo mientras el dashboard espera la respuesta de la API
 * (ver app/loading.tsx). Ocupa solo el `children` de `TasadorLayout` — el
 * título y el nav (Dashboard/Tasaciones/Reporte) ya los pinta el layout, que
 * persiste entre navegaciones, así que no hace falta duplicarlos acá (antes
 * este skeleton traía su propia barra de "tabs" falsa que se veía superpuesta
 * un instante con el nav real).
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-brand border border-line bg-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-brand border border-line bg-white" />
    </div>
  );
}
