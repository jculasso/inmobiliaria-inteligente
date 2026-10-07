// El informe al propietario (spec alquileres-fase-1.md, reglas 83 a 97).
// Javier, 7/10/2026: «cómo está funcionando su propiedad», para el
// administrador y en un PDF para el propietario.
import { z } from 'zod';
import {
  EnviarPorMailSchema,
  EstadoContratoSchema,
  EstadoReclamoSchema,
  MedioCobroSchema,
  MonedaAlquilerSchema,
  PeriodoSchema,
  RANGO_DE_UN_ANIO,
  RANGO_EN_ORDEN,
} from './alquileres';

const FechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera AAAA-MM-DD.');

/** El período del informe: meses `AAAA-MM`, en orden y de un año como máximo (regla 84). */
export const InformePeriodoQuerySchema = z
  .object({ desde: PeriodoSchema, hasta: PeriodoSchema })
  .refine(...RANGO_EN_ORDEN)
  .refine(...RANGO_DE_UN_ANIO);
export type InformePeriodoQuery = z.infer<typeof InformePeriodoQuerySchema>;

/** Mandar el informe por mail: a quién, y de qué período (regla 95). */
export const EnviarInformeSchema = EnviarPorMailSchema.extend({
  desde: PeriodoSchema,
  hasta: PeriodoSchema,
})
  .refine(...RANGO_EN_ORDEN)
  .refine(...RANGO_DE_UN_ANIO);
export type EnviarInforme = z.infer<typeof EnviarInformeSchema>;

/**
 * La cadena de una moneda (regla 87). Cierra al centavo:
 * alquiler − enEspera = cobrado; cobrado − descuentos + reintegros = neto;
 * neto = liquidado + pendiente.
 */
export const CadenaInformeSchema = z.object({
  moneda: MonedaAlquilerSchema,
  alquiler: z.number(),
  enEspera: z.number(),
  cobrado: z.number(),
  honorarios: z.number(),
  impuestos: z.number(),
  expensas: z.number(),
  arreglos: z.number(),
  otros: z.number(),
  reintegros: z.number(),
  neto: z.number(),
  liquidado: z.number(),
  /** Negativo: se le descuenta en la próxima liquidación. */
  pendiente: z.number(),
});
export type CadenaInformeDto = z.infer<typeof CadenaInformeSchema>;

/**
 * Los renglones de la cadena (regla 87), en el orden en que se leen, con el
 * signo en el nombre y el importe en positivo: `[nombre, importe, fuerte]`.
 * Un descuento en cero no se lista; el alquiler, lo cobrado, el neto, lo
 * liquidado y lo pendiente, siempre. Una sola lista para la pantalla y el PDF.
 */
export function renglonesDeLaCadena(c: CadenaInformeDto): [string, number, boolean][] {
  const r: [string, number, boolean][] = [['Alquiler del período', c.alquiler, false]];
  if (c.enEspera) r.push(['− El inquilino todavía no pagó', c.enEspera, false]);
  r.push(['Cobrado', c.cobrado, true]);
  const descuentos: [string, number][] = [
    ['Honorarios', c.honorarios],
    ['Impuestos y servicios', c.impuestos],
    ['Expensas', c.expensas],
    ['Arreglos', c.arreglos],
    ['Otros descuentos', c.otros],
  ];
  for (const [nombre, v] of descuentos) if (v) r.push([`− ${nombre}`, v, false]);
  if (c.reintegros) r.push(['+ Reintegros a su favor', c.reintegros, false]);
  r.push(['Neto del período', c.neto, true]);
  r.push(['Liquidado (transferido)', c.liquidado, false]);
  r.push([
    c.pendiente < 0 ? 'A descontar en la próxima liquidación' : 'Pendiente de liquidar',
    Math.abs(c.pendiente),
    false,
  ]);
  return r;
}

/** Los renglones del detalle de descuentos (regla 91) y lo que se le reconoce aparte. */
export const CategoriaPartidaSchema = z.enum([
  'honorarios',
  'impuestos',
  'expensas',
  'arreglos',
  'otros',
  'reintegros',
]);
export type CategoriaPartida = z.infer<typeof CategoriaPartidaSchema>;
export const NOMBRE_CATEGORIA_PARTIDA: Record<CategoriaPartida, string> = {
  honorarios: 'Honorarios',
  impuestos: 'Impuestos y servicios',
  expensas: 'Expensas',
  arreglos: 'Arreglos',
  otros: 'Otros descuentos',
  reintegros: 'Reintegros a su favor',
};

const LiquidacionMiniSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int(),
  fecha: FechaIso,
});
export type LiquidacionMiniDto = z.infer<typeof LiquidacionMiniSchema>;

