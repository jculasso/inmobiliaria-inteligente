// Contratos Zod del módulo Tablero Comercial (Paso 3).
// Modelo: docs/MODELO_DATOS_TABLERO.md (Parte B/C). Compartidos back/front.
//
// Los montos viajan como `number` (USD). En la base son numeric(14,2); la
// conversión Decimal<->number la hace la capa de servicio de la API.
import { z } from 'zod';
import { RolSchema } from './rol';

/** Fecha ISO `YYYY-MM-DD` (almacenamiento en UTC). */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD');

/**
 * Monto en USD. Los montos se guardan en la base como `numeric(14,2)`
 * (máximo 12 dígitos enteros): sin este tope, un valor más grande pasa la
 * validación y recién explota en Postgres como "numeric field overflow",
 * un 500 críptico en vez de un error de validación claro.
 */
const MONTO_MAXIMO = 999_999_999_999.99;
export const MontoSchema = z
  .number()
  .nonnegative()
  .max(MONTO_MAXIMO, `El monto no puede superar $${MONTO_MAXIMO.toLocaleString('en-US')}.`);

export const TipoOperacionSchema = z.enum(['venta', 'alquiler']);
export type TipoOperacion = z.infer<typeof TipoOperacionSchema>;

/** Estados de una venta (el prototipo usa escriturada|senada). */
export const EstadoVentaSchema = z.enum(['escriturada', 'senada', 'reservada', 'boleto']);
export type EstadoVenta = z.infer<typeof EstadoVentaSchema>;

/** Estados de un alquiler. */
export const EstadoAlquilerSchema = z.enum(['firmado', 'reservado', 'pendiente']);
export type EstadoAlquiler = z.infer<typeof EstadoAlquilerSchema>;

export const EstadoOperacionSchema = z.enum([
  'escriturada',
  'senada',
  'reservada',
  'boleto',
  'firmado',
  'reservado',
  'pendiente',
]);
export type EstadoOperacion = z.infer<typeof EstadoOperacionSchema>;

/** Lado de una punta: mapea punta_vend / punta_comp del prototipo. */
export const LadoPuntaSchema = z.enum(['vendedora', 'compradora']);
export type LadoPunta = z.infer<typeof LadoPuntaSchema>;

/** Punta (atribución a un agente) al crear/editar una venta. */
export const PuntaInputSchema = z.object({
  lado: LadoPuntaSchema,
  usuarioId: z.string().uuid(),
  comision: MontoSchema.default(0),
});
export type PuntaInput = z.infer<typeof PuntaInputSchema>;

const OperacionBaseFields = {
  codigo: z.string().min(1).max(40),
  direccion: z.string().min(1),
  moneda: z.string().default('USD'),
  fechaReserva: IsoDateSchema.nullish(),
  fechaFirma: IsoDateSchema.nullish(),
  obs: z.string().nullish(),
};

/** Alta de una venta: precio + 1 o 2 puntas. cant_puntas se deriva de `puntas`. */
export const CreateVentaSchema = z.object({
  tipo: z.literal('venta'),
  ...OperacionBaseFields,
  precio: MontoSchema,
  estado: EstadoVentaSchema.default('escriturada'),
  puntas: z.array(PuntaInputSchema).min(1).max(2),
});

/** Alta de un alquiler: valor mensual + comisión. Sin puntas (no se atribuye agente). */
export const CreateAlquilerSchema = z.object({
  tipo: z.literal('alquiler'),
  ...OperacionBaseFields,
  valorMensual: MontoSchema,
  comision: MontoSchema.default(0),
  estado: EstadoAlquilerSchema.default('firmado'),
});

export const CreateOperacionSchema = z.discriminatedUnion('tipo', [
  CreateVentaSchema,
  CreateAlquilerSchema,
]);
export type CreateOperacion = z.infer<typeof CreateOperacionSchema>;

