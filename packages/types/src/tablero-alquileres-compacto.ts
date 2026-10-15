import { z } from 'zod';
import {
  FilaTableroSchema,
  TableroAlquileresDtoSchema,
  TablerosAlquileresDtoSchema,
  type FilaTablero,
  type TableroAlquileresDto,
  type TablerosAlquileresDto,
} from './alquileres';

/**
 * El Dashboard de Alquileres en su forma compacta: cada fila viaja UNA vez.
 *
 * Los tres cortes —todos, particulares, comerciales— llegan juntos para que
 * cambiar de filtro no pida nada (6/10/2026), y eso repetía cada fila de un
 * contrato particular en «todos» y en «particulares»; la misma deuda, en el
 * total y en su tramo; el mismo contrato, en vigentes, en los que vencen y en
 * los que no están firmados. Con la cartera de Vacker de prueba eran 1,3 MB.
 *
 * Acá las filas van una sola vez, en `filas`, sin los campos en `null`, y cada
 * número lleva las posiciones de las suyas. Es solo la forma de viajar:
 * `expandirTableros` devuelve exactamente lo que se compactó —el mismo `valor`,
 * las mismas filas en el mismo orden—, así que un número sigue sumando su
 * lista (reglas 26 y 79) sin que nada de eso se calcule en el navegador.
 *
 * La pide la web con `?formato=compacto`; sin eso la API responde como antes.
 * Una web nueva con una API vieja recibe la forma completa y la usa tal cual:
 * se pueden desplegar en cualquier orden.
 */
/**
 * Un corte compacto. Lo de arriba —el día y el año— viene igual que en la
 * forma completa (la página lo lee sin expandir); el resto se valida al
 * expandir, con el esquema de siempre.
 */
const CorteCompactoSchema = TableroAlquileresDtoSchema.pick({
  hoy: true,
  mes: true,
  anio: true,
  tipo: true,
}).passthrough();

export const TablerosCompactosDtoSchema = z.object({
  formato: z.literal('compacto'),
  filas: z.array(z.record(z.string(), z.unknown())),
  todos: CorteCompactoSchema,
  vivienda: CorteCompactoSchema,
  comercial: CorteCompactoSchema,
});
export type TablerosCompactosDto = z.infer<typeof TablerosCompactosDtoSchema>;

/** Lo que puede contestar `GET /alquileres/tablero/completo?formato=compacto`. */
export type RespuestaTablerosAlquileres = TablerosCompactosDto | TablerosAlquileresDto;
// El tipo, escrito: inferido de la unión, excede lo que el compilador serializa.
export const RespuestaTablerosAlquileresSchema: z.ZodType<
  RespuestaTablerosAlquileres,
  z.ZodTypeDef,
  unknown
> = z.union([TablerosCompactosDtoSchema, TablerosAlquileresDtoSchema]);

/** Un número con su lista (`IndicadorSchema`): exactamente `valor` y `filas`. */
function esIndicador(x: object): x is { valor: number; filas: unknown[] } {
  const claves = Object.keys(x);
  return (
    claves.length === 2 &&
    typeof (x as { valor?: unknown }).valor === 'number' &&
    Array.isArray((x as { filas?: unknown }).filas)
  );
}

function recorrer(x: unknown, indicador: (i: { valor: number; filas: unknown[] }) => unknown) {
  const paso = (y: unknown): unknown => {
    if (Array.isArray(y)) return y.map(paso);
    if (y && typeof y === 'object') {
      if (esIndicador(y)) return indicador(y);
      return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, paso(v)]));
    }
    return y;
  };
  return paso(x);
}

export function compactarTableros(t: TablerosAlquileresDto): TablerosCompactosDto {
  const filas: Record<string, unknown>[] = [];
  const posicion = new Map<string, number>();
  const aPosicion = (f: FilaTablero) => {
    const sinNulos = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null));
    const clave = JSON.stringify(sinNulos);
    let i = posicion.get(clave);
    if (i === undefined) {
      i = filas.push(sinNulos) - 1;
      posicion.set(clave, i);
    }
    return i;
  };
  const corte = (x: TableroAlquileresDto) =>
    recorrer(x, (i) => ({
      valor: i.valor,
      filas: (i.filas as FilaTablero[]).map(aPosicion),
    })) as TablerosCompactosDto['todos'];
  return {
    formato: 'compacto',
    todos: corte(t.todos),
    vivienda: corte(t.vivienda),
    comercial: corte(t.comercial),
    filas,
  };
}

/** Los campos de una fila que pueden faltar porque viajaban en `null`. */
const NULOS = Object.fromEntries(Object.keys(FilaTableroSchema.shape).map((k) => [k, null]));

export function expandirTableros(c: TablerosCompactosDto): TablerosAlquileresDto {
  const filas = c.filas.map((f) => ({ ...NULOS, ...f }));
  const corte = (x: unknown) =>
    recorrer(x, (i) => ({
      valor: i.valor,
      filas: i.filas.map((p) => {
        const f = filas[p as number];
        if (!f) throw new Error(`El tablero nombra la fila ${String(p)}, que no vino.`);
        return f;
      }),
    }));
  // Validado como siempre: los mismos defaults y el mismo error si algo no cierra.
  return TablerosAlquileresDtoSchema.parse({
    todos: corte(c.todos),
    vivienda: corte(c.vivienda),
    comercial: corte(c.comercial),
  });
}

/** La respuesta del endpoint, en la forma de siempre, venga como venga. */
export function tablerosDeRespuesta(r: RespuestaTablerosAlquileres): TablerosAlquileresDto {
  return 'formato' in r ? expandirTableros(r) : r;
}
