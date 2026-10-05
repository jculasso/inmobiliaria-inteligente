import { describe, expect, it } from 'vitest';
import { contarVentas, resumirVentas } from './drill';

const ANA = 'ana';
const BETO = 'beto';

/** Una venta con las dos puntas, de dos personas distintas. */
const COMPARTIDA = {
  precio: 200_000,
  valorMensual: null,
  comTotal: 10_001, // con un peso de redondeo: la tarjeta suma las puntas, no esto
  puntas: [
    { lado: 'vendedora', usuarioId: ANA, comision: 6_000 },
    { lado: 'compradora', usuarioId: BETO, comision: 4_000 },
  ],
};
/** Una venta con una sola punta, la vendedora. */
const SOLA = {
  precio: 100_000,
  valorMensual: null,
  comTotal: 3_000,
  puntas: [{ lado: 'vendedora', usuarioId: BETO, comision: 3_000 }],
};

describe('contarVentas / resumirVentas — la ventana suma lo mismo que la tarjeta', () => {
  it('sin acotar: el volumen suma el precio una vez por punta, como el tablero', () => {
    const r = resumirVentas(contarVentas([COMPARTIDA, SOLA]));
    expect(r).toEqual({ operaciones: 2, puntas: 3, volumen: 500_000, ticket: 500_000 / 3, comision: 13_000 });
  });

  it('la comisión es la de las puntas, no el `comTotal` de la operación', () => {
    expect(resumirVentas(contarVentas([COMPARTIDA])).comision).toBe(10_000);
  });

  /*
   * «Com. comprador» y «Puntas compradoras»: la venta de una sola punta
   * vendedora no tiene nada que aportar, así que no aparece.
   */
  it('por lado comprador: solo las ventas con punta compradora, y solo esa comisión', () => {
    const c = contarVentas([COMPARTIDA, SOLA], { lado: 'compradora' });
    expect(c).toHaveLength(1);
    expect(resumirVentas(c)).toMatchObject({ operaciones: 1, puntas: 1, comision: 4_000 });
  });

  it('por lado vendedor: las dos ventas, con la comisión de la punta vendedora', () => {
    expect(resumirVentas(contarVentas([COMPARTIDA, SOLA], { lado: 'vendedora' }))).toMatchObject({
      operaciones: 2,
      puntas: 2,
      comision: 9_000,
    });
  });

  it('desde la fila de un vendedor: solo sus puntas', () => {
    expect(resumirVentas(contarVentas([COMPARTIDA, SOLA], { usuarioId: BETO }))).toMatchObject({
      operaciones: 2,
      puntas: 2,
      volumen: 300_000,
      comision: 7_000,
    });
  });
});
