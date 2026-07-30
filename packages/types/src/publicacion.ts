import { z } from 'zod';

/**
 * Módulo de Publicación: contratos compartidos entre la API y la web.
 *
 * Por ahora cubre la credencial de Tokko de cada inmobiliaria. La ficha de
 * propiedad y el feed llegan en los pasos siguientes.
 */

/**
 * Quién puede usar el módulo de Publicación.
 *
 * Vive acá y no duplicada en la API y en el front porque tenerla dos veces ya
 * falló: el front dejaba entrar a `admin_plataforma` y la API lo rechazaba con
 * un 403, que el borde de error mostraba como "no pudimos conectar con el
 * servidor". Media hora para encontrar una lista desincronizada.
 *
 * `publicador` es el rol funcional: quien carga y publica propiedades.
 * Los admins entran además porque son los que prueban el módulo antes de
 * asignarle el rol a nadie. Dirección NO entra por ser dirección: publicar no
 * es una tarea de conducción.
 */
export const ROLES_PUBLICACION = ['publicador', 'admin_tenant', 'admin_plataforma'] as const;

/** Proveedores de integración soportados. Hoy uno solo. */
export const ProveedorSchema = z.enum(['tokko']);
export type Proveedor = z.infer<typeof ProveedorSchema>;

/**
 * Lo que la API cuenta sobre una credencial guardada. **Nunca incluye el
 * secreto**: solo si está, sus últimos 4 caracteres —para que el admin
 * reconozca cuál cargó— y cuándo se cambió.
 */
export const CredencialEstadoSchema = z.object({
  configurada: z.boolean(),
  ultimos4: z.string().nullable(),
  actualizadoEl: z.string().nullable(),
});
export type CredencialEstado = z.infer<typeof CredencialEstadoSchema>;

/**
 * Alta o reemplazo de la credencial. El mínimo de 20 caracteres no es
 * arbitrario: las API keys de Tokko son de 40 caracteres hexadecimales, así que
 * algo mucho más corto es un pegado incompleto y conviene rechazarlo antes de
 * cifrarlo y guardarlo — si no, el error aparece recién al llamar a Tokko.
 */
export const GuardarCredencialSchema = z.object({
  secreto: z.string().trim().min(20, 'La clave parece incompleta.').max(500),
});
export type GuardarCredencial = z.infer<typeof GuardarCredencialSchema>;

/**
 * Resultado de probar la conexión contra Tokko.
 *
 * Es la prueba de fuego del circuito completo: valida la clave de cifrado, la
 * credencial guardada y que Tokko responda, en un solo click. Si algo está mal,
 * `error` dice qué —no un 500 genérico.
 */
export const PruebaConexionSchema = z.object({
  ok: z.boolean(),
  /** Cuántas propiedades ve la cuenta. Da confianza de que es la correcta. */
  propiedades: z.number().nullable(),
  error: z.string().nullable(),
});
export type PruebaConexion = z.infer<typeof PruebaConexionSchema>;

/** Cuántas propiedades traer de Tokko en una importación de prueba. */
export const ImportarSchema = z.object({
  cuantas: z.coerce.number().int().min(1).max(50).default(10),
});
export type Importar = z.infer<typeof ImportarSchema>;

/**
 * Resultado de traer propiedades desde Tokko.
 *
 * `sinAgente` se informa aparte porque es la única parte que necesita una
 * decisión humana: el email del agente en Tokko no siempre corresponde a un
 * usuario nuestro (mismo persona, mail personal contra corporativo).
 */
export const ResultadoImportacionSchema = z.object({
  leidas: z.number(),
  creadas: z.number(),
  actualizadas: z.number(),
  sinAgente: z.number(),
});
export type ResultadoImportacion = z.infer<typeof ResultadoImportacionSchema>;

/** Una propiedad como la muestra la pantalla. */
export const PropiedadDtoSchema = z.object({
  id: z.string(),
  tokkoId: z.number(),
  referenceCode: z.string().nullable(),
  titulo: z.string().nullable(),
  tipo: z.string().nullable(),
  operacion: z.string().nullable(),
  precio: z.number().nullable(),
  moneda: z.string().nullable(),
  direccion: z.string().nullable(),
  ubicacion: z.string().nullable(),
  fotos: z.number(),
  fotoPortada: z.string().nullable(),
  publicUrl: z.string().nullable(),
  /** Nombre del vendedor vinculado, o `null` si no se pudo vincular. */
  agente: z.string().nullable(),
  /** Cómo figura en Tokko — se muestra cuando no hay vínculo, para saber a quién reclamar. */
  agenteTokko: z.string().nullable(),
  creadoEnTokko: z.string().nullable(),
});
export type PropiedadDto = z.infer<typeof PropiedadDtoSchema>;

/** Cuántas filas del espejo se borraron. */
export const VaciadoSchema = z.object({ borradas: z.number() });
export type Vaciado = z.infer<typeof VaciadoSchema>;
