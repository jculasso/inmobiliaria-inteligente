'use client';

import { PantallaError } from '../../components/pantalla-error';

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PantallaError
      titulo="Algo salió mal en Administración"
      descripcion="Ocurrió un error o el servidor tardó en responder. Podés reintentar o volver al inicio."
      reset={reset}
    />
  );
}