export const InformePropietarioDtoSchema = z.object({
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  desde: PeriodoSchema,
  hasta: PeriodoSchema,
  /** La fecha del informe: lo cobrado y lo liquidado se cuentan hasta hoy (regla 85). */
  hoy: FechaIso,
  /** Una cadena por moneda con movimientos; vacío, no hubo movimientos (regla 94). */
  resumen: z.array(CadenaInformeSchema),
  /** Lo que deben hoy los inquilinos de sus contratos, ya vencido (regla 89). */
  deuda: z.array(
    z.object({
      moneda: MonedaAlquilerSchema,
      total: z.number(),
      contratos: z.array(
        z.object({
          id: z.string().uuid(),
          codigo: z.string(),
          inquilino: z.string(),
          importe: z.number(),
        }),
      ),
    }),
  ),
  /** Sus contratos del período, cada uno con sus meses (regla 90). */
  contratos: z.array(
    z.object({
      id: z.string().uuid(),
      codigo: z.string(),
      moneda: MonedaAlquilerSchema,
      estado: EstadoContratoSchema,
      propiedad: z.string(),
      inquilinos: z.array(z.string()),
      /** Su parte, si el contrato tiene varios propietarios; con uno solo, `null`. */
      porcentaje: z.number().nullable(),
      alquilerVigente: z.number().nullable(),
      proximaIndexacion: FechaIso.nullable(),
      vence: FechaIso,
      meses: z.array(
        z.object({
          periodo: PeriodoSchema,
          /** Su parte del alquiler del mes. */
          alquiler: z.number(),
          cobrado: z.number(),
          enEspera: z.number(),
          /** Cuándo pagó el inquilino ese mes (fechas de los cobros). */
          cobradoEl: z.array(FechaIso),
          /** En qué liquidaciones se le pagó. */
          liquidaciones: z.array(LiquidacionMiniSchema),
        }),
      ),
    }),
  ),
  /** Cada descuento (y cada reintegro), con su nombre y si ya se liquidó (regla 91). */
  partidas: z.array(
    z.object({
      conceptoId: z.string().uuid(),
      categoria: CategoriaPartidaSchema,
      /** «Honorarios», el impuesto («TGI (Tasa municipal)»), la expensa, el proveedor. */
      nombre: z.string(),
      detalle: z.string(),
      periodo: PeriodoSchema,
      contrato: z.object({ id: z.string().uuid(), codigo: z.string(), propiedad: z.string() }),
      moneda: MonedaAlquilerSchema,
      importe: z.number(),
      /** La liquidación en que se descontó; `null`, va en la próxima. */
      liquidacion: LiquidacionMiniSchema.nullable(),
    }),
  ),
  /** Los reclamos del período, sin sus notas internas (regla 92). */
  reclamos: z.array(
    z.object({
      id: z.string().uuid(),
      numero: z.number().int(),
      fecha: FechaIso,
      asunto: z.string(),
      estado: EstadoReclamoSchema,
      contrato: z.object({ id: z.string().uuid(), codigo: z.string() }).nullable(),
      propiedad: z.string().nullable(),
      proveedor: z.string().nullable(),
      /** Lo que costó a cargo del propietario, por moneda; vacío, no se le cargó nada. */
      aCargoDelPropietario: z.array(
        z.object({ moneda: MonedaAlquilerSchema, importe: z.number() }),
      ),
    }),
  ),
  /** Las liquidaciones que le pagaron algo del período (regla 93). */
  liquidaciones: z.array(
    z.object({
      id: z.string().uuid(),
      numero: z.number().int(),
      fecha: FechaIso,
      medio: MedioCobroSchema,
      moneda: MonedaAlquilerSchema,
      /** El neto de toda la liquidación. */
      neto: z.number(),
      /** Lo que de ese neto es del período: suman «Liquidado». */
      delPeriodo: z.number(),
    }),
  ),
});
export type InformePropietarioDto = z.infer<typeof InformePropietarioDtoSchema>;

/** La tabla de todos los propietarios (regla 96): lo mismo que cada informe, en una fila. */
export const InformePropietariosDtoSchema = z.object({
  desde: PeriodoSchema,
  hasta: PeriodoSchema,
  hoy: FechaIso,
  filas: z.array(
    z.object({
      persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
      contratos: z.number().int(),
      reclamos: z.number().int(),
      monedas: z.array(CadenaInformeSchema),
    }),
  ),
  /** Los totales, uno por moneda: pesos y dólares no se suman (regla 88). */
  totales: z.array(CadenaInformeSchema),
});
export type InformePropietariosDto = z.infer<typeof InformePropietariosDtoSchema>;
