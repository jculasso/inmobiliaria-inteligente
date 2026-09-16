import { describe, expect, it } from 'vitest';
import { TipoPropiedadSchema, type TipoPropiedad } from './tasador';
import { aspectosDe, fortalezasDe, todasLasFortalezas, todosLosAspectos } from './tasador-catalogo';

const TIPOS = TipoPropiedadSchema.options;

/**
 * Los 29 valores que existían antes de septiembre de 2026, cuando esto era un
 * enum y la lista era la misma para todas las tipologías.
 *
 * Están acá escritos a mano, y tienen que estarlo: si se importaran del
 * catálogo, el test pasaría siempre y no protegería nada. Al 16/09/2026 los 57
 * informes cargados en producción usan 28 de estos 29 —el único sin uso es
 * «Falta de balcón»—, así que borrar o renombrar cualquiera deja tasaciones
 * reales con un valor que ya no existe.
 */
const FORTALEZAS_DE_ANTES = [
  'Excelente ubicación',
  'Buena luminosidad',
  'Ambientes amplios',
  'Buena distribución',
  'Buen estado general',
  'Edificio bien mantenido',
  'Balcón funcional',
  'Vista despejada',
  'Cochera incluida',
  'Bajas expensas',
  'Apto crédito',
  'Alta demanda para la tipología',
  'Cercanía a corredores comerciales',
  'Cercanía a espacios verdes',
  'Buena conectividad',
  'Buena relación precio-superficie',
];
const ASPECTOS_DE_ANTES = [
  'Necesita mejoras',
  'Expensas elevadas',
  'Falta de cochera',
  'Disposición interna',
  'Baja luminosidad',
  'Edificio antiguo',
  'Alta competencia en la zona',
  'Precio sensible para la demanda actual',
  'Documentación pendiente de revisión',
  'Ambientes chicos',
  'Estado original',
  'Falta de balcón',
  'Requiere actualización estética',
];

describe('catálogo del tasador — la regla que no se rompe', () => {
  it('conserva las 16 fortalezas que existían antes', () => {
    const catalogo = todasLasFortalezas();
    const perdidas = FORTALEZAS_DE_ANTES.filter((v) => !catalogo.has(v));
    expect(perdidas).toEqual([]);
  });

  it('conserva los 13 aspectos que existían antes', () => {
    const catalogo = todosLosAspectos();
    const perdidos = ASPECTOS_DE_ANTES.filter((v) => !catalogo.has(v));
    expect(perdidos).toEqual([]);
  });
});

describe('catálogo del tasador — nada se ofrece dos veces', () => {
  it.each(TIPOS)('%s no repite ninguna fortaleza ni ningún aspecto', (tipo) => {
    const f = fortalezasDe(tipo);
    const a = aspectosDe(tipo);
    expect(new Set(f).size).toBe(f.length);
    expect(new Set(a).size).toBe(a.length);
  });
});

/**
 * Lo que motivó todo el cambio. Cada línea es una contradicción que el sistema
 * mostraba —o habría mostrado— antes de separar por tipología; la más citada es
 * la cochera a la que se le ofrecía «Falta de cochera».
 */
const NO_CORRESPONDE: Array<[TipoPropiedad, string[]]> = [
  [
    'Cochera',
    [
      'Falta de cochera',
      'Cochera incluida',
      'Cochera para varios vehículos',
      'Ambientes chicos',
      'Ambientes amplios',
      'Buena distribución',
      'Baja luminosidad',
      'Balcón funcional',
      'Falta de balcón',
    ],
  ],
  [
    'Terreno',
    [
      'Ambientes amplios',
      'Buena luminosidad',
      'Necesita mejoras',
      'Instalaciones antiguas',
      'Estado original',
      'Ambientes chicos',
      'Cochera incluida',
      'Falta de cochera',
      'Balcón funcional',
      'Falta de balcón',
    ],
  ],
  ['Galpón', ['Falta de balcón', 'Balcón funcional', 'Ambientes chicos', 'Falta de cochera']],
  [
    'Departamento',
    ['Esquina', 'Calle sin pavimentar', 'Excelente acceso para camiones', 'Patio exclusivo', 'Necesidad de demolición'],
  ],
  ['Casa', ['PH interno', 'Altura insuficiente', 'Sin ascensor']],
];

describe('catálogo del tasador — no se ofrece lo que no corresponde', () => {
  it.each(NO_CORRESPONDE)('a un/a %s no se le ofrece nada contradictorio', (tipo, prohibidos) => {
    const ofrecidos = new Set([...fortalezasDe(tipo), ...aspectosDe(tipo)]);
    expect(prohibidos.filter((v) => ofrecidos.has(v))).toEqual([]);
  });
});

/**
 * Los pares que dicen lo mismo con otras palabras. La propuesta que llegó de
 * Vacker renombraba varios valores en vez de agregarlos: si entraran los dos, el
 * tasador vería sinónimos uno al lado del otro. Gana siempre el que ya está
 * guardado en las tasaciones.
 */
const SINONIMOS: Array<[string, string]> = [
  ['Buena luminosidad', 'Buena iluminación natural'],
  ['Cercanía a corredores comerciales', 'Cercanía a centros comerciales'],
  ['Disposición interna', 'Distribución poco funcional'],
  ['Buena accesibilidad', 'Buena accesibilidad vehicular'],
  ['Buena orientación', 'Orientación favorable'],
  ['Cercanía a rutas o autopistas', 'Cercanía a rutas'],
  ['Sin expensas', 'PH sin expensas'],
  ['Cochera incluida', 'Cochera'],
];

describe('catálogo del tasador — sin sinónimos conviviendo', () => {
  it.each(TIPOS)('%s no muestra dos formas de decir lo mismo', (tipo) => {
    const ofrecidos = new Set([...fortalezasDe(tipo), ...aspectosDe(tipo)]);
    const convivientes = SINONIMOS.filter(([a, b]) => ofrecidos.has(a) && ofrecidos.has(b));
    expect(convivientes).toEqual([]);
  });
});

describe('catálogo del tasador — cada tipología tiene con qué trabajar', () => {
  it.each(TIPOS)('%s ofrece al menos 15 fortalezas y 15 aspectos', (tipo) => {
    expect(fortalezasDe(tipo).length).toBeGreaterThanOrEqual(15);
    expect(aspectosDe(tipo).length).toBeGreaterThanOrEqual(15);
  });

  it('el terreno y la cochera dejaron de ver la lista del departamento', () => {
    // Antes veían las 16 fortalezas y los 13 aspectos del departamento, enteros.
    expect(fortalezasDe('Terreno')).toContain('Esquina');
    expect(fortalezasDe('Terreno')).not.toContain('Buena luminosidad');
    expect(aspectosDe('Cochera')).toContain('Maniobra difícil');
    expect(aspectosDe('Cochera')).not.toContain('Falta de cochera');
  });
});
