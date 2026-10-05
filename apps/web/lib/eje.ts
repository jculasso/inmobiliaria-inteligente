/**
 * Las marcas de un eje: el techo y los valores donde va cada rayita.
 *
 * Hasta el 5/10/2026 el gráfico partía el techo en cuartos fijos. Con un techo
 * de 5.000 las marcas caían en 1.250, 2.500 y 3.750, y `fmtK` —que redondea a
 * miles— las imprimía «$1k», «$3k» y «$4k»: el eje se salteaba el 2 y cada
 * punto parecía estar donde no estaba. Con 90.000 pasaba lo mismo: «$23k»,
 * «$68k».
 *
 * Ahora el paso es un número redondo (1, 2 o 5 por una potencia de diez) y la
 * cantidad de marcas sale de ahí: a lo sumo `tramos` (cinco por defecto; un
 * panel bajo pide menos, porque cinco rayitas en 80px no se leen).
 *
 * El paso además nunca es más fino que lo que la etiqueta puede escribir:
 * `fmtK` muestra miles enteros y millones con un decimal. Un paso de 500 en un
 * eje que llega a 2.000 daría «$2k» para 1.500 — la misma mentira de antes.
 */
export function marcasDelEje(max: number, enteros = false, tramos = 5): { techo: number; marcas: number[] } {
  if (!(max > 0)) return { techo: enteros ? 4 : 1, marcas: enteros ? [0, 1, 2, 3, 4] : [0, 1] };

  const crudo = max / tramos;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  let paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= crudo)!;
  if (enteros) paso = Math.max(1, Math.ceil(paso));

  // La resolución de la etiqueta, medida sobre el techo que resultaría.
  const techoTentativo = Math.ceil(max / paso) * paso;
  const unidad = techoTentativo >= 1_000_000 ? 100_000 : techoTentativo >= 1_000 ? 1_000 : 1;
  if (paso < unidad) paso = unidad;

  const cuantos = Math.ceil(max / paso);
  return { techo: cuantos * paso, marcas: Array.from({ length: cuantos + 1 }, (_, i) => i * paso) };
}
