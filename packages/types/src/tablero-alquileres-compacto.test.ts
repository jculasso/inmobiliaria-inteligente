import { describe, expect, it } from 'vitest';
import {
  FilaTableroSchema,
  TableroAlquileresDtoSchema,
  TablerosAlquileresDtoSchema,
  TableroAlquileresQuerySchema,
  type FilaTablero,
  type Indicador,
} from './alquileres';
import {
  RespuestaTablerosAlquileresSchema,
  compactarTableros,
  expandirTableros,
  tablerosDeRespuesta,
} from './tablero-alquileres-compacto';

const fila = (id: string, over: Partial<FilaTablero> = {}): FilaTablero =>
  FilaTableroSchema.parse({
    id,
    href: `/alquileres/contratos/${id}`,
    contrato: id,
    persona: null,
    detalle: '',
    fecha: null,
    importe: null,
    inquilino: 'Inquilina',
    vence: '2027-01-31',
    ...over,
  });
const porCantidad = (filas: FilaTablero[]): Indicador => ({ valor: filas.length, filas });
const porImporte = (filas: FilaTablero[]): Indicador => ({
  valor: filas.reduce((s, f) => s + (f.importe ?? 0), 0),
  filas,
});

/** Un corte con filas repetidas entre números, como el de verdad. */
function corte(filas: FilaTablero[], deuda: FilaTablero[]) {
  return TableroAlquileresDtoSchema.parse({
    hoy: '2026-10-15',
    mes: '2026-10',
    cartera: {
      vigentes: porCantidad(filas),
      vivienda: filas.length,
      comercial: 0,
      alquilerMensual: [
        { moneda: 'ARS', indicador: porImporte(filas.map((f) => ({ ...f, importe: 100 }))) },
      ],
    },
    cobranza: [],
    morosidad: [
      {
        moneda: 'ARS',
        total: porImporte(deuda),
        tramos: [
          { tramo: '1-30', indicador: porImporte(deuda.slice(0, 1)) },
          { tramo: '31-60', indicador: porImporte(deuda.slice(1)) },
          { tramo: '61-90', indicador: porImporte([]) },
          { tramo: '90+', indicador: porImporte([]) },
        ],
      },
    ],
    evolucion: [],
    ingresos: [],
    tareas: {
      indexacionesVencidas: porCantidad([]),
      indexacionesProximas: porCantidad(filas.slice(0, 1)),
      vencen: [
        { dias: 30, indicador: porCantidad(filas) },
        { dias: 60, indicador: porCantidad([]) },
        { dias: 90, indicador: porCantidad([]) },
      ],
      depositos: porCantidad([]),
      liquidaciones: porCantidad([]),
      deudores: porCantidad([]),
      sinFirmar: porCantidad(filas),
    },
  });
}

function tableros() {
  const a = fila('A');
  const b = fila('B', { inquilino: null, propietario: 'Dueño' });
  const deuda = [
    fila('k1', { importe: 1500.5, fecha: '2026-09-05', dias: 40 }),
    fila('k2', { importe: 300, fecha: '2026-08-05', dias: 71 }),
  ];
  return TablerosAlquileresDtoSchema.parse({
    todos: corte([a, b], deuda),
    vivienda: { ...corte([a], deuda.slice(0, 1)), tipo: 'vivienda' },
    comercial: { ...corte([b], deuda.slice(1)), tipo: 'comercial' },
  });
}

describe('regla 175: el Dashboard compacto (cada fila viaja una vez)', () => {
  it('expandir lo compactado devuelve exactamente lo mismo: cada número con sus filas, en orden (reglas 26 y 79)', () => {
    const t = tableros();
    expect(expandirTableros(compactarTableros(t))).toEqual(t);
  });

  it('una fila repetida en varios números y en varios cortes viaja una sola vez, sin sus campos en null', () => {
    const c = compactarTableros(tableros());
    // A, B, A y B con importe (alquiler mensual), k1 y k2.
    expect(c.filas).toHaveLength(6);
    expect(c.filas.every((f) => Object.values(f).every((v) => v !== null))).toBe(true);
    const todos = c.todos as unknown as { cartera: { vigentes: { filas: number[] } } };
    expect(todos.cartera.vigentes.filas).toEqual([0, 1]);
    expect(JSON.stringify(c).length).toBeLessThan(JSON.stringify(tableros()).length / 2);
  });

  it('la web acepta las dos formas: la compacta y la de una API que todavía no la conoce', () => {
    const t = tableros();
    const compacta = RespuestaTablerosAlquileresSchema.parse(
      JSON.parse(JSON.stringify(compactarTableros(t))),
    );
    const completa = RespuestaTablerosAlquileresSchema.parse(JSON.parse(JSON.stringify(t)));
    expect(tablerosDeRespuesta(compacta)).toEqual(t);
    expect(tablerosDeRespuesta(completa)).toEqual(t);
  });

  it('una posición que no vino es un error, no una fila vacía', () => {
    const c = compactarTableros(tableros());
    expect(() => expandirTableros({ ...c, filas: c.filas.slice(0, 2) })).toThrow(/no vino/);
  });

  it('la API sigue respondiendo la forma completa si no se la pide compacta', () => {
    expect(TableroAlquileresQuerySchema.parse({}).formato).toBe('completo');
    expect(TableroAlquileresQuerySchema.parse({ formato: 'compacto' }).formato).toBe('compacto');
  });
});
