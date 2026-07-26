import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FlyerComercial } from '../src/marketing/flyer-comercial.template';

/**
 * Genera el flyer comercial como ARCHIVO ESTÁTICO y lo deja en la web.
 *
 * A propósito no es un endpoint: lo usa un vendedor en una reunión, y ahí nadie
 * espera los 30-60 segundos que tarda en despertarse el backend del free tier.
 * Servido como archivo abre al instante y se puede mandar por WhatsApp.
 *
 * El contenido no depende de ninguna inmobiliaria, así que se regenera solo
 * cuando cambia el mensaje:
 *
 *     pnpm --filter @vacker/api flyer
 *
 * y se commitea el PDF resultante.
 */
async function main() {
  const destino = path.join(__dirname, '..', '..', 'web', 'public', 'flyer-comercial.pdf');

  const buffer = await renderToBuffer(<FlyerComercial />);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, buffer);

  const kb = (buffer.length / 1024).toFixed(0);
  console.log(`[flyer] ${destino} — ${kb} KB`);

  // Mandarlo por WhatsApp con datos móviles tiene que ser instantáneo.
  if (buffer.length > 2 * 1024 * 1024) {
    console.warn('[flyer] Pesa más de 2 MB: revisar imágenes antes de publicarlo.');
  }
}

main().catch((err) => {
  console.error('[flyer] falló la generación:', err);
  process.exit(1);
});
