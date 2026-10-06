import { z } from 'zod';
import {
  BandejaIndexacionDtoSchema,
  DocumentoContratoDtoSchema,
  DocumentoDeContratoDtoSchema,
  UrlArchivoDtoSchema,
  type CambioFirmaManualInput,
  TableroAlquileresDtoSchema,
  LiquidacionDtoSchema,
  LiquidacionResumenDtoSchema,
  PendienteLiquidarDtoSchema,
  PreparacionLiquidacionDtoSchema,
  type LiquidacionInput,
  CobroDtoSchema,
  CobroResumenDtoSchema,
  CuentaCorrienteDtoSchema,
  PreparacionCobroDtoSchema,
  type CobroInput,
  type MonedaAlquiler,
  ConceptoDtoSchema,
  ResultadoGeneracionDtoSchema,
  type ConceptoSueltoInput,
  ContratoDtoSchema,
  IndexacionConfirmadaDtoSchema,
  ContratoResumenDtoSchema,
  type CambiarEstadoContrato,
  type ContratoInput,
  PersonaDtoSchema,
  PropiedadAlquilerDtoSchema,
  ResumenAlquileresSchema,
  type PersonaInput,
  type PropiedadAlquilerInput,
} from '@vacker/types';
import { apiFetch, apiFetchForm, apiFetchPdf } from './api-client';

/** Cuánto tiene cargado la inmobiliaria en el módulo (GET /alquileres/resumen). */
export async function getResumenAlquileres(accessToken: string) {
  return apiFetch('/alquileres/resumen', ResumenAlquileresSchema, { accessToken });
}

export async function listPersonas(accessToken: string) {
  return apiFetch('/alquileres/personas', z.array(PersonaDtoSchema), { accessToken });
}

