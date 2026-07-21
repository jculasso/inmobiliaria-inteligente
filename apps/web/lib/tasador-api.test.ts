import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTasacion,
  deleteTasacion,
  generarInforme,
  listTasaciones,
  updateTasacion,
} from './tasador-api';

const TASACION = {
  id: '11111111-1111-1111-1111-111111111111',
  codigo: null,
  agenteId: '22222222-2222-2222-2222-222222222222',
  agente: { id: '22222222-2222-2222-2222-222222222222', nombre: 'Ana', email: 'ana@vacker.com' },
  cliente: 'Cliente Uno',
  fecha: '2026-03-10',
  direccion: 'Calle Falsa 123',
  barrio: null,
  ciudad: null,
  tipoOperacion: 'venta',
  tipoPropiedad: 'PH',
  supCubierta: 80,
  supSemicubierta: 0,
  supDescubierta: 0,
  supTerreno: null,
  superficieTotal: 80,
  dormitorios: null,
  banos: null,
  toilette: null,
  ambientes: null,
  antiguedad: null,
  estadoInmueble: null,
  disposicion: null,
  orientacion: null,
  cochera: false,
  balcon: false,
  terraza: false,
  patio: false,
  lavadero: false,
  piscina: false,
  amenities: [],
  detalleAmenities: null,
  expensas: null,
  aptoCredito: null,
  documentacion: null,
  comparables: [],
  fotos: [],
  analisisComercial: null,
  valorMinimo: null,
  valorRecomendado: null,
  valorAspiracional: null,
  margenNegociacion: null,
  escenarioRecomendado: null,
  plazoEstimado: null,
  estrategiaComercial: null,
  estado: 'En proceso',
  exclusividad: null,
  motivoNoCaptada: null,
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tasador-api', () => {
  it('listTasaciones pide /tasador/tasaciones con los filtros como query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [TASACION] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listTasaciones('token', { anio: 2026, estado: 'En proceso' });

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tasador/tasaciones?anio=2026&estado=En+proceso');
    expect(result).toEqual([TASACION]);
  });

  it('createTasacion hace POST con el body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => TASACION });
    vi.stubGlobal('fetch', fetchMock);

    await createTasacion('token', {
      cliente: 'Cliente Uno',
      fecha: '2026-03-10',
      direccion: 'Calle Falsa 123',
      tipoOperacion: 'venta',
      tipoPropiedad: 'PH',
      supCubierta: 80,
      supSemicubierta: 0,
      supDescubierta: 0,
      cochera: false,
      balcon: false,
      terraza: false,
      patio: false,
      lavadero: false,
      piscina: false,
      amenities: [],
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tasador/tasaciones');
    expect(options.method).toBe('POST');
  });

  it('updateTasacion hace PATCH a /tasador/tasaciones/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => TASACION });
    vi.stubGlobal('fetch', fetchMock);

    await updateTasacion('token', TASACION.id, { cliente: 'Otro nombre' });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/tasador/tasaciones/${TASACION.id}`);
    expect(options.method).toBe('PATCH');
  });

  it('deleteTasacion hace DELETE a /tasador/tasaciones/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: TASACION.id }) });
    vi.stubGlobal('fetch', fetchMock);

    await deleteTasacion('token', TASACION.id);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/tasador/tasaciones/${TASACION.id}`);
    expect(options.method).toBe('DELETE');
  });

  it('generarInforme hace POST a /tasador/tasaciones/:id/informe y devuelve la URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ url: 'https://example.test/informe.pdf' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generarInforme('token', TASACION.id);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/tasador/tasaciones/${TASACION.id}/informe`);
    expect(options.method).toBe('POST');
    expect(result.url).toBe('https://example.test/informe.pdf');
  });
});
