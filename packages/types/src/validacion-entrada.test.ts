import { describe, expect, it } from 'vitest';
import {
  BoolQuerySchema,
  ComparableDtoSchema,
  CreateOperacionSchema,
  UpdateOperacionSchema,
  KpiFiltroSchema,
  LinkExternoSchema,
  ProtocoloFiltroSchema,
  TasacionFiltroSchema,
  TasadorKpiFiltroSchema,
} from './index';

describe('BoolQuerySchema (verTodo por query string)', () => {
  // `z.coerce.boolean()` hacía `Boolean('false') === true`: un cliente que
  // mandaba verTodo=false recibía el alcance completo.
  it("'false' y '0' son falso", () => {
    expect(BoolQuerySchema.parse('false')).toBe(false);
    expect(BoolQuerySchema.parse('0')).toBe(false);
  });

  it("'true' y '1' son verdadero", () => {
    expect(BoolQuerySchema.parse('true')).toBe(true);
    expect(BoolQuerySchema.parse('1')).toBe(true);
  });

  it('ausente queda sin valor (los servicios lo leen como falso)', () => {
    expect(BoolQuerySchema.parse(undefined)).toBeUndefined();
    expect(BoolQuerySchema.parse('')).toBeUndefined();
  });

  it('cualquier otro texto es un error, no un verdadero', () => {
    expect(BoolQuerySchema.safeParse('si').success).toBe(false);
  });

  it('todos los filtros con verTodo lo usan', () => {
    const query = { anio: '2026', periodo: 'anual', verTodo: 'false' };
    expect(KpiFiltroSchema.parse(query).verTodo).toBe(false);
    expect(TasacionFiltroSchema.parse(query).verTodo).toBe(false);
    expect(TasadorKpiFiltroSchema.parse(query).verTodo).toBe(false);
    expect(ProtocoloFiltroSchema.parse(query).verTodo).toBe(false);
  });
});

describe('LinkExternoSchema (link de un comparable)', () => {
  it('acepta http y https', () => {
    expect(LinkExternoSchema.parse('https://www.zonaprop.com.ar/x')).toBe(
      'https://www.zonaprop.com.ar/x',
    );
    expect(LinkExternoSchema.parse('http://x.com')).toBe('http://x.com');
  });

  // Se mostraba como enlace: un `javascript:` se ejecutaba al hacer clic.
  it('rechaza javascript:, data: y otros esquemas', () => {
    expect(LinkExternoSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(LinkExternoSchema.safeParse('JavaScript:alert(1)').success).toBe(false);
    expect(LinkExternoSchema.safeParse('data:text/html,<script>1</script>').success).toBe(false);
    expect(LinkExternoSchema.safeParse('ftp://x.com').success).toBe(false);
  });

  it('completa con https un link pegado sin protocolo', () => {
    expect(LinkExternoSchema.parse('www.zonaprop.com.ar/x')).toBe('https://www.zonaprop.com.ar/x');
  });

  it('vacío o ausente es nulo', () => {
    expect(LinkExternoSchema.parse('')).toBeNull();
    expect(LinkExternoSchema.parse(null)).toBeNull();
    expect(LinkExternoSchema.parse(undefined)).toBeUndefined();
  });

  it('la LECTURA sigue aceptando lo que ya está guardado', () => {
    const fila = ComparableDtoSchema.shape.link.safeParse('javascript:viejo');
    expect(fila.success).toBe(true);
  });
});

describe('Moneda de una operación del Tablero', () => {
  const venta = {
    tipo: 'venta',
    codigo: 'OP-1',
    direccion: 'Calle 1',
    precio: 100,
    puntas: [{ lado: 'vendedora', usuarioId: '00000000-0000-4000-8000-000000000000' }],
  };

  // El volumen suma precios entre operaciones: una en pesos sumada como
  // dólares lo infla mil veces sin ningún aviso.
  it('solo acepta USD al entrar', () => {
    expect(CreateOperacionSchema.safeParse({ ...venta, moneda: 'ARS' }).success).toBe(false);
    expect(UpdateOperacionSchema.safeParse({ moneda: 'pesos' }).success).toBe(false);
    expect(CreateOperacionSchema.parse({ ...venta, moneda: 'USD' }).moneda).toBe('USD');
  });

  it('sin moneda, USD', () => {
    expect(CreateOperacionSchema.parse(venta).moneda).toBe('USD');
  });
});
