import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import {
  AuthPrincipalSchema,
  CambioEstadoReservaSchema,
  CobrarSenaSchema,
  ESTADOS_QUE_RETIENEN_LA_SENA,
  ESTADOS_RESERVA_ABIERTOS,
  ReservaDtoSchema,
  ReservaInputSchema,
  ReservaResumenDtoSchema,
  BandejaIndexacionDtoSchema,
  ConceptoDtoSchema,
  ConfirmarIndexacionSchema,
  IndexacionConfirmadaDtoSchema,
  VistaPreviaDiferenciasDtoSchema,
  CobroResumenDtoSchema,
  CompletoContratoDtoSchema,
  CuentaCorrienteDtoSchema,
  InformePropietarioDtoSchema,
  InformePropietariosDtoSchema,
  LiquidacionResumenDtoSchema,
  PersonaFichaDtoSchema,
  ConfiguracionAlquileresSchema,
  ContratoDtoSchema,
  ContratoResumenDtoSchema,
  CorreccionAplicadaDtoSchema,
  CorreccionTramoDtoSchema,
  CorregirImporteTramoSchema,
  DocumentoDeContratoDtoSchema,
  EventoDtoSchema,
  IndicadorSchema,
  InventarioDtoSchema,
  PersonaDtoSchema,
  PlantillaDtoSchema,
  PolizaDtoSchema,
  PropiedadAlquilerDtoSchema,
  ReclamoResumenDtoSchema,
  ReservaDelContratoDtoSchema,
  ResumenAlquileresSchema,
  RespuestaTablerosAlquileresSchema,
  TablerosAlquileresDtoSchema,
  compactarTableros,
} from '@vacker/types';
import { IDS, PRINCIPAL } from './datos/comunes';
import type { Estado } from './estado';
import {
  COMPLETO,
  CONFIGURACION,
  CONTRATO_1,
  CONTRATOS_RESUMEN,
  CORRECCION_TRAMO_2,
  PERSONAS,
  PROPIEDADES,
} from './datos/contratos';
import { BANDEJA, DIFERENCIAS_ALT3, TRAMOS, conceptosDe } from './datos/indexacion';
import {
  cuentaCorriente,
  fichaPersona,
  informePropietario,
  informePropietarios,
} from './datos/informe';
import { ID_RESERVA_NUEVA, resumenDe, type Reserva } from './datos/reservas';
import { detalleDelTablero, tableros } from './datos/tablero';

export interface Contexto {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  /** Lo que la prueba que hace el pedido cambió hasta ahora (ver `estado.ts`). */
  estado: Estado;
}

/** Una respuesta que no es un 200 con JSON (un error, un PDF). */
export interface RespuestaSimulada {
  simulada: true;
  status: number;
  cuerpo: unknown;
  headers?: Record<string, string>;
}

export interface Ruta {
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  patron: string;
  /** El schema de la respuesta en la app: lo que sale se valida contra él. */
  schema?: ZodTypeAny;
  responder: (c: Contexto) => unknown;
}

