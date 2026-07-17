// Contratos Zod del módulo Tablero Comercial (Paso 3).
// Modelo: docs/MODELO_DATOS_TABLERO.md (Parte B/C). Compartidos back/front.
//
// Los montos viajan como `number` (USD). En la base son numeric(14,2); la
// conversión Decimal<->number la hace la capa de servicio de la API.
import { z } from 'zod';

/** Fecha ISO `YYYY-MM-DD` (almacenamiento en UTC). */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera YYYY-MM-DD');

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
  comision: z.number().nonnegative().default(0),
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
  precio: z.number().nonnegative(),
  estado: EstadoVentaSchema.default('escriturada'),
  puntas: z.array(PuntaInputSchema).min(1).max(2),
});

/** Alta de un alquiler: valor mensual + comisión. Sin puntas (no se atribuye agente). */
export const CreateAlquilerSchema = z.object({
  tipo: z.literal('alquiler'),
  ...OperacionBaseFields,
  valorMensual: z.number().nonnegative(),
  comision: z.number().nonnegative().default(0),
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
    precio: z.number().nonnegative().nullable(),
    valorMensual: z.number().nonnegative().nullable(),
    comision: z.number().nonnegative(),
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

/** Filtro de listado de operaciones (agrega tipo opcional). */
export const OperacionFiltroSchema = KpiFiltroSchema.extend({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  tipo: TipoOperacionSchema.optional(),
});
export type OperacionFiltro = z.infer<typeof OperacionFiltroSchema>;

// --- Vendedores (usuarios comerciales) ---

export const RolAsignableSchema = z.enum(['vendedor', 'team_leader', 'direccion', 'admin_tenant']);

export const CreateVendedorSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  estado: z.enum(['activo', 'inactivo']).default('activo'),
  liderId: z.string().uuid().nullish(),
  roles: z.array(RolAsignableSchema).min(1).default(['vendedor']),
});
export type CreateVendedor = z.infer<typeof CreateVendedorSchema>;

export const UpdateVendedorSchema = z
  .object({
    nombre: z.string().min(1),
    email: z.string().email(),
    estado: z.enum(['activo', 'inactivo']),
    liderId: z.string().uuid().nullable(),
    roles: z.array(RolAsignableSchema).min(1),
  })
  .partial();
export type UpdateVendedor = z.infer<typeof UpdateVendedorSchema>;

/** Objetivo anual de un vendedor. */
export const ObjetivoInputSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  objComision: z.number().nonnegative().default(0),
  objVolumen: z.number().nonnegative().default(0),
  objPuntas: z.number().int().nonnegative().default(0),
});
export type ObjetivoInput = z.infer<typeof ObjetivoInputSchema>;

// --- Tipos de respuesta de KPIs ---

/** Agregado de negocio para un alcance (tenant, equipo o vendedor). */
export interface AgregadoKpi {
  volumen: number;
  operaciones: number;
  puntas: number;
  puntasCompradoras: number;
  puntasVendedoras: number;
  comision: number;
  ticketPromedio: number;
}

export interface RankingItem {
  usuarioId: string;
  nombre: string;
  volumen: number;
  operaciones: number;
  puntas: number;
  puntasCompradoras: number;
  puntasVendedoras: number;
  ticketPromedio: number;
  comision: number;
  /** Participación sobre el volumen total del alcance (0..1). */
  peso: number;
}

export interface AlquileresResumen {
  firmados: number;
  comision: number;
  valorMensualPromedio: number;
}

export interface ResumenKpis {
  anio: number;
  mes?: number;
  anual: AgregadoKpi;
  mesActual?: AgregadoKpi;
  /** Comisión de operaciones señadas del año (pendiente de cobro). */
  pendienteCobro: number;
  operacionesSenadas: number;
  alquileres: AlquileresResumen;
}

export interface SeguimientoObjetivo {
  usuarioId: string;
  nombre: string;
  anio: number;
  objComision: number;
  objVolumen: number;
  objPuntas: number;
  realComision: number;
  realVolumen: number;
  realPuntas: number;
  avanceComision: number; // real/obj (0..n), 0 si obj=0
  avanceVolumen: number;
  avancePuntas: number;
}