export async function crearPersona(accessToken: string, dto: PersonaInput) {
  return apiFetch('/alquileres/personas', PersonaDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function actualizarPersona(accessToken: string, id: string, dto: PersonaInput) {
  return apiFetch(`/alquileres/personas/${id}`, PersonaDtoSchema, { accessToken, method: 'PATCH', body: dto });
}

export async function listPropiedadesAlquiler(accessToken: string) {
  return apiFetch('/alquileres/propiedades', z.array(PropiedadAlquilerDtoSchema), { accessToken });
}

export async function crearPropiedadAlquiler(accessToken: string, dto: PropiedadAlquilerInput) {
  return apiFetch('/alquileres/propiedades', PropiedadAlquilerDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function actualizarPropiedadAlquiler(accessToken: string, id: string, dto: PropiedadAlquilerInput) {
  return apiFetch(`/alquileres/propiedades/${id}`, PropiedadAlquilerDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function listContratos(accessToken: string) {
  return apiFetch('/alquileres/contratos', z.array(ContratoResumenDtoSchema), { accessToken });
}

export async function getContrato(accessToken: string, id: string) {
  return apiFetch(`/alquileres/contratos/${id}`, ContratoDtoSchema, { accessToken });
}

export async function crearContrato(accessToken: string, dto: ContratoInput) {
  return apiFetch('/alquileres/contratos', ContratoDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function actualizarContrato(accessToken: string, id: string, dto: ContratoInput) {
  return apiFetch(`/alquileres/contratos/${id}`, ContratoDtoSchema, { accessToken, method: 'PATCH', body: dto });
}

export async function cambiarEstadoContrato(accessToken: string, id: string, cambio: CambiarEstadoContrato) {
  return apiFetch(`/alquileres/contratos/${id}/estado`, ContratoDtoSchema, { accessToken, method: 'POST', body: cambio });
}

/** La bandeja «a indexar»: tramos con su propuesta y el estado de los índices. */
export async function getBandejaIndexacion(accessToken: string) {
  return apiFetch('/alquileres/indexaciones', BandejaIndexacionDtoSchema, { accessToken });
}

/** Confirma un tramo. `importe` solo para índices sin fuente (Casa Propia). */
export async function confirmarIndexacion(accessToken: string, tramoId: string, importe: number | null) {
  return apiFetch(`/alquileres/indexaciones/${tramoId}/confirmar`, IndexacionConfirmadaDtoSchema, {
    accessToken,
    method: 'POST',
    body: { importe },
  });
}

/** Los conceptos de un mes (`AAAA-MM`). */
export async function listConceptos(accessToken: string, periodo: string) {
  return apiFetch(`/alquileres/conceptos?periodo=${periodo}`, z.array(ConceptoDtoSchema), { accessToken });
}

/** Genera el mes. Correrlo de nuevo no duplica: crea solo lo que falte. */
export async function generarPeriodo(accessToken: string, periodo: string) {
  return apiFetch('/alquileres/conceptos/generar', ResultadoGeneracionDtoSchema, { accessToken, method: 'POST', body: { periodo } });
}

export async function crearConceptoSuelto(accessToken: string, dto: ConceptoSueltoInput) {
  return apiFetch('/alquileres/conceptos', z.array(ConceptoDtoSchema), { accessToken, method: 'POST', body: dto });
}

export async function anularConcepto(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/conceptos/${id}/anular`, z.object({ anulados: z.number() }), { accessToken, method: 'POST', body: { motivo } });
}

/** Lo que debe una persona a una fecha: deudas, punitorios propuestos, reintegros y saldo a favor. */
export async function prepararCobro(accessToken: string, personaId: string, moneda: MonedaAlquiler, fecha: string) {
  return apiFetch(`/alquileres/cobros/preparar?personaId=${personaId}&moneda=${moneda}&fecha=${fecha}`, PreparacionCobroDtoSchema, { accessToken });
}

export async function registrarCobro(accessToken: string, dto: CobroInput) {
  return apiFetch('/alquileres/cobros', CobroDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function listCobros(accessToken: string, personaId?: string) {
  return apiFetch(`/alquileres/cobros${personaId ? `?personaId=${personaId}` : ''}`, z.array(CobroResumenDtoSchema), { accessToken });
}

export async function anularCobro(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/cobros/${id}/anular`, CobroDtoSchema, { accessToken, method: 'POST', body: { motivo } });
}

/** El recibo en PDF (regla 23). */
export async function generarRecibo(accessToken: string, id: string) {
  return apiFetchPdf(`/alquileres/cobros/${id}/recibo`, { accessToken });
}

/** Cuenta corriente y estado de cuenta de una persona (reglas 18 y 24). */
export async function getCuentaCorriente(accessToken: string, personaId: string) {
  return apiFetch(`/alquileres/personas/${personaId}/cuenta`, CuentaCorrienteDtoSchema, { accessToken });
}

/** Propietarios con algo para liquidar hoy (regla 31). */
export async function listPendientesLiquidar(accessToken: string) {
  return apiFetch('/alquileres/liquidaciones/pendientes', z.array(PendienteLiquidarDtoSchema), { accessToken });
}

/** Lo que entra en la liquidación de un propietario; `excluidos` son los que se dejan para después. */
export async function prepararLiquidacion(accessToken: string, personaId: string, moneda: MonedaAlquiler, fecha: string, excluidos: string[]) {
  const fuera = excluidos.length ? `&excluidos=${excluidos.join(',')}` : '';
  return apiFetch(`/alquileres/liquidaciones/preparar?personaId=${personaId}&moneda=${moneda}&fecha=${fecha}${fuera}`, PreparacionLiquidacionDtoSchema, { accessToken });
}

export async function liquidar(accessToken: string, dto: LiquidacionInput) {
  return apiFetch('/alquileres/liquidaciones', LiquidacionDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function listLiquidaciones(accessToken: string, personaId?: string) {
  return apiFetch(`/alquileres/liquidaciones${personaId ? `?personaId=${personaId}` : ''}`, z.array(LiquidacionResumenDtoSchema), { accessToken });
}

export async function anularLiquidacion(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/liquidaciones/${id}/anular`, LiquidacionDtoSchema, { accessToken, method: 'POST', body: { motivo } });
}

/** La liquidación en PDF (regla 23). */
export async function generarLiquidacionPdf(accessToken: string, id: string) {
  return apiFetchPdf(`/alquileres/liquidaciones/${id}/pdf`, { accessToken });
}

/** El tablero del módulo (reglas 26 a 32). */
export async function getTableroAlquileres(accessToken: string, anio?: number) {
  return apiFetch(`/alquileres/tablero${anio ? `?anio=${anio}` : ''}`, TableroAlquileresDtoSchema, { accessToken });
}

/** El documento del contrato y su firma (reglas 33 a 36). */
export async function getDocumentoContrato(accessToken: string, contratoId: string) {
  return apiFetch(`/alquileres/contratos/${contratoId}/documento`, DocumentoDeContratoDtoSchema, { accessToken });
}

export async function cargarDocumentoContrato(accessToken: string, contratoId: string, file: File) {
  return apiFetchForm(`/alquileres/contratos/${contratoId}/documento`, DocumentoContratoDtoSchema, { accessToken, file });
}

export async function enviarAFirmar(accessToken: string, documentoId: string) {
  return apiFetch(`/alquileres/documentos/${documentoId}/enviar`, DocumentoContratoDtoSchema, { accessToken, method: 'POST', body: {} });
}

export async function cambiarFirma(accessToken: string, documentoId: string, cambio: CambioFirmaManualInput) {
  return apiFetch(`/alquileres/documentos/${documentoId}/firma`, DocumentoContratoDtoSchema, { accessToken, method: 'POST', body: cambio });
}

export async function cargarContratoFirmado(accessToken: string, documentoId: string, file: File) {
  return apiFetchForm(`/alquileres/documentos/${documentoId}/firmado`, DocumentoContratoDtoSchema, { accessToken, file });
}

/** Link de vida corta al PDF: el bucket es privado. */
export async function urlDocumento(accessToken: string, documentoId: string, firmado: boolean) {
  return apiFetch(`/alquileres/documentos/${documentoId}/archivo${firmado ? '?firmado=1' : ''}`, UrlArchivoDtoSchema, { accessToken });
}
