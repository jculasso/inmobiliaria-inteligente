'use client';

import { PantallaError } from '../../components/pantalla-error';

export default function CambiarClaveError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PantallaError
      titulo="No pudimos cargar esta pantalla"
      descripcion="Ocurrió un error o el servidor tardó en responder. Podés reintentar o volver al inicio."
      reset={reset}
    />
  );
}
