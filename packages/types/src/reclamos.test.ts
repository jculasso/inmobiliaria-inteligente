import { describe, expect, it } from 'vitest';
import {
  CambioReclamoSchema,
  ComprobanteInputSchema,
  ESTADOS_RECLAMO_ABIERTOS,
  EstadoReclamoSchema,
  NOMBRE_ESTADO_RECLAMO,
  ReclamoResumenDtoSchema,
  lineaInquilino,
  nombrePrioridad,
  redactarAvisoProveedor,
} from './alquileres';

// Javier, 7/10/2026: «como está no sirve». Reglas 67 a 73 de docs/specs/alquileres-fase-1.md.
describe('Reclamos: estados, prioridad y aviso al proveedor (reglas 67 a 73)', () => {
  it('regla 67: tres estados —Abierto, En curso, Resuelto—, y «abiertos» son los dos primeros', () => {
    expect(EstadoReclamoSchema.options).toEqual(['abierto', 'en_curso', 'resuelto']);
    expect(Object.values(NOMBRE_ESTADO_RECLAMO)).toEqual(['Abierto', 'En curso', 'Resuelto']);
    expect(ESTADOS_RECLAMO_ABIERTOS).toEqual(['abierto', 'en_curso']);
  });

  it('regla 68: «cerrado» —de una pantalla vieja o una fila sin migrar— se lee como «resuelto»', () => {
    expect(CambioReclamoSchema.parse({ estado: 'cerrado' }).estado).toBe('resuelto');
    const fila = {
      id: '33333333-3333-4333-8333-333333333333',
      numero: 7,
      asunto: 'Pérdida de agua',
      tipo: 'mantenimiento',
      prioridad: 'media',
      estado: 'cerrado',
      contrato: null,
      persona: null,
      asignadoA: null,
      proveedor: null,
      abierto: '2026-10-06T12:00:00Z',
      actualizado: '2026-10-06T12:00:00Z',
    };
    expect(ReclamoResumenDtoSchema.parse(fila).estado).toBe('resuelto');
    // Lo que no es un estado se sigue rechazando.
    expect(CambioReclamoSchema.safeParse({ estado: 'archivado' }).success).toBe(false);
  });

  it('regla 69: la prioridad suelta dice su nombre', () => {
    expect(nombrePrioridad('media')).toBe('Prioridad media');
    expect(nombrePrioridad('urgente')).toBe('Prioridad urgente');
  });

  it('regla 70: el comprobante puede venir enlazado a un reclamo, y si no, queda sin reclamo', () => {
    const base = {
      proveedorId: '77777777-7777-4777-8777-777777777777',
      contratoId: '55555555-5555-4555-8555-555555555555',
      fecha: '2026-10-07',
      descripcion: 'Cambio de flexible',
      importe: 85_000,
    };
    expect(ComprobanteInputSchema.parse(base).reclamoId).toBeNull();
    const reclamoId = '33333333-3333-4333-8333-333333333333';
    expect(ComprobanteInputSchema.parse({ ...base, reclamoId }).reclamoId).toBe(reclamoId);
    expect(ComprobanteInputSchema.safeParse({ ...base, reclamoId: 'otro' }).success).toBe(false);
  });

  const RECLAMO = {
    numero: 7,
    asunto: 'Pérdida de agua en el baño',
    descripcion: 'Gotea la canilla de la ducha.',
    prioridad: 'alta' as const,
    contrato: {
      id: '55555555-5555-4555-8555-555555555555',
      codigo: 'ALT-0005',
      propiedad: 'Mendoza 3340 2° C',
    },
    inquilino: { nombre: 'Ana Inquilina', telefono: '341 444-0000' },
    asignadoA: 'Lucía Operadora',
    contactoLoSigue: { telefono: '341 600-0000', email: 'lucia@alteva.com' },
    proveedor: {
      id: '88888888-8888-4888-8888-888888888888',
      nombre: 'Juan Plomero',
      telefono: null,
      email: 'juan@plomeria.com',
    },
  };

  it('regla 73: el mail ya redactado trae dirección, qué pasa, prioridad, inquilino y quién lo sigue', () => {
    const { asunto, cuerpo } = redactarAvisoProveedor(RECLAMO, true);
    expect(asunto).toBe('Reclamo 7 · Pérdida de agua en el baño · Mendoza 3340 2° C');
    expect(cuerpo).toBe(
      [
        'Hola, Juan Plomero:',
        '',
        'Te escribimos por un arreglo en Mendoza 3340 2° C.',
        '',
        'Qué pasa: Pérdida de agua en el baño.',
        'Gotea la canilla de la ducha.',
        '',
        'Prioridad alta.',
        '',
        'Inquilino: Ana Inquilina · tel. 341 444-0000',
        '',
        'Para coordinar, en la inmobiliaria lo sigue Lucía Operadora (tel. 341 600-0000 · lucia@alteva.com).',
      ].join('\n'),
    );
  });

  it('regla 73: sin el tilde del teléfono, el inquilino va sin teléfono; sin quién lo sigue, se responde el mail', () => {
    const { cuerpo } = redactarAvisoProveedor(
      { ...RECLAMO, asignadoA: null, contactoLoSigue: null, descripcion: null },
      false,
    );
    expect(cuerpo).toContain('\nInquilino: Ana Inquilina\n');
    expect(cuerpo).not.toContain('341 444-0000');
    expect(cuerpo).toContain('Para coordinar, respondé este mail.');
    expect(lineaInquilino(RECLAMO.inquilino, true)).toBe(
      'Inquilino: Ana Inquilina · tel. 341 444-0000',
    );
    expect(lineaInquilino({ nombre: 'Ana', telefono: null }, true)).toBe('Inquilino: Ana');
  });

  it('regla 73: un asunto que ya termina en punto no queda con dos', () => {
    const { cuerpo } = redactarAvisoProveedor(
      { ...RECLAMO, asunto: 'Se rompió el calefón.' },
      true,
    );
    expect(cuerpo).toContain('Qué pasa: Se rompió el calefón.\n');
  });
});