/** Edición parcial. No permite cambiar `tipo`. `puntas` reemplaza el set completo. */
export const UpdateOperacionSchema = z
  .object({
    codigo: z.string().min(1).max(40),
    direccion: z.string().min(1),
    moneda: z.string(),
    precio: MontoSchema.nullable(),
    valorMensual: MontoSchema.nullable(),
    comision: MontoSchema,
    estado: EstadoOperacionSchema,
    fechaReserva: IsoDateSchema.nullable(),
    fechaFirma: IsoDateSchema.nullable(),
    obs: z.string().nullable(),
    puntas: z.array(PuntaInputSchema).max(2),
  })
  .partial();
export type UpdateOperacion = z.infer<typeof UpdateOperacionSchema>;

/** Filtro de listados y KPIs por año/mes. */
export const KpiFiltroSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});
export type KpiFiltro = z.infer<typeof KpiFiltroSchema>;

/** Filtro de listado de operaciones (agrega tipo/estado/vendedor, todos opcionales). */
export const OperacionFiltroSchema = KpiFiltroSchema.extend({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  tipo: TipoOperacionSchema.optional(),
  /** Estado exacto (ej. 'senada', 'escriturada', 'firmado') — usado por el drill-down del dashboard. */
  estado: z.string().optional(),
  /** Filtra a las operaciones donde este usuario tiene una punta — drill-down por vendedor. */
  usuarioId: z.string().uuid().optional(),
});
export type OperacionFiltro = z.infer<typeof OperacionFiltroSchema>;

// --- Vendedores (usuarios comerciales) ---

export const RolAsignableSchema = z.enum(['vendedor', 'team_leader', 'direccion', 'admin_tenant']);

/** Objetivo anual de un vendedor. */
export const ObjetivoInputSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  objComision: MontoSchema.default(0),
  objVolumen: MontoSchema.default(0),
  objPuntas: z.number().int().nonnegative().default(0),
});
export type ObjetivoInput = z.infer<typeof ObjetivoInputSchema>;

export const CreateVendedorSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  estado: z.enum(['activo', 'inactivo']).default('activo'),
  liderId: z.string().uuid().nullish(),
  roles: z.array(RolAsignableSchema).min(1).default(['vendedor']),
  // Opcional: si viene, se upsertea en la MISMA transacción del alta — evita
  // un segundo round-trip completo (POST /vendedores + PUT /objetivo) solo
  // para cargar el objetivo del año al crear un vendedor.
  objetivo: ObjetivoInputSchema.optional(),
});
export type CreateVendedor = z.infer<typeof CreateVendedorSchema>;

export const UpdateVendedorSchema = z
  .object({
    nombre: z.string().min(1),
    email: z.string().email(),
    estado: z.enum(['activo', 'inactivo']),
    liderId: z.string().uuid().nullable(),
    roles: z.array(RolAsignableSchema).min(1),
    objetivo: ObjetivoInputSchema,
  })
  .partial();
export type UpdateVendedor = z.infer<typeof UpdateVendedorSchema>;

// --- Tipos de respuesta de KPIs ---
// Antes eran `interface` TS puras; se pasan a Zod (shape idéntico) para poder
// validar en runtime las respuestas de la API desde el front (Paso 5).

/** Agregado de negocio para un alcance (tenant, equipo o vendedor). */
export const AgregadoKpiSchema = z.object({
  volumen: z.number(),
  operaciones: z.number(),
  puntas: z.number(),
  puntasCompradoras: z.number(),
  puntasVendedoras: z.number(),
  comision: z.number(),
  ticketPromedio: z.number(),
});
export type AgregadoKpi = z.infer<typeof AgregadoKpiSchema>;

export const RankingItemSchema = z.object({
  usuarioId: z.string(),
  nombre: z.string(),
  volumen: z.number(),
  operaciones: z.number(),
  puntas: z.number(),
  puntasCompradoras: z.number(),
  puntasVendedoras: z.number(),
  ticketPromedio: z.number(),
  comision: z.number(),
  /** Participación sobre el volumen total del alcance (0..1). */
  peso: z.number(),
});
export type RankingItem = z.infer<typeof RankingItemSchema>;

