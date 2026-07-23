import path from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * Tipografía de marca Vacker (CLAUDE.md §6) para los PDF del Tasador (informe y
 * reporte). El registro corre una sola vez al importar este módulo. Los `.ttf`
 * viven acá al lado (`./fonts`) y se copian a `dist` vía nest-cli.json
 * ("assets"); `__dirname` resuelve tanto en el build (dist) como en los tests
 * (src), sin dependencia de red al generar el PDF.
 */
export const FUENTE_MARCA = 'Montserrat';

Font.register({
  family: FUENTE_MARCA,
  fonts: [
    { src: path.join(__dirname, 'fonts', 'Montserrat-Regular.ttf'), fontWeight: 400 },
    { src: path.join(__dirname, 'fonts', 'Montserrat-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(__dirname, 'fonts', 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(__dirname, 'fonts', 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
  ],
});
// No cortar palabras con guiones al final de línea (comportamiento por defecto de react-pdf).
Font.registerHyphenationCallback((word) => [word]);
