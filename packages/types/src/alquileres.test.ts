import { describe, expect, it } from 'vitest';
import { PersonaInputSchema, PropiedadAlquilerInputSchema, agruparPorContrato, normalizarDocumento } from './alquileres';

describe('normalizarDocumento', () => {
  /*
   * La misma persona cargada dos veces con distinto formato tendría dos
   * cuentas corrientes. La restricción única de la base solo la frena si el
   * documento llega siempre igual.
   */
  it('deja solo los dígitos, con cualquier formato', () => {
    expect(normalizarDocumento('20-12345678-9')).toBe('20123456789');
    expect(normalizarDocumento('20.123.456')).toBe('20123456');
    expect(normalizarDocumento(' 20123456 ')).toBe('20123456');
  });

  it('vacío es null, no una cadena vacía', () => {
    expect(normalizarDocumento('')).toBeNull();
    expect(normalizarDocumento('  -  ')).toBeNull();
    expect(normalizarDocumento(null)).toBeNull();
  });
});

describe('PersonaInputSchema', () => {
  it('acepta lo mínimo: un nombre', () => {
    expect(PersonaInputSchema.parse({ nombre: 'Ana Pérez' })).toMatchObject({
      tipo: 'fisica',
      nombre: 'Ana Pérez',
      documento: null,
      email: null,
    });
  });

  it('acepta DNI y CUIT, y rechaza otra cantidad de dígitos', () => {
    expect(PersonaInputSchema.safeParse({ nombre: 'A', documento: '12.345.678' }).success).toBe(true);
    expect(PersonaInputSchema.safeParse({ nombre: 'A', documento: '20-12345678-9' }).success).toBe(true);
    expect(PersonaInputSchema.safeParse({ nombre: 'A', documento: '123' }).success).toBe(false);
  });

  it('el email se guarda en minúscula y se valida', () => {
    expect(PersonaInputSchema.parse({ nombre: 'A', email: 'Ana@Mail.COM' }).email).toBe('ana@mail.com');
    expect(PersonaInputSchema.safeParse({ nombre: 'A', email: 'no-es-mail' }).success).toBe(false);
  });

  it('rechaza un nombre en blanco', () => {
    expect(PersonaInputSchema.safeParse({ nombre: '   ' }).success).toBe(false);
  });

  it('los textos vacíos se guardan como null', () => {
    expect(PersonaInputSchema.parse({ nombre: 'A', telefono: '  ', obs: '' })).toMatchObject({ telefono: null, obs: null });
  });
});

describe('PropiedadAlquilerInputSchema', () => {
  it('pide la dirección y deja el resto opcional', () => {
    expect(PropiedadAlquilerInputSchema.parse({ direccion: 'Maipú 1234' })).toMatchObject({
      direccion: 'Maipú 1234',
      unidad: null,
      tipo: null,
    });
    expect(PropiedadAlquilerInputSchema.safeParse({ direccion: '' }).success).toBe(false);
  });
});

describe('agruparPorContrato', () => {
  const c = (id: string) => ({ id, codigo: id.slice(-1), propiedad: `Calle ${id.slice(-1)}`, inquilinos: ['Inquilina'] });
  const A = c('00000000-0000-4000-8000-00000000000a');
  const B = c('00000000-0000-4000-8000-00000000000b');
  const l = (contrato: typeof A, importe: number) => ({ conceptoId: crypto.randomUUID(), contrato, tipo: 'alquiler' as const, descripcion: 'x', importe });

  it('una propiedad por grupo, en orden, con lo cobrado menos lo descontado', () => {
    const g = agruparPorContrato({ aPagar: [l(A, 1_000.1), l(B, 500)], aDescontar: [l(A, 100.05)], enEspera: [l(B, 300)] });
    expect(g.map((x) => [x.contrato?.codigo, x.aPagar.length, x.aDescontar.length, x.enEspera.length, x.subtotal])).toEqual([
      ['a', 1, 1, 0, 900.05],
      ['b', 1, 0, 1, 500],
    ]);
  });
});
