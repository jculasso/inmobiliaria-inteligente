// El informe al propietario (spec alquileres-fase-1.md, reglas 83 a 98).
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
  /** Lo que va a su favor en la próxima liquidación: nunca negativo (regla 98). */
  pendiente: z.number(),
  /**
   * Lo que se le descuenta en la próxima liquidación porque ya se le liquidó
   * más de lo que deja el período (regla 98). Con algo acá, `pendiente` es cero.
   */
  aDescontar: z.number(),
});
export type CadenaInformeDto = z.infer<typeof CadenaInformeSchema>;

/** Un renglón de la cadena: el signo va en el nombre y el importe, en positivo. */
export interface RenglonCadena {
  nombre: string;
  importe: number;
  fuerte: boolean;
  /** Qué es, cuando hace falta decirlo: lo que se descuenta en la próxima liquidación. */
  detalle?: string;
}

/**
 * Los renglones de la cadena (reglas 87 y 98), en el orden en que se leen.
 * Un descuento en cero no se lista; el alquiler, lo cobrado, el neto, lo
 * liquidado y lo pendiente, siempre —lo pendiente nunca negativo—, y «A
 * descontar en la próxima liquidación» solo si hay algo, con `queSeDescuenta`
 * (ver `queSeDescuentaEnLaProxima`). Una sola lista para la pantalla y el PDF.
 */
export function renglonesDeLaCadena(c: CadenaInformeDto, queSeDescuenta?: string): RenglonCadena[] {
  const r: RenglonCadena[] = [
    { nombre: 'Alquiler del período', importe: c.alquiler, fuerte: false },
  ];
  if (c.enEspera)
    r.push({ nombre: '− El inquilino todavía no pagó', importe: c.enEspera, fuerte: false });
  r.push({ nombre: 'Cobrado', importe: c.cobrado, fuerte: true });
  const descuentos: [string, number][] = [
    ['Honorarios', c.honorarios],
    ['Impuestos y servicios', c.impuestos],
    ['Expensas', c.expensas],
    ['Arreglos', c.arreglos],
    ['Otros descuentos', c.otros],
  ];
  for (const [nombre, v] of descuentos)
    if (v) r.push({ nombre: `− ${nombre}`, importe: v, fuerte: false });
  if (c.reintegros)
    r.push({ nombre: '+ Reintegros a su favor', importe: c.reintegros, fuerte: false });
  r.push({ nombre: 'Neto del período', importe: c.neto, fuerte: true });
  r.push({ nombre: 'Liquidado (transferido)', importe: c.liquidado, fuerte: false });
  r.push({ nombre: 'Pendiente de liquidar', importe: c.pendiente, fuerte: false });
  if (c.aDescontar)
    r.push({
      nombre: 'A descontar en la próxima liquidación',
      importe: c.aDescontar,
      fuerte: false,
      ...(queSeDescuenta ? { detalle: queSeDescuenta } : {}),
    });
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

/** Cómo se lee cada renglón de descuento suelto, en singular: «Arreglo: Plomería Juan…». */
const SINGULAR_CATEGORIA: Record<CategoriaPartida, string> = {
  honorarios: 'Honorarios',
  impuestos: 'Impuesto',
  expensas: 'Expensa',
  arreglos: 'Arreglo',
  otros: 'Otro descuento',
  reintegros: 'Reintegro',
};

/**
 * Regla 98: qué es lo que se le descuenta en la próxima liquidación —los
 * descuentos del período que todavía no entraron en ninguna—, para decirlo
 * al lado de «A descontar en la próxima liquidación»: «Arreglo: Plomería Juan
 * (Cambio de canilla · reclamo 2)». Con el impuesto o la boleta en el detalle.
 */
export function queSeDescuentaEnLaProxima(
  partidas: InformePropietarioDto['partidas'],
  moneda: CadenaInformeDto['moneda'],
): string {
  return partidas
    .filter((p) => p.moneda === moneda && p.categoria !== 'reintegros' && !p.liquidacion)
    .map((p) =>
      p.categoria === 'honorarios'
        ? p.detalle
        : `${SINGULAR_CATEGORIA[p.categoria]}: ${
            // «TGI (Tasa municipal) cuota 9/12» ya dice el nombre; un arreglo no.
            p.detalle.startsWith(p.nombre) ? p.detalle : `${p.nombre} (${p.detalle})`
          }`,
    )
    .join(' · ');
}

/**
 * Si un descuento (o un reintegro) del período ya entró en una liquidación, o
 * va en la próxima (regla 98: «Se descontará en la próxima liquidación»). La
 * misma frase en la pantalla y en el PDF.
 */
export function estadoDePartida(p: InformePropietarioDto['partidas'][number]): string {
  const [hecho, falta] =
    p.categoria === 'reintegros' ? ['Pagado', 'Se pagará'] : ['Descontado', 'Se descontará'];
  if (!p.liquidacion) return `${falta} en la próxima liquidación`;
  const n = String(p.liquidacion.numero).padStart(6, '0');
  const dia = p.liquidacion.fecha.split('-').reverse().join('/');
  return `${hecho} en la liquidación ${n} del ${dia}`;
}
