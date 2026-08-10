import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTasacion,
  deleteTasacion,
  generarInforme,
  generarInformeReporte,
  getKpisResumenTasador,
  getRankingCaptaciones,
  listTasaciones,
  listTasacionesResumen,
  updateTasacion,
} from './tasador-api';

const TASACION = {
  id: '11111111-1111-1111-1111-111111111111',
  codigo: null,
  agenteId: '22222222-2222-2222-2222-222222222222',
  agente: { id: '22222222-2222-2222-2222-222222222222', nombre: 'Ana', email: 'ana@vacker.com', fotoUrl: null, telefono: null },
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
  altillo: false,
  baulera: false,
  biblioteca: false,
  escritorio: false,
  jardin: false,
  vestidor: false,
  servicios: [],
  tieneAmenities: false,
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
      altillo: false,
      baulera: false,
      biblioteca: false,
      escritorio: false,
      jardin: false,
      vestidor: false,
      servicios: [],
      tieneAmenities: false,
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

  it('generarInforme hace POST a /tasador/tasaciones/:id/informe y devuelve el PDF', async () => {
    // La API manda los bytes del PDF en la respuesta, no una URL a Storage.
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    // El nombre del archivo viaja en Content-Disposition: sin rescatarlo de
    // ahí, el PDF se guarda con un identificador al azar.
    const nombre = 'Tasacion Vacker - Juan Pérez - Córdoba 1234';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => pdf,
      headers: {
        get: (h: string) =>
          h.toLowerCase() === 'content-disposition'
            ? `inline; filename="Tasacion.pdf"; filename*=UTF-8''${encodeURIComponent(`${nombre}.pdf`)}`
            : null,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generarInforme('token', TASACION.id);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`http://localhost:3001/tasador/tasaciones/${TASACION.id}/informe`);
    expect(options.method).toBe('POST');
    expect(result.blob).toBe(pdf);
    expect(result.nombre).toBe(nombre);
  });
});

/**
 * El PDF del reporte tiene que pedir el MISMO alcance que la pantalla.
 *
 * `generarInformeReporte` armaba sus query params campo por campo y se olvidaba
 * de `verTodo`. Resultado: la pantalla mostraba toda la inmobiliaria y el PDF
 * salía con el alcance por defecto —lo propio—. A Berni Falconi, que es
 * dirección y no tiene tasaciones propias, el reporte le salía en cero.
 *
 * El test compara los params de las CUATRO llamadas entre sí en vez de
 * afirmar sobre cada una por separado: lo que importa no es que el PDF mande
 * `verTodo`, es que mande lo mismo que las otras tres.
 */
describe('el reporte y su PDF piden el mismo alcance', () => {
  const filtro = { anio: 2026, periodo: 'anual', verTodo: true } as const;

  /* Cada endpoint valida su respuesta con su propio schema, así que el doble
     tiene que devolver la forma que espera cada uno. */
  const RESUMEN = { total: 0, tasaCaptacion: 0, distribucionEstado: [] };

  async function paramsDe(fn: () => Promise<unknown>, json: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => json,
      blob: async () => new Blob(),
      headers: new Headers({ 'content-disposition': 'attachment; filename="r.pdf"' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await fn();
    const [url] = fetchMock.mock.calls[0]!;
    return new URL(String(url)).searchParams;
  }

  it('las cuatro llamadas mandan verTodo', async () => {
    const llamadas: [string, () => Promise<unknown>, unknown][] = [
      ['kpis', () => getKpisResumenTasador('token', filtro), RESUMEN],
      ['ranking', () => getRankingCaptaciones('token', filtro), []],
      ['listado', () => listTasacionesResumen('token', filtro), []],
      ['pdf', () => generarInformeReporte('token', filtro), null],
    ];

    for (const [nombre, fn, json] of llamadas) {
      const params = await paramsDe(fn, json);
      expect(params.get('verTodo'), `${nombre} no manda verTodo`).toBe('1');
    }
  });

  it('sin verTodo, ninguna lo manda', async () => {
    const params = await paramsDe(
      () => generarInformeReporte('token', { anio: 2026, periodo: 'anual' }),
      null,
    );
    expect(params.get('verTodo')).toBeNull();
  });
});
