// Qué fortalezas y qué aspectos a considerar se le ofrecen al tasador, según el
// tipo de propiedad.
//
// POR QUÉ NO ES UNA LISTA SOLA. Hasta septiembre de 2026 había una única lista
// de 16 fortalezas y 13 aspectos, igual para todo. Estaba escrita mirando
// departamentos, y Vacker lo marcó: al tasar un lote o un galpón, media lista no
// venía al caso. Peor todavía, al tasar una COCHERA aparecía «Falta de cochera».
//
// POR QUÉ GRUPOS Y NO "generales + propias". Con dos baldes hace falta que las
// «generales» valgan para las nueve tipologías, y no hay tal cosa: «Buena
// luminosidad» no le cabe a un terreno y «Falta de cochera» no le cabe a una
// cochera. Acá cada ítem vive en UN grupo y cada tipología declara qué grupos
// toma. La contradicción deja de ser algo que hay que recordar no escribir: es
// imposible de expresar.
//
// LA REGLA QUE NO SE ROMPE. El catálogo solo crece. Un valor que alguna vez se
// guardó no se borra ni se renombra nunca: las tasaciones guardan el texto, y el
// listado valida la respuesta entera, así que un valor huérfano no rompe esa
// tasación — rompe el listado completo. `tasador-catalogo.test.ts` lo comprueba
// contra la lista de los 29 valores que existían antes de este cambio.
import { TipoPropiedadSchema, type TipoPropiedad } from './tasador';

/** Los grupos que se comparten entre tipologías. */
export type GrupoComun = 'universal' | 'construido' | 'habitable';

interface Catalogo {
  /** Vale para las nueve tipologías, incluidos terreno y cochera. */
  universal: string[];
  /** Hay algo edificado: todo menos terreno y cochera. */
  construido: string[];
  /** Se habita o se trabaja adentro: ambientes, luz, distribución, balcón. */
  habitable: string[];
  propias: Record<TipoPropiedad, string[]>;
}

/**
 * Qué grupos toma cada tipología.
 *
 * Un terreno no toma `construido` ni `habitable` —no tiene ambientes ni
 * instalaciones—, y una cochera tampoco toma `habitable`, que es de donde sale
 * «Falta de cochera».
 */
const GRUPOS: Record<TipoPropiedad, GrupoComun[]> = {
  Departamento: ['universal', 'construido', 'habitable'],
  Casa: ['universal', 'construido', 'habitable'],
  PH: ['universal', 'construido', 'habitable'],
  Terreno: ['universal'],
  'Galpón': ['universal', 'construido'],
  Local: ['universal', 'construido', 'habitable'],
  Oficina: ['universal', 'construido', 'habitable'],
  Cochera: ['universal'],
  Otro: ['universal', 'construido', 'habitable'],
};

