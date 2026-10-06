'use client';

import { PantallaError } from '../components/pantalla-error';

/**
 * Boundary de error de la raíz. Antes, cualquier falla al cargar el perfil
 * (incluida una demora de la API, muy real con el free tier de Render) se
 * mostraba como «tu cuenta no está habilitada»: un mensaje falso. Ahora llega
 * acá, con un mensaje correcto. También atrapa los errores de los layouts de
 * cada módulo: el error.tsx de un segmento no envuelve a su propio layout.
 */
export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PantallaError
      titulo="No pudimos conectar con el servidor"
      descripcion="Puede tardar unos segundos en responder la primera vez. Probá de nuevo en un momento."
      reset={reset}
    />
  );
}
