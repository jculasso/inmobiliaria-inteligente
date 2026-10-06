'use client';

import { PantallaError } from '../../components/pantalla-error';

export default function AlquileresError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError titulo="Algo salió mal en Alquileres" descripcion="Ocurrió un error o el servidor tardó en responder. Podés reintentar o volver al inicio." reset={reset} />;
}