const FORTALEZAS: Catalogo = {
  universal: [
    'Excelente ubicación',
    'Buena accesibilidad',
    'Buena conectividad',
    'Cercanía a avenidas principales',
    'Cercanía a transporte público',
    'Cercanía a corredores comerciales',
    'Cercanía a espacios verdes',
    'Entorno consolidado',
    'Zona de alta demanda',
    'Alta demanda para la tipología',
    'Buena relación precio-superficie',
    'Buena orientación',
    'Apto crédito',
    'Documentación en orden',
    'Posesión inmediata',
    'Uso flexible',
    'Potencial de renta',
    'Potencial de revalorización',
    'Bajas expensas',
    'Sin expensas',
  ],
  construido: [
    'Buen estado general',
    'Excelente estado de conservación',
    'Recientemente renovado',
    'Buena calidad constructiva',
    'Potencial de reforma',
    'Frente destacado',
    'Buena exposición',
  ],
  habitable: [
    'Buena luminosidad',
    'Ambientes amplios',
    'Buena distribución',
    'Buena ventilación',
    'Espacios versátiles',
    'Vista despejada',
    'Cochera incluida',
    'Balcón funcional',
  ],
  propias: {
    Departamento: [
      'Edificio bien mantenido',
    ],
    Casa: [
      'Patio',
      'Jardín',
      'Quincho',
      'Parrillero',
      'Terraza',
      'Piscina',
      'Ingreso vehicular',
      'Doble ingreso',
      'Ingreso independiente',
      'Dependencias de servicio',
      'Lavadero independiente',
      'Espacio verde',
      'Buena proporción de terreno libre',
      'Posibilidad de ampliación',
      'Posibilidad de construir planta alta',
      'Propiedad desarrollada en una planta',
      'Buena relación terreno-construcción',
      'Privacidad',
      'Cochera para varios vehículos',
      'Excelente ventilación cruzada',
    ],
    PH: [
      'Patio',
      'Jardín',
      'Quincho',
      'Parrillero',
      'Terraza',
      'Piscina',
      'Ingreso vehicular',
      'Doble ingreso',
      'Ingreso independiente',
      'Dependencias de servicio',
      'Lavadero independiente',
      'Espacio verde',
      'Buena proporción de terreno libre',
      'Posibilidad de ampliación',
      'Posibilidad de construir planta alta',
      'Propiedad desarrollada en una planta',
      'Buena relación terreno-construcción',
      'Privacidad',
      'Cochera para varios vehículos',
      'Excelente ventilación cruzada',
      'PH con independencia total',
      'Terraza exclusiva',
      'Patio exclusivo',
      'Buena privacidad respecto a unidades linderas',
    ],
    Terreno: [
      'Excelente frente',
      'Buen ancho de lote',
      'Buen fondo',
      'Superficie regular',
      'Lote rectangular',
      'Esquina',
      'Doble frente',
      'Buen aprovechamiento edificable',
      'Alto potencial constructivo',
      'Buena incidencia del terreno',
      'Servicios disponibles',
      'Todos los servicios',
      'Calle pavimentada',
      'Zona en crecimiento',
      'Apto desarrollo inmobiliario',
      'Apto vivienda',
      'Apto uso comercial',
      'Apto uso industrial',
      'Posibilidad de subdivisión',
      'Posibilidad de unificación',
      'Cercanía a rutas o autopistas',
    ],
    'Galpón': [
      'Excelente acceso para camiones',
      'Acceso para carga y descarga',
      'Portón de grandes dimensiones',
      'Altura libre favorable',
      'Gran superficie cubierta',
      'Planta libre',
      'Buena capacidad de almacenamiento',
      'Piso de alta resistencia',
      'Oficina administrativa',
      'Vestuarios',
      'Baños para personal',
      'Playa de maniobras',
      'Espacio descubierto',
      'Fuerza motriz',
      'Red trifásica',
      'Buena conectividad logística',
      'Cercanía a circunvalación',
      'Cercanía a rutas o autopistas',
      'Zona industrial consolidada',
      'Apto múltiples actividades',
      'Posibilidad de sectorización',
      'Buen estado estructural',
    ],
    Local: [
      'Vidriera a la calle',
      'Alto tránsito peatonal',
      'Apto múltiples rubros',
      'Depósito interno',
      'Baño para personal',
      'Ingreso independiente',
    ],
    Oficina: [
      'Edificio bien mantenido',
      'Planta libre',
      'Apto uso profesional',
      'Recepción',
      'Baño privado',
    ],
    Cochera: [
      'Acceso vehicular',
      'Fácil maniobra',
      'Apta camioneta',
      'Cubierta',
    ],
    Otro: [],
  },
};

