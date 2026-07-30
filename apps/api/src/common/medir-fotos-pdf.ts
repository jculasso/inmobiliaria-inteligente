import { inflateSync } from 'node:zlib';

/**
 * Saca de un PDF, para cada foto grande, el alto de su caja de recorte y el
 * alto al que se dibujó. Si la caja es más baja que el dibujo, hay recorte.
 *
 * Existe para poder afirmar en un test algo que sin esto solo se puede ver
 * abriendo el archivo: que las fotos de los informes se muestren enteras.
 * Vive en common porque la regla vale para los dos informes, y tenerla dos
 * veces sería que se separen.
 */
export function medirFotosPdf(buffer: Buffer): { cajaAlto: number; fotoAlto: number }[] {
  const bin = buffer.toString('binary');
  const salida: { cajaAlto: number; fotoAlto: number }[] = [];

  for (const m of bin.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let txt: string;
    try {
      txt = inflateSync(Buffer.from(m[1]!, 'binary')).toString('binary');
    } catch {
      continue;
    }

    for (const dibujo of txt.matchAll(/([-\d.]+) [-\d.]+ [-\d.]+ ([-\d.]+) [-\d.]+ [-\d.]+ cm\s*\/\w+ Do/g)) {
      const fotoAlto = Math.abs(Number(dibujo[2]));
      // Solo las fotos de propiedad: el logo y el avatar del agente son chicos.
      if (fotoAlto < 100) continue;

      /*
       * Cuando la caja y la foto tienen la misma proporción no hay nada que
       * recortar, y react-pdf directamente NO emite recorte. Por eso el recorte
       * solo cuenta si está PEGADO al dibujo: entre uno y otro apenas hay un
       * `gs` y un `q`. Sin esta restricción el parser agarraba un recorte
       * externo de la página y reportaba un recorte que no existía.
       */
      const antes = txt.slice(0, dibujo.index);
      const corte = antes.lastIndexOf('W n');
      const pegado = corte >= 0 && dibujo.index! - corte < 80;
      if (!pegado) {
        salida.push({ cajaAlto: fotoAlto, fotoAlto });
        continue;
      }

      /*
       * El trazado del recorte empieza justo después de un `q`. Cortar por ahí
       * y no por una cantidad fija de caracteres evita arrastrar el final del
       * trazado anterior, que metía coordenadas ajenas y daba un alto que no
       * era el de esta caja.
       */
      const desde = antes.lastIndexOf('q', corte);
      const path = antes.slice(desde >= 0 ? desde : Math.max(0, corte - 600), corte);
      const ys = [...path.matchAll(/([-\d.]+)\s+(?:l|c|m)\b/g)].map((y) => Number(y[1]));
      /*
       * El alto es la DIFERENCIA entre el máximo y el mínimo, no el máximo.
       * Según la sección, el trazado viene en coordenadas relativas —arranca en
       * 0— o absolutas de la página. Tomar el máximo daba el alto correcto en el
       * primer caso y un número disparatado en el segundo.
       */
      const cajaAlto = ys.length ? Math.max(...ys) - Math.min(...ys) : fotoAlto;
      salida.push({ cajaAlto, fotoAlto });
    }
  }
  return salida;
}