export const AlquileresResumenSchema = z.object({
  firmados: z.number(),
  comision: z.number(),
  valorMensualPromedio: z.number(),
});
export type AlquileresResumen = z.infer<typeof AlquileresResumenSchema>;

export const ResumenKpisSchema = z.object({
  anio: z.number(),
  mes: z.number().optional(),
  anual: AgregadoKpiSchema,
  mesActual: AgregadoKpiSchema.optional(),
  /** Comisión de operaciones señadas del año (pendiente de cobro). */
  pendienteCobro: z.number(),
  operacionesSenadas: z.number(),
  alquileres: AlquileresResumenSchema,
});
export type ResumenKpis = z.infer<typeof ResumenKpisSchema>;

export const SeguimientoObjetivoSchema = z.object({
  usuarioId: z.string(),
  nombre: z.string(),
  anio: z.number(),
  objComision: z.number(),
  objVolumen: z.number(),
  objPuntas: z.number(),
  realComision: z.number(),
  realVolumen: z.number(),
  realPuntas: z.number(),
  avanceComision: z.number(), // real/obj (0..n), 0 si obj=0
  avanceVolumen: z.number(),
  avancePuntas: z.number(),
});
export type SeguimientoObjetivo = z.infer<typeof SeguimientoObjetivoSchema>;

// --- DTOs de respuesta de operaciones y vendedores (Paso 5) ---
// Reflejan literalmente `toDto` en operaciones.service.ts / vendedores.service.ts.

export const PuntaDtoSchema = z.object({
  id: z.string().uuid(),
  lado: LadoPuntaSchema,
  usuarioId: z.string().uuid(),
  nombre: z.string(),
  comision: z.number(),
});
export type PuntaDto = z.infer<typeof PuntaDtoSchema>;

export const OperacionDtoSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  tipo: TipoOperacionSchema,
  direccion: z.string(),
  precio: z.number().nullable(),
  valorMensual: z.number().nullable(),
  moneda: z.string(),
  cantPuntas: z.number(),
  comTotal: z.number(),
  estado: EstadoOperacionSchema,
  fechaReserva: z.string().nullable(),
  fechaFirma: z.string().nullable(),
  anio: z.number().nullable(),
  mes: z.number().nullable(),
  obs: z.string().nullable(),
  puntas: z.array(PuntaDtoSchema),
});
export type OperacionDto = z.infer<typeof OperacionDtoSchema>;

export const ObjetivoDtoSchema = z.object({
  anio: z.number(),
  objComision: z.number(),
  objVolumen: z.number(),
  objPuntas: z.number(),
});
export type ObjetivoDto = z.infer<typeof ObjetivoDtoSchema>;

/** Respuesta de `PUT /tablero/vendedores/:id/objetivo` (incluye el usuarioId). */
export const ObjetivoSetDtoSchema = ObjetivoDtoSchema.extend({
  usuarioId: z.string().uuid(),
});
export type ObjetivoSetDto = z.infer<typeof ObjetivoSetDtoSchema>;

export const VendedorDtoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  email: z.string().email(),
  estado: z.enum(['activo', 'inactivo']),
  liderId: z.string().uuid().nullable(),
  lider: z.object({ id: z.string().uuid(), nombre: z.string() }).nullable(),
  // A diferencia de Create/UpdateVendedorSchema (lo que esta UI puede asignar),
  // acá se lista lo que ya existe en el tenant — un usuario puede tener además
  // `admin_plataforma` (ej. el dueño de la plataforma operando como vendedor).
  roles: z.array(RolSchema),
  objetivos: z.array(ObjetivoDtoSchema),
});
export type VendedorDto = z.infer<typeof VendedorDtoSchema>;