const ASPECTOS: Catalogo = {
  universal: [
    'Alta competencia en la zona',
    'Precio sensible para la demanda actual',
    'Documentación pendiente de revisión',
    'Regularización pendiente',
    'Baja demanda para la tipología',
    'Entorno en consolidación',
    'Ubicación secundaria',
    'Acceso incómodo',
    'Orientación desfavorable',
    'Ruido exterior',
    'Necesidad de inversión inicial',
    'Plazo de comercialización potencialmente mayor',
    'Expensas elevadas',
  ],
  construido: [
    'Necesita mejoras',
    'Requiere actualización estética',
    'Requiere reforma integral',
    'Estado original',
    'Mantenimiento pendiente',
    'Instalaciones antiguas',
    'Calidad constructiva estándar',
  ],
  habitable: [
    'Ambientes chicos',
    'Baja luminosidad',
    'Disposición interna',
    'Ventilación limitada',
    'Falta de cochera',
    'Falta de espacio exterior',
    'Barreras de accesibilidad',
    'Falta de balcón',
  ],
  propias: {
    Departamento: [
      'Edificio antiguo',
      'Escaleras',
      'Sin ascensor',
    ],
    Casa: [
      'Patio reducido',
      'Poco terreno libre',
      'Acceso compartido',
      'Escasa privacidad',
      'Distribución en varias plantas',
      'Dormitorios en planta alta',
      'Humedad visible',
      'Cubierta o techo a revisar',
      'Instalaciones a actualizar',
      'Baños antiguos',
      'Cocina antigua',
      'Falta de espacio verde',
      'Ampliaciones no regularizadas',
    ],
    PH: [
      'Patio reducido',
      'Poco terreno libre',
      'Acceso compartido',
      'Escasa privacidad',
      'Distribución en varias plantas',
      'Dormitorios en planta alta',
      'Humedad visible',
      'Cubierta o techo a revisar',
      'Instalaciones a actualizar',
      'Baños antiguos',
      'Cocina antigua',
      'Falta de espacio verde',
      'Ampliaciones no regularizadas',
      'PH interno',
      'Pasillo de acceso',
    ],
    Terreno: [
      'Frente reducido',
      'Fondo irregular',
      'Lote irregular',
      'Superficie difícil de aprovechar',
      'Incidencia elevada',
      'Restricciones urbanísticas',
      'Baja capacidad constructiva',
      'Servicios incompletos',
      'Calle sin pavimentar',
      'Zona poco consolidada',
      'Acceso limitado',
      'Necesidad de demolición',
      'Construcción existente a retirar',
      'Desnivel del terreno',
      'Necesidad de relleno o nivelación',
      'Medianeras a revisar',
    ],
    'Galpón': [
      'Altura insuficiente',
      'Acceso limitado para camiones',
      'Falta de playa de maniobras',
      'Portón pequeño',
      'Piso a reparar',
      'Cubierta a reparar',
      'Instalación eléctrica insuficiente',
      'Sin fuerza motriz',
      'Falta de oficinas',
      'Falta de baños o vestuarios',
      'Poco espacio descubierto',
      'Ubicación alejada de corredores logísticos',
      'Restricciones de uso',
      'Estructura antigua',
      'Necesidad de adecuación normativa',
      'Dificultad para dividir espacios',
    ],
    Local: [
      'Edificio antiguo',
      'Vidriera reducida',
      'Bajo tránsito peatonal',
      'Sin depósito',
      'Restricciones de rubro',
    ],
    Oficina: [
      'Edificio antiguo',
      'Sin baño privado',
      'Distribución poco flexible',
    ],
    Cochera: [
      'Maniobra difícil',
      'Descubierta',
      'No apta camioneta',
    ],
    Otro: [],
  },
};
function componer(catalogo: Catalogo, tipo: TipoPropiedad): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const grupo of GRUPOS[tipo]) {
    for (const valor of catalogo[grupo]) {
      if (!vistos.has(valor)) {
        vistos.add(valor);
        salida.push(valor);
      }
    }
  }
  for (const valor of catalogo.propias[tipo]) {
    if (!vistos.has(valor)) {
      vistos.add(valor);
      salida.push(valor);
    }
  }
  return salida;
}

/** Fortalezas que se le ofrecen a esa tipología, en orden de pantalla. */
export function fortalezasDe(tipo: TipoPropiedad): string[] {
  return componer(FORTALEZAS, tipo);
}

/** Aspectos a considerar que se le ofrecen a esa tipología, en orden de pantalla. */
export function aspectosDe(tipo: TipoPropiedad): string[] {
  return componer(ASPECTOS, tipo);
}

/**
 * Todo lo que el catálogo puede ofrecer, sin importar la tipología.
 *
 * Es lo que usa el test de la regla que no se rompe, y lo que necesita la
 * pantalla para saber si un valor guardado es del catálogo o lo escribió alguien
 * a mano.
 */
export function todasLasFortalezas(): Set<string> {
  return new Set(TipoPropiedadSchema.options.flatMap((t) => fortalezasDe(t)));
}
export function todosLosAspectos(): Set<string> {
  return new Set(TipoPropiedadSchema.options.flatMap((t) => aspectosDe(t)));
}