/** Un PDF mínimo pero válido: el visor del navegador lo abre. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);
function pdf(nombre: string): RespuestaSimulada {
  return {
    simulada: true,
    status: 200,
    cuerpo: PDF,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nombre)}.pdf"`,
    },
  };
}

function reservaDe(reservas: Reserva[], id: string): Reserva | RespuestaSimulada {
  return reservas.find((r) => r.id === id) ?? errorApi(404, 'NOT_FOUND', 'No existe la reserva.');
}

export function errorApi(status: number, code: string, message: string): RespuestaSimulada {
  return { simulada: true, status, cuerpo: { error: { code, message } } };
}

export const RUTAS: Ruta[] = [
  { metodo: 'GET', patron: '/me', schema: AuthPrincipalSchema, responder: () => PRINCIPAL },

  // --- Dashboard de Alquileres ---
  {
    metodo: 'GET',
    patron: '/alquileres/resumen',
    schema: ResumenAlquileresSchema,
    responder: () => ({ contratos: 2, contratosVigentes: 2, personas: 4, propiedades: 2 }),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/tablero/completo',
    // Como la API: compacto si se lo pide (regla 175), completo si no.
    schema: RespuestaTablerosAlquileresSchema,
    responder: ({ query }) =>
      query.get('formato') === 'compacto'
        ? compactarTableros(TablerosAlquileresDtoSchema.parse(tableros()))
        : tableros(),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/tablero/detalle',
    schema: IndicadorSchema,
    responder: ({ query }) => detalleDelTablero(query.get('indicador') ?? ''),
  },

  // --- Personas, propiedades y configuración ---
  {
    metodo: 'GET',
    patron: '/alquileres/personas',
    schema: z.array(PersonaDtoSchema),
    responder: () => PERSONAS,
  },
  {
    metodo: 'GET',
    patron: '/alquileres/propiedades',
    schema: z.array(PropiedadAlquilerDtoSchema),
    responder: () => PROPIEDADES,
  },
  {
    metodo: 'GET',
    patron: '/alquileres/configuracion',
    schema: ConfiguracionAlquileresSchema,
    responder: () => CONFIGURACION,
  },
  {
    metodo: 'PUT',
    patron: '/alquileres/configuracion',
    schema: ConfiguracionAlquileresSchema,
    // Devuelve lo que llegó, validado como lo haría la API.
    responder: ({ body }) => ConfiguracionAlquileresSchema.parse(body),
  },

  // --- Contratos ---
  {
    metodo: 'GET',
    patron: '/alquileres/contratos',
    schema: z.array(ContratoResumenDtoSchema),
    responder: () => CONTRATOS_RESUMEN,
  },
  {
    metodo: 'POST',
    patron: '/alquileres/contratos',
    schema: ContratoDtoSchema,
    responder: () => CONTRATO_1,
  },
  {
    metodo: 'GET',
    patron: '/alquileres/contratos/:id',
    schema: ContratoDtoSchema,
    responder: ({ params }) =>
      params.id === IDS.contrato
        ? CONTRATO_1
        : errorApi(404, 'NOT_FOUND', 'No existe el contrato.'),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/contratos/:id/documento',
    schema: DocumentoDeContratoDtoSchema,
    responder: () => ({ documento: null }),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/contratos/:id/historial',
    schema: z.array(EventoDtoSchema),
    responder: () => [],
  },
  {
    metodo: 'GET',
    patron: '/alquileres/contratos/:id/completo',
    schema: CompletoContratoDtoSchema,
    responder: () => COMPLETO,
  },
  {
    metodo: 'GET',
    patron: '/alquileres/contratos/:id/inventario',
    schema: InventarioDtoSchema,
    responder: () => ({ items: [], observaciones: null, editable: true }),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/reservas/del-contrato/:id',
    schema: ReservaDelContratoDtoSchema,
    responder: () => ({ reserva: null }),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/plantillas',
    schema: z.array(PlantillaDtoSchema),
    responder: () => [],
  },
  {
    metodo: 'GET',
    patron: '/alquileres/reclamos',
    schema: z.array(ReclamoResumenDtoSchema),
    responder: () => [],
  },
  {
    metodo: 'GET',
    patron: '/alquileres/polizas',
    schema: z.array(PolizaDtoSchema),
    responder: () => [],
  },
  {
    metodo: 'GET',
    patron: '/alquileres/contratos/:id/tramos/:numero/correccion',
    schema: CorreccionTramoDtoSchema,
    responder: () => CORRECCION_TRAMO_2,
  },
  {
    metodo: 'POST',
    patron: '/alquileres/contratos/:id/tramos/:numero/corregir',
    schema: CorreccionAplicadaDtoSchema,
    responder: ({ body }) => {
      const dto = CorregirImporteTramoSchema.parse(body);
      return {
        numero: 2,
        importeAnterior: 980_000,
        importe: dto.importe,
        desde: dto.desde,
        regenerados: ['2026-10'],
        quedan: [
          { periodo: '2026-07', estado: 'cobrado' },
          { periodo: '2026-08', estado: 'cobrado' },
          { periodo: '2026-09', estado: 'liquidado' },
        ],
      };
    },
  },

  // --- A indexar y conceptos ---
  {
    metodo: 'GET',
    patron: '/alquileres/indexaciones',
    schema: BandejaIndexacionDtoSchema,
    responder: () => BANDEJA,
  },
  {
    metodo: 'GET',
    patron: '/alquileres/indexaciones/:tramoId/diferencias',
    schema: VistaPreviaDiferenciasDtoSchema,
    responder: ({ params }) => ({
      diferencias: params.tramoId === IDS.tramo3 ? DIFERENCIAS_ALT3 : null,
    }),
  },
  {
    metodo: 'POST',
    patron: '/alquileres/indexaciones/:tramoId/confirmar',
    schema: IndexacionConfirmadaDtoSchema,
    responder: ({ params, body }) => {
      ConfirmarIndexacionSchema.parse(body);
      const t = TRAMOS.find((x) => x.tramoId === params.tramoId);
      if (!t || t.importePropuesto == null) return errorApi(409, 'CONFLICT', 'Falta el índice.');
      return {
        tramoId: t.tramoId,
        numero: t.numero,
        importe: t.importePropuesto,
        diferencias: params.tramoId === IDS.tramo3 ? DIFERENCIAS_ALT3 : null,
      };
    },
  },
  {
    metodo: 'GET',
    patron: '/alquileres/conceptos',
    schema: z.array(ConceptoDtoSchema),
    responder: ({ query }) => conceptosDe(query.get('periodo') ?? ''),
  },

  // --- Reservas (reglas 153 a 172). Lo que cambian queda en el escenario de la prueba ---
  {
    metodo: 'GET',
    patron: '/alquileres/reservas',
    schema: z.array(ReservaResumenDtoSchema),
    responder: ({ query, estado }) => {
      const filtro = query.get('estado') ?? 'abiertas';
      return estado.reservas
        .filter((r) =>
          filtro === 'todas'
            ? true
            : filtro === 'abiertas'
              ? (ESTADOS_RESERVA_ABIERTOS as readonly string[]).includes(r.estado)
              : r.estado === filtro,
        )
        .map(resumenDe);
    },
  },
  {
    metodo: 'POST',
    patron: '/alquileres/reservas',
    schema: ReservaDtoSchema,
    responder: ({ body, estado }) => {
      const dto = ReservaInputSchema.parse(body);
      const nombre = (id: string) => PERSONAS.find((p) => p.id === id)?.nombre ?? 'Sin nombre';
      const prop = PROPIEDADES.find((p) => p.id === dto.propiedadId)!;
      const nueva: Reserva = {
        id: ID_RESERVA_NUEVA,
        numero: 8,
        estado: 'reservada',
        tipo: dto.tipo,
        fecha: dto.fecha,
        vence: dto.vence,
        propiedad: {
          id: prop.id,
          direccion: prop.direccion,
          unidad: prop.unidad,
          ciudad: prop.ciudad,
        },
        interesados: dto.partes
          .filter((p) => p.papel === 'inquilino')
          .map((p) => ({ id: p.personaId, nombre: nombre(p.personaId) })),
        sena: dto.senaImporte
          ? {
              importe: dto.senaImporte,
              moneda: dto.senaMoneda ?? 'ARS',
              recibida: false,
              recibidaEl: null,
              medio: null,
              recibo: null,
            }
          : null,
        contrato: null,
        partes: dto.partes.map((p) => ({ ...p, nombre: nombre(p.personaId) })),
        moneda: dto.moneda,
        alquilerInicial: dto.alquilerInicial ?? null,
        inicio: dto.inicio ?? null,
        duracionMeses: dto.duracionMeses ?? null,
        ajuste: dto.ajuste,
        indice: dto.indice ?? null,
        periodicidadMeses: dto.periodicidadMeses ?? null,
        depositoImporte: dto.depositoImporte ?? null,
        depositoMoneda: dto.depositoMoneda ?? null,
        obs: dto.obs ?? null,
        motivo: null,
        senaRetenida: null,
        registrado: { en: new Date().toISOString(), por: 'Persona de Prueba' },
        garantias: [],
        historial: [],
      };
      estado.reservas.unshift(nueva);
      return nueva;
    },
  },
  {
    metodo: 'GET',
    patron: '/alquileres/reservas/:id',
    schema: ReservaDtoSchema,
    responder: ({ params, estado }) => reservaDe(estado.reservas, params.id!),
  },
  {
    metodo: 'POST',
    patron: '/alquileres/reservas/:id/sena',
    schema: ReservaDtoSchema,
    responder: ({ params, body, estado }) => {
      const r = reservaDe(estado.reservas, params.id!);
      if ('simulada' in r) return r;
      const dto = CobrarSenaSchema.parse(body);
      r.sena = {
        ...r.sena!,
        recibida: true,
        recibidaEl: dto.fecha,
        medio: dto.medio,
        recibo: { id: '0e2e0000-0000-4000-8000-00000000f124', numero: 124 },
      };
      return r;
    },
  },
  {
    metodo: 'POST',
    patron: '/alquileres/reservas/:id/estado',
    schema: ReservaDtoSchema,
    responder: ({ params, body, estado }) => {
      const r = reservaDe(estado.reservas, params.id!);
      if ('simulada' in r) return r;
      const dto = CambioEstadoReservaSchema.parse(body);
      r.estado = dto.estado;
      if ('motivo' in dto && dto.motivo) r.motivo = dto.motivo;
      // Regla 171: si se cae con la seña cobrada, se le entrega al propietario.
      if (
        (ESTADOS_QUE_RETIENEN_LA_SENA as readonly string[]).includes(dto.estado) &&
        r.sena?.recibida
      )
        r.senaRetenida = r.sena.importe;
      return r;
    },
  },
  {
    metodo: 'POST',
    patron: '/alquileres/reservas/:id/convertir',
    schema: ContratoDtoSchema,
    responder: ({ params, estado }) => {
      const r = reservaDe(estado.reservas, params.id!);
      if ('simulada' in r) return r;
      r.estado = 'convertida';
      r.contrato = { id: IDS.contrato, codigo: 'ALT-0001' };
      return CONTRATO_1;
    },
  },
  {
    metodo: 'POST',
    patron: '/alquileres/cobros/:id/recibo',
    responder: () => pdf('Recibo 000124'),
  },

  // --- Informe de propietarios y la ficha de la persona (reglas 83 a 98) ---
  {
    metodo: 'GET',
    patron: '/alquileres/informes/propietarios',
    schema: InformePropietariosDtoSchema,
    responder: ({ query }) =>
      informePropietarios(query.get('desde') ?? '2026-09', query.get('hasta') ?? '2026-09'),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/informes/propietarios/:id',
    schema: InformePropietarioDtoSchema,
    responder: ({ query }) =>
      informePropietario(query.get('desde') ?? '2026-09', query.get('hasta') ?? '2026-09'),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/personas/:id/ficha',
    schema: PersonaFichaDtoSchema,
    responder: ({ params }) => fichaPersona(params.id!),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/personas/:id/cuenta',
    schema: CuentaCorrienteDtoSchema,
    responder: ({ params }) => cuentaCorriente(params.id!),
  },
  {
    metodo: 'GET',
    patron: '/alquileres/personas/:id/historial',
    schema: z.array(EventoDtoSchema),
    responder: () => [],
  },
  {
    metodo: 'GET',
    patron: '/alquileres/cobros',
    schema: z.array(CobroResumenDtoSchema),
    responder: () => [],
  },
  {
    metodo: 'GET',
    patron: '/alquileres/liquidaciones',
    schema: z.array(LiquidacionResumenDtoSchema),
    responder: () => [],
  },
];
