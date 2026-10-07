import { z } from 'zod';
import {
  BandejaIndexacionDtoSchema,
  DocumentoContratoDtoSchema,
  DocumentoDeContratoDtoSchema,
  UrlArchivoDtoSchema,
  type CambioFirmaManualInput,
  TableroAlquileresDtoSchema,
  TablerosAlquileresDtoSchema,
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
  CandidatoDtoSchema,
  ComprobanteDtoSchema,
  GastosReporteDtoSchema,
  ProveedorDtoSchema,
  ServicioDtoSchema,
  CuentaServicioDtoSchema,
  PlanillaBoletasDtoSchema,
  LoteBoletasResultadoSchema,
  BoletaDtoSchema,
  AdelantadoBoletasDtoSchema,
  PolizaDtoSchema,
  type ServicioInput,
  type CuentaServicioInput,
  type LoteBoletasInput,
  type PolizaInput,
  type ComprobanteInput,
  type MedioCobro,
  type ProveedorInput,
  PlantillaDtoSchema,
  ReclamoDtoSchema,
  ReclamoResumenDtoSchema,
  UsuarioMiniSchema,
  type CambioReclamo,
  type PlantillaMetadatos,
  type ReclamoInput,
  CompletoContratoDtoSchema,
  ConfiguracionAlquileresSchema,
  GarantiaDtoSchema,
  type CargoIngreso,
  type ConfiguracionAlquileres,
  type ExtenderContrato,
  type GarantiaInput,
  ContactoDtoSchema,
  CuentaBancariaDtoSchema,
  EnvioMailDtoSchema,
  PersonaFichaDtoSchema,
  type ContactoInput,
  type CuentaBancariaInput,
  IndicesDtoSchema,
  type FiltroTipoContrato,
  type IndicesQuery,
  EventoDtoSchema,
  type ContratoDatos,
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
import { apiFetch, apiFetchArchivo, apiFetchForm, apiFetchPdf } from './api-client';

/** Cuánto tiene cargado la inmobiliaria en el módulo (GET /alquileres/resumen). */
export async function getResumenAlquileres(accessToken: string) {
  return apiFetch('/alquileres/resumen', ResumenAlquileresSchema, { accessToken });
}

export async function listPersonas(accessToken: string) {
  return apiFetch('/alquileres/personas', z.array(PersonaDtoSchema), { accessToken });
}

export async function crearPersona(accessToken: string, dto: PersonaInput) {
  return apiFetch('/alquileres/personas', PersonaDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function actualizarPersona(accessToken: string, id: string, dto: PersonaInput) {
  return apiFetch(`/alquileres/personas/${id}`, PersonaDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function listPropiedadesAlquiler(accessToken: string) {
  return apiFetch('/alquileres/propiedades', z.array(PropiedadAlquilerDtoSchema), { accessToken });
}

export async function crearPropiedadAlquiler(accessToken: string, dto: PropiedadAlquilerInput) {
  return apiFetch('/alquileres/propiedades', PropiedadAlquilerDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function actualizarPropiedadAlquiler(
  accessToken: string,
  id: string,
  dto: PropiedadAlquilerInput,
) {
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
  return apiFetch('/alquileres/contratos', ContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function actualizarContrato(accessToken: string, id: string, dto: ContratoInput) {
  return apiFetch(`/alquileres/contratos/${id}`, ContratoDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function cambiarEstadoContrato(
  accessToken: string,
  id: string,
  cambio: CambiarEstadoContrato,
) {
  return apiFetch(`/alquileres/contratos/${id}/estado`, ContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: cambio,
  });
}

/** La bandeja «a indexar»: tramos con su propuesta y el estado de los índices. */
export async function getBandejaIndexacion(accessToken: string) {
  return apiFetch('/alquileres/indexaciones', BandejaIndexacionDtoSchema, { accessToken });
}

/** Confirma un tramo. `importe` solo para índices sin fuente (Casa Propia). */
export async function confirmarIndexacion(
  accessToken: string,
  tramoId: string,
  importe: number | null,
) {
  return apiFetch(`/alquileres/indexaciones/${tramoId}/confirmar`, IndexacionConfirmadaDtoSchema, {
    accessToken,
    method: 'POST',
    body: { importe },
  });
}

/** Los conceptos de un mes (`AAAA-MM`). */
export async function listConceptos(accessToken: string, periodo: string) {
  return apiFetch(`/alquileres/conceptos?periodo=${periodo}`, z.array(ConceptoDtoSchema), {
    accessToken,
  });
}

/** Genera el mes. Correrlo de nuevo no duplica: crea solo lo que falte. */
export async function generarPeriodo(accessToken: string, periodo: string) {
  return apiFetch('/alquileres/conceptos/generar', ResultadoGeneracionDtoSchema, {
    accessToken,
    method: 'POST',
    body: { periodo },
  });
}

export async function crearConceptoSuelto(accessToken: string, dto: ConceptoSueltoInput) {
  return apiFetch('/alquileres/conceptos', z.array(ConceptoDtoSchema), {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function anularConcepto(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/conceptos/${id}/anular`, z.object({ anulados: z.number() }), {
    accessToken,
    method: 'POST',
    body: { motivo },
  });
}

/** Lo que debe una persona a una fecha: deudas, punitorios propuestos, reintegros y saldo a favor. */
export async function prepararCobro(
  accessToken: string,
  personaId: string,
  moneda: MonedaAlquiler,
  fecha: string,
) {
  return apiFetch(
    `/alquileres/cobros/preparar?personaId=${personaId}&moneda=${moneda}&fecha=${fecha}`,
    PreparacionCobroDtoSchema,
    { accessToken },
  );
}

export async function registrarCobro(accessToken: string, dto: CobroInput) {
  return apiFetch('/alquileres/cobros', CobroDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function listCobros(accessToken: string, personaId?: string) {
  return apiFetch(
    `/alquileres/cobros${personaId ? `?personaId=${personaId}` : ''}`,
    z.array(CobroResumenDtoSchema),
    { accessToken },
  );
}

export async function anularCobro(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/cobros/${id}/anular`, CobroDtoSchema, {
    accessToken,
    method: 'POST',
    body: { motivo },
  });
}

/** El recibo en PDF (regla 23). */
export async function generarRecibo(accessToken: string, id: string) {
  return apiFetchPdf(`/alquileres/cobros/${id}/recibo`, { accessToken });
}

/** Cuenta corriente y estado de cuenta de una persona (reglas 18 y 24). */
export async function getCuentaCorriente(accessToken: string, personaId: string) {
  return apiFetch(`/alquileres/personas/${personaId}/cuenta`, CuentaCorrienteDtoSchema, {
    accessToken,
  });
}

/** Propietarios con algo para liquidar hoy (regla 31). */
export async function listPendientesLiquidar(accessToken: string) {
  return apiFetch('/alquileres/liquidaciones/pendientes', z.array(PendienteLiquidarDtoSchema), {
    accessToken,
  });
}

/** Lo que entra en la liquidación de un propietario; `excluidos` son los que se dejan para después. */
export async function prepararLiquidacion(
  accessToken: string,
  personaId: string,
  moneda: MonedaAlquiler,
  fecha: string,
  excluidos: string[],
) {
  const fuera = excluidos.length ? `&excluidos=${excluidos.join(',')}` : '';
  return apiFetch(
    `/alquileres/liquidaciones/preparar?personaId=${personaId}&moneda=${moneda}&fecha=${fecha}${fuera}`,
    PreparacionLiquidacionDtoSchema,
    { accessToken },
  );
}

export async function liquidar(accessToken: string, dto: LiquidacionInput) {
  return apiFetch('/alquileres/liquidaciones', LiquidacionDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function listLiquidaciones(accessToken: string, personaId?: string) {
  return apiFetch(
    `/alquileres/liquidaciones${personaId ? `?personaId=${personaId}` : ''}`,
    z.array(LiquidacionResumenDtoSchema),
    { accessToken },
  );
}

export async function anularLiquidacion(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/liquidaciones/${id}/anular`, LiquidacionDtoSchema, {
    accessToken,
    method: 'POST',
    body: { motivo },
  });
}

/** La liquidación en PDF (regla 23). */
export async function generarLiquidacionPdf(accessToken: string, id: string) {
  return apiFetchPdf(`/alquileres/liquidaciones/${id}/pdf`, { accessToken });
}

/** El tablero del módulo (reglas 26 a 32). */
/** Los tres cortes del tablero de una vez: el filtro Todos / Particulares / Comerciales no vuelve a pedir nada. */
export async function getTablerosAlquileres(accessToken: string, anio?: number) {
  return apiFetch(
    `/alquileres/tablero/completo${anio ? `?anio=${anio}` : ''}`,
    TablerosAlquileresDtoSchema,
    { accessToken },
  );
}

export async function getTableroAlquileres(
  accessToken: string,
  anio?: number,
  tipo: FiltroTipoContrato = 'todos',
) {
  const q = new URLSearchParams();
  if (anio) q.set('anio', String(anio));
  if (tipo !== 'todos') q.set('tipo', tipo);
  const qs = q.toString();
  return apiFetch(`/alquileres/tablero${qs ? `?${qs}` : ''}`, TableroAlquileresDtoSchema, {
    accessToken,
  });
}

/** El documento del contrato y su firma (reglas 33 a 36). */
export async function getDocumentoContrato(accessToken: string, contratoId: string) {
  return apiFetch(`/alquileres/contratos/${contratoId}/documento`, DocumentoDeContratoDtoSchema, {
    accessToken,
  });
}

export async function cargarDocumentoContrato(accessToken: string, contratoId: string, file: File) {
  return apiFetchForm(`/alquileres/contratos/${contratoId}/documento`, DocumentoContratoDtoSchema, {
    accessToken,
    file,
  });
}

export async function enviarAFirmar(accessToken: string, documentoId: string) {
  return apiFetch(`/alquileres/documentos/${documentoId}/enviar`, DocumentoContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: {},
  });
}

export async function cambiarFirma(
  accessToken: string,
  documentoId: string,
  cambio: CambioFirmaManualInput,
) {
  return apiFetch(`/alquileres/documentos/${documentoId}/firma`, DocumentoContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: cambio,
  });
}

export async function cargarContratoFirmado(accessToken: string, documentoId: string, file: File) {
  return apiFetchForm(`/alquileres/documentos/${documentoId}/firmado`, DocumentoContratoDtoSchema, {
    accessToken,
    file,
  });
}

/** Link de vida corta al PDF: el bucket es privado. */
export async function urlDocumento(accessToken: string, documentoId: string, firmado: boolean) {
  return apiFetch(
    `/alquileres/documentos/${documentoId}/archivo${firmado ? '?firmado=1' : ''}`,
    UrlArchivoDtoSchema,
    { accessToken },
  );
}

// --- Entrega 11: borrar, anular, historial y a quién se cobra -----------------

const Borrado = z.object({ id: z.string() });

export async function borrarContrato(accessToken: string, id: string) {
  return apiFetch(`/alquileres/contratos/${id}`, Borrado, { accessToken, method: 'DELETE' });
}

export async function anularContrato(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/contratos/${id}/anular`, ContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: { motivo },
  });
}

/** Lo que no toca plata de un contrato vigente. */
export async function actualizarDatosContrato(
  accessToken: string,
  id: string,
  datos: ContratoDatos,
) {
  return apiFetch(`/alquileres/contratos/${id}/datos`, ContratoDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: datos,
  });
}

export async function getHistorialContrato(accessToken: string, id: string) {
  return apiFetch(`/alquileres/contratos/${id}/historial`, z.array(EventoDtoSchema), {
    accessToken,
  });
}

export async function getHistorialPersona(accessToken: string, id: string) {
  return apiFetch(`/alquileres/personas/${id}/historial`, z.array(EventoDtoSchema), {
    accessToken,
  });
}

export async function borrarPersona(accessToken: string, id: string) {
  return apiFetch(`/alquileres/personas/${id}`, Borrado, { accessToken, method: 'DELETE' });
}

export async function borrarPropiedadAlquiler(accessToken: string, id: string) {
  return apiFetch(`/alquileres/propiedades/${id}`, Borrado, { accessToken, method: 'DELETE' });
}

/** Inquilinos con lo que deben, o propietarios con lo que hay para liquidarles. */
export async function listCandidatos(accessToken: string, papel: 'inquilino' | 'propietario') {
  return apiFetch(`/alquileres/candidatos?papel=${papel}`, z.array(CandidatoDtoSchema), {
    accessToken,
  });
}

/** Los valores del ICL (por rango) o del IPC (todos, con variaciones). */
export async function getIndices(accessToken: string, q: Partial<IndicesQuery>) {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  return apiFetch(`/alquileres/indices?${p.toString()}`, IndicesDtoSchema, { accessToken });
}

// --- Entrega 13: la ficha de la persona y el envío por mail -------------------

export async function getFichaPersona(accessToken: string, id: string) {
  return apiFetch(`/alquileres/personas/${id}/ficha`, PersonaFichaDtoSchema, { accessToken });
}

export async function guardarCuentasBancarias(
  accessToken: string,
  id: string,
  cuentas: CuentaBancariaInput[],
) {
  return apiFetch(`/alquileres/personas/${id}/cuentas`, z.array(CuentaBancariaDtoSchema), {
    accessToken,
    method: 'PUT',
    body: { cuentas },
  });
}

export async function guardarContactos(
  accessToken: string,
  id: string,
  contactos: ContactoInput[],
) {
  return apiFetch(`/alquileres/personas/${id}/contactos`, z.array(ContactoDtoSchema), {
    accessToken,
    method: 'PUT',
    body: { contactos },
  });
}

export async function enviarReciboPorMail(accessToken: string, cobroId: string, para: string[]) {
  return apiFetch(`/alquileres/cobros/${cobroId}/enviar`, EnvioMailDtoSchema, {
    accessToken,
    method: 'POST',
    body: { para },
  });
}

export async function enviarLiquidacionPorMail(accessToken: string, id: string, para: string[]) {
  return apiFetch(`/alquileres/liquidaciones/${id}/enviar`, EnvioMailDtoSchema, {
    accessToken,
    method: 'POST',
    body: { para },
  });
}

// --- Entrega 14: contrato completo y configuración -----------------------------

export async function getConfiguracionAlquileres(accessToken: string) {
  return apiFetch('/alquileres/configuracion', ConfiguracionAlquileresSchema, { accessToken });
}

export async function guardarConfiguracionAlquileres(
  accessToken: string,
  dto: ConfiguracionAlquileres,
) {
  return apiFetch('/alquileres/configuracion', ConfiguracionAlquileresSchema, {
    accessToken,
    method: 'PUT',
    body: dto,
  });
}

export async function getContratoCompleto(accessToken: string, id: string) {
  return apiFetch(`/alquileres/contratos/${id}/completo`, CompletoContratoDtoSchema, {
    accessToken,
  });
}

export async function cargarCargosIngreso(accessToken: string, id: string, cargos: CargoIngreso[]) {
  return apiFetch(`/alquileres/contratos/${id}/cargos-ingreso`, CompletoContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: { cargos },
  });
}

export async function entregarDeposito(accessToken: string, id: string) {
  return apiFetch(`/alquileres/contratos/${id}/deposito/entregar`, CompletoContratoDtoSchema, {
    accessToken,
    method: 'POST',
  });
}

export async function devolverDeposito(accessToken: string, id: string, fecha: string) {
  return apiFetch(`/alquileres/contratos/${id}/deposito/devolver`, CompletoContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: { fecha },
  });
}

export async function guardarGarantias(
  accessToken: string,
  id: string,
  garantias: GarantiaInput[],
) {
  return apiFetch(`/alquileres/contratos/${id}/garantias`, z.array(GarantiaDtoSchema), {
    accessToken,
    method: 'PUT',
    body: { garantias },
  });
}

export async function extenderContrato(accessToken: string, id: string, dto: ExtenderContrato) {
  return apiFetch(`/alquileres/contratos/${id}/extender`, ContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

// --- Entrega 15: plantillas de contrato y reclamos -----------------------------

export async function listPlantillas(accessToken: string) {
  return apiFetch('/alquileres/plantillas', z.array(PlantillaDtoSchema), { accessToken });
}

/** Sube una plantilla en Word. Si un marcador está mal, el error los nombra a todos. */
export async function subirPlantilla(accessToken: string, meta: PlantillaMetadatos, file: File) {
  return apiFetchForm('/alquileres/plantillas', PlantillaDtoSchema, {
    accessToken,
    file,
    campos: { nombre: meta.nombre, tipoContrato: meta.tipoContrato ?? '' },
  });
}

export async function reemplazarArchivoPlantilla(accessToken: string, id: string, file: File) {
  return apiFetchForm(`/alquileres/plantillas/${id}/archivo`, PlantillaDtoSchema, {
    accessToken,
    file,
    method: 'PUT',
  });
}

/** Nombre y para qué contratos sirve, sin tocar el Word. */
export async function editarPlantilla(accessToken: string, id: string, meta: PlantillaMetadatos) {
  return apiFetch(`/alquileres/plantillas/${id}`, PlantillaDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: meta,
  });
}

export async function borrarPlantilla(accessToken: string, id: string) {
  return apiFetch(`/alquileres/plantillas/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

/** El Word de la plantilla, tal como se subió. */
export async function descargarPlantilla(accessToken: string, id: string) {
  return apiFetchArchivo(`/alquileres/plantillas/${id}/archivo`, {
    accessToken,
    nombrePorDefecto: 'Plantilla.docx',
  });
}

/** El Word de ejemplo con todos los marcadores. */
export async function descargarEjemploPlantilla(accessToken: string) {
  return apiFetchArchivo('/alquileres/plantillas/ejemplo', {
    accessToken,
    nombrePorDefecto: 'Plantilla de contrato - ejemplo.docx',
  });
}

/** El contrato en Word, completo con sus datos desde una plantilla. */
export async function generarDesdePlantilla(
  accessToken: string,
  contratoId: string,
  plantillaId: string,
) {
  return apiFetchArchivo(`/alquileres/contratos/${contratoId}/generar-desde-plantilla`, {
    accessToken,
    method: 'POST',
    body: { plantillaId },
    nombrePorDefecto: 'Contrato.docx',
  });
}

export async function listReclamos(
  accessToken: string,
  q: { estado?: 'abiertos' | 'todos'; contratoId?: string; personaId?: string } = {},
) {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  return apiFetch(
    `/alquileres/reclamos${p.toString() ? `?${p}` : ''}`,
    z.array(ReclamoResumenDtoSchema),
    { accessToken },
  );
}

export async function getReclamo(accessToken: string, id: string) {
  return apiFetch(`/alquileres/reclamos/${id}`, ReclamoDtoSchema, { accessToken });
}

export async function crearReclamo(accessToken: string, dto: ReclamoInput) {
  return apiFetch('/alquileres/reclamos', ReclamoDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function cambiarReclamo(
  accessToken: string,
  id: string,
  cambio: Partial<CambioReclamo>,
) {
  return apiFetch(`/alquileres/reclamos/${id}`, ReclamoDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: cambio,
  });
}

export async function listUsuariosAsignables(accessToken: string) {
  return apiFetch('/alquileres/reclamos/usuarios', z.array(UsuarioMiniSchema), { accessToken });
}

// --- Entrega 18: proveedores y comprobantes ------------------------------------

export async function listProveedores(accessToken: string) {
  return apiFetch('/alquileres/proveedores', z.array(ProveedorDtoSchema), { accessToken });
}

export async function guardarProveedor(
  accessToken: string,
  id: string | null,
  dto: ProveedorInput,
) {
  return id
    ? apiFetch(`/alquileres/proveedores/${id}`, z.object({ id: z.string() }), {
        accessToken,
        method: 'PATCH',
        body: dto,
      })
    : apiFetch('/alquileres/proveedores', z.object({ id: z.string() }), {
        accessToken,
        method: 'POST',
        body: dto,
      });
}

export async function borrarProveedor(accessToken: string, id: string) {
  return apiFetch(`/alquileres/proveedores/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

export async function listComprobantes(
  accessToken: string,
  q: { estado?: 'pendientes' | 'todos'; proveedorId?: string; contratoId?: string } = {},
) {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  return apiFetch(
    `/alquileres/comprobantes${p.toString() ? `?${p}` : ''}`,
    z.array(ComprobanteDtoSchema),
    { accessToken },
  );
}

export async function getReporteGastos(accessToken: string, anio: number) {
  return apiFetch(`/alquileres/comprobantes/reporte?anio=${anio}`, GastosReporteDtoSchema, {
    accessToken,
  });
}

export async function cargarComprobante(accessToken: string, dto: ComprobanteInput) {
  return apiFetch('/alquileres/comprobantes', ComprobanteDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function pagarComprobante(
  accessToken: string,
  id: string,
  fecha: string,
  medio: MedioCobro,
) {
  return apiFetch(`/alquileres/comprobantes/${id}/pagar`, ComprobanteDtoSchema, {
    accessToken,
    method: 'POST',
    body: { fecha, medio },
  });
}

export async function anularComprobante(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/comprobantes/${id}/anular`, ComprobanteDtoSchema, {
    accessToken,
    method: 'POST',
    body: { motivo },
  });
}

// --- Impuestos, servicios y pólizas (entrega 19) ---

export async function listServicios(accessToken: string) {
  return apiFetch('/alquileres/servicios', z.array(ServicioDtoSchema), { accessToken });
}

export async function cargarServiciosSugeridos(accessToken: string) {
  return apiFetch('/alquileres/servicios/sugeridos', z.object({ creados: z.number() }), {
    accessToken,
    method: 'POST',
    body: {},
  });
}

export async function guardarServicio(accessToken: string, id: string | null, dto: ServicioInput) {
  return id
    ? apiFetch(`/alquileres/servicios/${id}`, z.object({ id: z.string() }), {
        accessToken,
        method: 'PATCH',
        body: dto,
      })
    : apiFetch('/alquileres/servicios', z.object({ id: z.string() }), {
        accessToken,
        method: 'POST',
        body: dto,
      });
}

export async function borrarServicio(accessToken: string, id: string) {
  return apiFetch(`/alquileres/servicios/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

export async function listCuentasServicio(accessToken: string, propiedadId?: string) {
  return apiFetch(
    `/alquileres/cuentas-servicio${propiedadId ? `?propiedadId=${propiedadId}` : ''}`,
    z.array(CuentaServicioDtoSchema),
    { accessToken },
  );
}

export async function guardarCuentaServicio(
  accessToken: string,
  id: string | null,
  dto: CuentaServicioInput,
) {
  return id
    ? apiFetch(`/alquileres/cuentas-servicio/${id}`, z.object({ id: z.string() }), {
        accessToken,
        method: 'PATCH',
        body: dto,
      })
    : apiFetch('/alquileres/cuentas-servicio', z.object({ id: z.string() }), {
        accessToken,
        method: 'POST',
        body: dto,
      });
}

export async function borrarCuentaServicio(accessToken: string, id: string) {
  return apiFetch(`/alquileres/cuentas-servicio/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

export async function getPlanillaBoletas(accessToken: string, periodo: string) {
  return apiFetch(`/alquileres/boletas/planilla?periodo=${periodo}`, PlanillaBoletasDtoSchema, {
    accessToken,
  });
}

export async function cargarLoteBoletas(accessToken: string, dto: LoteBoletasInput) {
  return apiFetch('/alquileres/boletas/lote', LoteBoletasResultadoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function listBoletas(
  accessToken: string,
  q: { periodo?: string; ver?: 'mes' | 'control'; contratoId?: string },
) {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  return apiFetch(`/alquileres/boletas${p.toString() ? `?${p}` : ''}`, z.array(BoletaDtoSchema), {
    accessToken,
  });
}

/** Regla 50: lo que la inmobiliaria pagó de boletas y falta recuperar, por moneda. */
export async function getAdelantadoBoletas(accessToken: string) {
  return apiFetch('/alquileres/boletas/adelantado', AdelantadoBoletasDtoSchema, { accessToken });
}

export async function pagarBoleta(
  accessToken: string,
  id: string,
  fecha: string,
  medio: MedioCobro,
) {
  return apiFetch(`/alquileres/boletas/${id}/pagar`, BoletaDtoSchema, {
    accessToken,
    method: 'POST',
    body: { fecha, medio },
  });
}

export async function anularBoleta(accessToken: string, id: string, motivo: string) {
  return apiFetch(`/alquileres/boletas/${id}/anular`, BoletaDtoSchema, {
    accessToken,
    method: 'POST',
    body: { motivo },
  });
}

export async function listPolizas(accessToken: string, contratoId?: string) {
  return apiFetch(
    `/alquileres/polizas${contratoId ? `?contratoId=${contratoId}` : ''}`,
    z.array(PolizaDtoSchema),
    { accessToken },
  );
}

export async function crearPoliza(accessToken: string, dto: PolizaInput) {
  return apiFetch('/alquileres/polizas', z.object({ id: z.string() }), {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function anularPoliza(accessToken: string, id: string, motivo: string) {
  return apiFetch(
    `/alquileres/polizas/${id}/anular`,
    z.object({ id: z.string(), cuotasAnuladas: z.number() }),
    { accessToken, method: 'POST', body: { motivo } },
  );
}
