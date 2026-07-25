/**
 * Regenera los PNG del ícono de la app desde el SVG fuente.
 *
 *   pnpm iconos
 *
 * La fuente es `apps/web/public/icons/icono.svg` (y su variante maskable):
 * editá ESE archivo y volvé a correr esto, para que todos los tamaños queden
 * consistentes.
 *
 * Por qué cada archivo:
 *  - apple-touch-icon (180) → iOS; no acepta SVG y sin él se lleva una captura
 *    de la página al agregarla a la pantalla de inicio.
 *  - icon-192 / icon-512   → los que declara el manifest de la PWA.
 *  - icon-maskable-512     → Android puede recortar el ícono (círculo u otra
 *    forma); esta variante trae la marca más chica para que no se coma nada.
 *  - favicon-32            → pestaña del navegador.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ICONOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public', 'icons');
const svg = readFileSync(join(ICONOS, 'icono.svg'));
const svgMaskable = readFileSync(join(ICONOS, 'icono-maskable.svg'));

const SALIDAS = [
  [svg, 'apple-touch-icon.png', 180],
  [svg, 'icon-192.png', 192],
  [svg, 'icon-512.png', 512],
  [svg, 'favicon-32.png', 32],
  [svgMaskable, 'icon-maskable-512.png', 512],
];

for (const [fuente, nombre, size] of SALIDAS) {
  // `density` alto: el SVG se rasteriza a buena resolución antes de escalar,
  // si no los bordes curvos salen dentados en los tamaños grandes.
  const buf = await sharp(fuente, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(ICONOS, nombre), buf);
  console.log(`  ${nombre.padEnd(26)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
