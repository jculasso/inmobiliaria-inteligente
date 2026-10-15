import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { URL_API } from './simulador/identidad';

/**
 * El seguro de que ninguna prueba alcance la base de producción.
 *
 * Las pruebas con sesión mandan pedidos a la API con un token de mentira. Si la
 * web estuviera compilada con el `.env` de la raíz —el de la máquina de
 * desarrollo, con las credenciales reales—, esos pedidos irían a la API de
 * producción. No pasarían (el token no es válido), pero no tienen por qué
 * llegar siquiera.
 *
 * Next escribe `NEXT_PUBLIC_API_URL` dentro del código compilado. Si la
 * dirección del simulador no aparece ahí, la compilación es otra y no se corre
 * nada: la salida es `pnpm --filter @vacker/web test:e2e`, que compila con
 * `e2e/entorno-de-prueba.env` antes de probar.
 */
function archivosJs(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosJs(ruta);
    return ruta.endsWith('.js') ? [ruta] : [];
  });
}

export default function globalSetup() {
  const chunks = join(__dirname, '..', '.next', 'static', 'chunks');
  let apuntaAlSimulador = false;
  try {
    apuntaAlSimulador = archivosJs(chunks).some((f) => readFileSync(f, 'utf8').includes(URL_API));
  } catch {
    // Sin `.next`: el mismo mensaje de abajo.
  }
  if (!apuntaAlSimulador) {
    throw new Error(
      `La web compilada no apunta al simulador (${URL_API}). Las pruebas con sesión ` +
        'no corren contra otra cosa. Usá `pnpm --filter @vacker/web test:e2e`, que ' +
        'compila con e2e/entorno-de-prueba.env.',
    );
  }
}
