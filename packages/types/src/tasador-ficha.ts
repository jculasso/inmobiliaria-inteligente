// Qué campos de la ficha del inmueble se le piden al tasador, según el tipo de
// propiedad.
//
// EL PROBLEMA. La sección 2 mostraba los mismos treinta y pico de controles para
// todo. A un terreno le preguntaba dormitorios, baños, antigüedad, si tiene
// balcón y si tiene vestidor. Y no es solo ruido: ofrecerle «Dormitorios» a un
// lote invita a que alguien escriba un número que después ensucia el comparable.
//
// EL ARGUMENTO. El cálculo YA está adaptado por tipo — `valuationSurface()` en
// `@vacker/domain` valúa un terreno por su superficie de terreno, una cochera
// por la construida, y el resto por la construida. El formulario era la única
// capa que fingía que las nueve tipologías son la misma cosa.
//
// EN LA DUDA, SE MUESTRA. Es la regla con la que se armó esta tabla. Esconder de
// más le saca al tasador una capacidad —no puede registrar algo que la propiedad
// tiene—; mostrar de más es apenas un campo que va a dejar vacío. Los dos errores
// no cuestan lo mismo, así que ante cualquier caso discutible el campo queda.
//
// LO QUE NO HACE. Esto decide qué se MUESTRA, nunca qué se guarda. Ningún campo
// se borra al cambiar el tipo de propiedad: las columnas siguen existiendo con
// su valor, y la pantalla muestra igual lo que esté cargado aunque no
// corresponda. Cambiar un desplegable no puede destruir lo que alguien midió.
import { TipoPropiedadSchema, type TipoPropiedad } from './tasador';

/** Cada bloque de la ficha que se puede mostrar u ocultar. */
export const CAMPOS_FICHA = [
  /** Cubierta + semicubierta + descubierta, con su total calculado. */
  'superficieConstruida',
  'superficieTerreno',
  'dormitorios',
  /** Baños y toilette van juntos: se piden o no se piden los dos. */
  'banos',
  'ambientes',
  'antiguedad',
  'disposicion',
  'orientacion',
  'estadoInmueble',
  'servicios',
  'amenities',
  'expensas',
  'aptoCredito',
  'documentacion',
] as const;
export type CampoFicha = (typeof CAMPOS_FICHA)[number];

/** Los tildes de «Características» — las comodidades de la unidad. */
export const CARACTERISTICAS_FICHA = [
  'Cochera',
  'Balcón',
  'Terraza',
  'Patio',
  'Lavadero',
  'Piscina',
  'Altillo',
  'Baulera',
  'Biblioteca',
  'Escritorio',
  'Jardín',
  'Vestidor',
] as const;
export type CaracteristicaFicha = (typeof CARACTERISTICAS_FICHA)[number];

const TODOS = [...CAMPOS_FICHA];
const TODAS_LAS_CARACTERISTICAS = [...CARACTERISTICAS_FICHA];

/** Lo residencial: lo que solo tiene sentido donde alguien vive. */
const SIN_VIVIENDA: CampoFicha[] = ['dormitorios'];

interface Ficha {
  campos: CampoFicha[];
  caracteristicas: CaracteristicaFicha[];
}

const FICHAS: Record<TipoPropiedad, Ficha> = {
  /** Un departamento no tiene lote propio: el terreno es del edificio. */
  Departamento: {
    campos: TODOS.filter((c) => c !== 'superficieTerreno'),
    caracteristicas: TODAS_LAS_CARACTERISTICAS,
  },
  Casa: { campos: TODOS, caracteristicas: TODAS_LAS_CARACTERISTICAS },
  PH: { campos: TODOS, caracteristicas: TODAS_LAS_CARACTERISTICAS },

  /**
   * Un lote no tiene ambientes, ni antigüedad, ni estado de conservación. Lo que
   * sí define su valor son los servicios disponibles y la orientación.
   *
   * La superficie construida queda afuera aunque `valuationSurface` la use como
   * respaldo: para un terreno el valor está en la tierra, y si alguna tasación
   * vieja la tiene cargada, la pantalla la muestra igual.
   */
  Terreno: {
    campos: ['superficieTerreno', 'orientacion', 'servicios', 'expensas', 'aptoCredito', 'documentacion'],
    caracteristicas: [],
  },

  /**
   * Una cochera se define por su superficie y poco más. Los servicios quedan
   * afuera: preguntarle si tiene gas natural o internet solo invita a cargar
   * cualquier cosa.
   */
  Cochera: {
    campos: ['superficieConstruida', 'antiguedad', 'estadoInmueble', 'expensas', 'aptoCredito', 'documentacion'],
    caracteristicas: [],
  },

  /**
   * Un galpón tiene baños y oficinas, pero no dormitorios ni amenities. Los
   * doce tildes son todos de vivienda, así que no se le ofrece ninguno: lo suyo
   * —portón, playa de maniobras, fuerza motriz— vive en las fortalezas.
   */
  'Galpón': {
    campos: [
      'superficieConstruida',
      'superficieTerreno',
      'banos',
      'ambientes',
      'antiguedad',
      'estadoInmueble',
      'servicios',
      'expensas',
      'aptoCredito',
      'documentacion',
    ],
    caracteristicas: [],
  },

  /** Un local o una oficina tienen baños y ambientes, pero no dormitorios. */
  Local: {
    campos: TODOS.filter((c) => !SIN_VIVIENDA.includes(c)),
    caracteristicas: ['Cochera', 'Baulera'],
  },
  Oficina: {
    campos: TODOS.filter((c) => !SIN_VIVIENDA.includes(c) && c !== 'superficieTerreno'),
    caracteristicas: ['Cochera', 'Balcón', 'Baulera'],
  },

  /** El cajón de sastre: no se sabe qué es, así que se pide todo. */
  Otro: { campos: TODOS, caracteristicas: TODAS_LAS_CARACTERISTICAS },
};

/** Los campos que se le piden a esa tipología. */
export function camposDe(tipo: TipoPropiedad): Set<CampoFicha> {
  return new Set(FICHAS[tipo].campos);
}

/** Los tildes de «Características» que se le ofrecen a esa tipología. */
export function caracteristicasDe(tipo: TipoPropiedad): CaracteristicaFicha[] {
  return CARACTERISTICAS_FICHA.filter((c) => FICHAS[tipo].caracteristicas.includes(c));
}

/** Para los tests de la regla: todo lo que alguna tipología llega a pedir. */
export function tiposQuePiden(campo: CampoFicha): TipoPropiedad[] {
  return TipoPropiedadSchema.options.filter((t) => FICHAS[t].campos.includes(campo));
}
