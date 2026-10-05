import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * Las filas de prueba del test de aislamiento, una por cada tabla de negocio.
 *
 * Están acá y no en el spec para que el spec se lea: lo que importa ahí es la
 * comprobación, no cómo se arma un `protocolo_accion` válido.
 *
 * **Cada tabla del esquema tiene que aparecer en `TABLAS`.** El test de la
 * guardia (`rls-habilitada.e2e-spec.ts`) verifica que la lista no se quede
 * atrás: si mañana entra una tabla y nadie la agrega acá, ese test falla.
 */

/** Identificadores fijos por inmobiliaria, para poder apuntarles después. */
export interface IdsDeTenant {
  tenant: string;
  usuario: string;
  operacion: string;
  operacionPunta: string;
  objetivo: string;
  tasacion: string;
  tasacionComparable: string;
  tasacionFoto: string;
  tasacionEstadoHistorial: string;
  informeGenerado: string;
  integracionCredencial: string;
  propiedad: string;
  googleCuenta: string;
  protocolo: string;
  protocoloAccion: string;
  alqPersona: string;
  alqPropiedad: string;
  alqContrato: string;
  alqContratoParte: string;
  alqTramo: string;
  alqLiquidacion: string;
  alqConcepto: string;
  alqCobro: string;
  alqImputacion: string;
  alqDocumento: string;
  alqFirmante: string;
  alqFirmaEvento: string;
  /**
   * Un segundo usuario y una segunda tasación por inmobiliaria.
   *
   * `google_cuenta.usuario_id` y `protocolo.tasacion_id` son campos ÚNICOS: una
   * segunda fila apuntando al mismo usuario o a la misma tasación es imposible
   * aunque RLS la dejara pasar. Sin estas dos filas de repuesto, la prueba de
   * inserción intrusa fallaría por la restricción única y daría verde sin haber
   * ejercido el aislamiento.
   */
  usuarioSecundario: string;
  tasacionSecundaria: string;
  /** Parte numérica única, para no chocar con los índices únicos por tenant. */
  n: number;
}

export function nuevosIds(n: number): IdsDeTenant {
  return {
    tenant: randomUUID(),
    usuario: randomUUID(),
    operacion: randomUUID(),
    operacionPunta: randomUUID(),
    objetivo: randomUUID(),
    tasacion: randomUUID(),
    tasacionComparable: randomUUID(),
    tasacionFoto: randomUUID(),
    tasacionEstadoHistorial: randomUUID(),
    informeGenerado: randomUUID(),
    integracionCredencial: randomUUID(),
    propiedad: randomUUID(),
    googleCuenta: randomUUID(),
    protocolo: randomUUID(),
    protocoloAccion: randomUUID(),
    alqPersona: randomUUID(),
    alqPropiedad: randomUUID(),
    alqContrato: randomUUID(),
    alqContratoParte: randomUUID(),
    alqTramo: randomUUID(),
    alqLiquidacion: randomUUID(),
    alqConcepto: randomUUID(),
    alqCobro: randomUUID(),
    alqImputacion: randomUUID(),
    alqDocumento: randomUUID(),
    alqFirmante: randomUUID(),
    alqFirmaEvento: randomUUID(),
    usuarioSecundario: randomUUID(),
    tasacionSecundaria: randomUUID(),
    n,
  };
}

/**
 * Descripción de una tabla para el test.
 *
 * `modelo` es el nombre del delegado de Prisma (`tx.operacion`, `tx.usuario`…).
 * `fila` arma un registro válido para el tenant dado. `idDe` dice cuál de los
 * identificadores le corresponde, para poder apuntarle en el update.
 */
export interface TablaBajoPrueba {
  tabla: string;
  modelo: string;
  /**
   * Qué campo de `IdsDeTenant` es la clave primaria de esta fila.
   *
   * Se guarda la CLAVE y no el valor a propósito: para probar el INSERT
   * intruso hay que regenerar **solo** ese identificador y dejar intactos los
   * demás, que son las claves foráneas apuntando a filas reales de la víctima.
   * Si se regeneraran todos, el INSERT fallaría por integridad referencial y
   * el test daría verde sin haber ejercido RLS.
   */
  claveId: keyof IdsDeTenant;
  fila: (tenantId: string, ids: IdsDeTenant) => Record<string, unknown>;
  /**
   * Solo para tablas cuya clave primaria no es un uuid propio. Ver
   * `usuario_rol`, que es la única.
   */
  filaIntrusa?: (tenantId: string, ids: IdsDeTenant) => Record<string, unknown>;
  /**
   * Columna por la que la tabla dice a qué inmobiliaria pertenece.
   *
   * Es `tenantId` en todas las tablas de negocio y `id` en `tenant`, que se
   * identifica a sí misma. Sin esta distinción, las consultas genéricas del
   * test fallan sobre `tenant` por una columna que no existe — y ese error se
   * lee como si RLS hubiera bloqueado algo.
   */
  campoTenant: 'tenantId' | 'id';
  /** Un campo cualquiera que se pueda escribir en el UPDATE de prueba. */
  campoEditable: string;
  /**
   * Motivo por el que esta tabla no puede tener el control de inserción (la
   * comprobación de que la fila intrusa SÍ entra desde su propio tenant).
   * Si está presente, ese caso se saltea con la razón a la vista.
   */
  sinControlDeInsercion?: string;
}

const HOY = new Date('2026-01-15T12:00:00.000Z');

export const TABLAS: TablaBajoPrueba[] = [
  {
    tabla: 'tenant',
    modelo: 'tenant',
    claveId: 'tenant',
    campoTenant: 'id',
    campoEditable: 'nombre',
    // Su policy es `id = app.tenant_id`: una inmobiliaria no puede crear otra
    // inmobiliaria desde su propio contexto, ni siquiera legítimamente. No hay
    // inserción válida contra la que contrastar.
    sinControlDeInsercion: 'la policy exige que el id sea el del tenant actual',
    fila: (_t, i) => ({ id: i.tenant, nombre: `Aislamiento ${i.n}`, slug: `aisl-${i.tenant}` }),
  },
  {
    tabla: 'usuario',
    modelo: 'usuario',
    claveId: 'usuario',
    campoTenant: 'tenantId',
    campoEditable: 'nombre',
    fila: (t, i) => ({
      id: i.usuario,
      tenantId: t,
      nombre: `Usuario ${i.n}`,
      email: `aisl-${i.usuario}@ejemplo.test`,
    }),
  },
  {
    // Clave primaria compuesta (usuarioId, rol): no tiene id propio, así que el
    // update se apunta por el usuario.
    tabla: 'usuario_rol',
    modelo: 'usuarioRol',
    claveId: 'usuario',
    campoTenant: 'tenantId',
    campoEditable: 'rol',
    fila: (t, i) => ({ usuarioId: i.usuario, rol: 'vendedor', tenantId: t }),
    // Su clave primaria es (usuario_id, rol), así que la fila intrusa reusa el
    // usuario real de la víctima y cambia el rol: si RLS no la frenara, entraría
    // sin chocar con nada. Regenerar el usuario habría fallado por la clave
    // foránea y el test habría dado verde sin probar el aislamiento.
    filaIntrusa: (t, i) => ({ usuarioId: i.usuario, rol: 'team_leader', tenantId: t }),
  },
  {
    tabla: 'operacion',
    modelo: 'operacion',
    claveId: 'operacion',
    campoTenant: 'tenantId',
    campoEditable: 'direccion',
    fila: (t, i) => ({
      id: i.operacion,
      tenantId: t,
      // `codigo_num` es GENERATED ALWAYS: no se escribe nunca desde acá.
      codigo: `OP-${9000 + i.n}`,
      tipo: 'venta',
      direccion: `Calle ${i.n}`,
      cantPuntas: 1,
      estado: 'escriturada',
    }),
  },
  {
    tabla: 'operacion_punta',
    modelo: 'operacionPunta',
    claveId: 'operacionPunta',
    campoTenant: 'tenantId',
    campoEditable: 'lado',
    fila: (t, i) => ({
      id: i.operacionPunta,
      operacionId: i.operacion,
      tenantId: t,
      lado: 'captadora',
      usuarioId: i.usuario,
    }),
  },
  {
    tabla: 'objetivo',
    modelo: 'objetivo',
    claveId: 'objetivo',
    campoTenant: 'tenantId',
    campoEditable: 'anio',
    fila: (t, i) => ({
      id: i.objetivo,
      tenantId: t,
      usuarioId: i.usuario,
      anio: 2026,
    }),
    // Único por (tenant, usuario, año): la fila intrusa apunta al usuario de
    // repuesto para no chocar con el objetivo que ya tiene el usuario principal.
    filaIntrusa: (t, i) => ({
      id: randomUUID(),
      tenantId: t,
      usuarioId: i.usuarioSecundario,
      anio: 2026,
    }),
  },
  {
    tabla: 'tasacion',
    modelo: 'tasacion',
    claveId: 'tasacion',
    campoTenant: 'tenantId',
    campoEditable: 'cliente',
    fila: (t, i) => ({
      id: i.tasacion,
      tenantId: t,
      agenteId: i.usuario,
      cliente: `Cliente ${i.n}`,
      fecha: HOY,
      direccion: `Tasación ${i.n}`,
      tipoOperacion: 'Venta',
      tipoPropiedad: 'Casa',
      superficieTotal: 100,
    }),
  },
  {
    tabla: 'tasacion_comparable',
    modelo: 'tasacionComparable',
    claveId: 'tasacionComparable',
    campoTenant: 'tenantId',
    campoEditable: 'direccion',
    fila: (t, i) => ({
      id: i.tasacionComparable,
      tasacionId: i.tasacion,
      tenantId: t,
      direccion: `Comparable ${i.n}`,
      superficie: 90,
      precio: 100000,
    }),
  },
  {
    tabla: 'tasacion_foto',
    modelo: 'tasacionFoto',
    claveId: 'tasacionFoto',
    campoTenant: 'tenantId',
    campoEditable: 'url',
    fila: (t, i) => ({
      id: i.tasacionFoto,
      tasacionId: i.tasacion,
      tenantId: t,
      url: `fotos/${i.n}.jpg`,
    }),
  },
  {
    tabla: 'tasacion_estado_historial',
    modelo: 'tasacionEstadoHistorial',
    claveId: 'tasacionEstadoHistorial',
    campoTenant: 'tenantId',
    campoEditable: 'estadoNuevo',
    fila: (t, i) => ({
      id: i.tasacionEstadoHistorial,
      tasacionId: i.tasacion,
      tenantId: t,
      estadoNuevo: 'Presentada',
      usuarioId: i.usuario,
    }),
  },
  {
    tabla: 'informe_generado',
    modelo: 'informeGenerado',
    claveId: 'informeGenerado',
    campoTenant: 'tenantId',
    campoEditable: 'url',
    fila: (t, i) => ({
      id: i.informeGenerado,
      tasacionId: i.tasacion,
      tenantId: t,
      url: `informes/${i.n}.pdf`,
    }),
  },
  {
    tabla: 'integracion_credencial',
    modelo: 'integracionCredencial',
    claveId: 'integracionCredencial',
    campoTenant: 'tenantId',
    campoEditable: 'ultimos4',
    fila: (t, i) => ({
      id: i.integracionCredencial,
      tenantId: t,
      proveedor: `proveedor-${i.n}`,
      secretoEnc: 'cifrado-de-mentira',
      ultimos4: '0000',
    }),
  },
  {
    tabla: 'propiedad',
    modelo: 'propiedad',
    claveId: 'propiedad',
    campoTenant: 'tenantId',
    campoEditable: 'titulo',
    fila: (t, i) => ({
      id: i.propiedad,
      tenantId: t,
      tokkoId: 900000 + i.n,
    }),
  },
  {
    tabla: 'google_cuenta',
    modelo: 'googleCuenta',
    claveId: 'googleCuenta',
    campoTenant: 'tenantId',
    campoEditable: 'googleEmail',
    fila: (t, i) => ({
      id: i.googleCuenta,
      tenantId: t,
      usuarioId: i.usuario,
      refreshTokenEnc: 'cifrado-de-mentira',
    }),
    // `usuario_id` es único: hay que apuntar al usuario de repuesto o la fila
    // chocaría con la que ya existe, sin llegar a ejercer RLS.
    filaIntrusa: (t, i) => ({
      id: randomUUID(),
      tenantId: t,
      usuarioId: i.usuarioSecundario,
      refreshTokenEnc: 'cifrado-de-mentira',
    }),
  },
  {
    tabla: 'protocolo',
    modelo: 'protocolo',
    claveId: 'protocolo',
    campoTenant: 'tenantId',
    campoEditable: 'observacionArchivo',
    fila: (t, i) => ({
      id: i.protocolo,
      tenantId: t,
      tasacionId: i.tasacion,
      agenteId: i.usuario,
      fechaInicio: HOY,
    }),
    // `tasacion_id` es único: una propiedad tiene un solo protocolo. Se usa la
    // tasación de repuesto por el mismo motivo que en google_cuenta.
    filaIntrusa: (t, i) => ({
      id: randomUUID(),
      tenantId: t,
      tasacionId: i.tasacionSecundaria,
      agenteId: i.usuario,
      fechaInicio: HOY,
    }),
  },
  {
    tabla: 'protocolo_accion',
    modelo: 'protocoloAccion',
    claveId: 'protocoloAccion',
    campoTenant: 'tenantId',
    campoEditable: 'titulo',
    fila: (t, i) => ({
      id: i.protocoloAccion,
      protocoloId: i.protocolo,
      tenantId: t,
      semana: 1,
      orden: 1,
      clave: `accion-${i.n}`,
      titulo: `Acción ${i.n}`,
    }),
  },
  // ── Módulo Alquileres (docs/specs/alquileres-fase-1.md) ──────────────────
  // En orden de dependencias: persona y propiedad antes que el contrato, el
  // contrato antes que sus partes y tramos, la liquidación antes que el
  // concepto (que puede apuntarle), el cobro antes que la imputación.
  {
    tabla: 'alq_persona',
    modelo: 'alqPersona',
    claveId: 'alqPersona',
    campoTenant: 'tenantId',
    campoEditable: 'nombre',
    // `documento` es único por inmobiliaria: sale de `n` para que la fila
    // intrusa no choque con la de la víctima antes de llegar a RLS.
    fila: (t, i) => ({ id: i.alqPersona, tenantId: t, nombre: `Persona ${i.n}`, documento: `${30000000 + i.n}` }),
  },
  {
    tabla: 'alq_propiedad',
    modelo: 'alqPropiedad',
    claveId: 'alqPropiedad',
    campoTenant: 'tenantId',
    campoEditable: 'direccion',
    fila: (t, i) => ({ id: i.alqPropiedad, tenantId: t, direccion: `Alquilada ${i.n}` }),
  },
  {
    tabla: 'alq_contrato',
    modelo: 'alqContrato',
    claveId: 'alqContrato',
    campoTenant: 'tenantId',
    campoEditable: 'obs',
    fila: (t, i) => ({
      id: i.alqContrato,
      tenantId: t,
      codigo: `ALQ-AISL-${i.n}`,
      propiedadId: i.alqPropiedad,
      inicio: HOY,
      fin: HOY,
    }),
  },
  {
    tabla: 'alq_contrato_parte',
    modelo: 'alqContratoParte',
    claveId: 'alqContratoParte',
    campoTenant: 'tenantId',
    campoEditable: 'papel',
    fila: (t, i) => ({
      id: i.alqContratoParte,
      tenantId: t,
      contratoId: i.alqContrato,
      personaId: i.alqPersona,
      papel: 'propietario',
      porcentaje: 100,
    }),
    // (contrato, persona, papel) es único: la intrusa cambia el papel para no
    // chocar con la fila real de la víctima, que es la que tiene que ejercer RLS.
    filaIntrusa: (t, i) => ({
      id: randomUUID(),
      tenantId: t,
      contratoId: i.alqContrato,
      personaId: i.alqPersona,
      papel: 'garante',
    }),
  },
  {
    tabla: 'alq_tramo',
    modelo: 'alqTramo',
    claveId: 'alqTramo',
    campoTenant: 'tenantId',
    campoEditable: 'numero',
    // (contrato, número) es único: el número sale de `n`.
    fila: (t, i) => ({ id: i.alqTramo, tenantId: t, contratoId: i.alqContrato, numero: i.n, desde: HOY, hasta: HOY }),
  },
  {
    tabla: 'alq_liquidacion',
    modelo: 'alqLiquidacion',
    claveId: 'alqLiquidacion',
    campoTenant: 'tenantId',
    campoEditable: 'periodo',
    fila: (t, i) => ({ id: i.alqLiquidacion, tenantId: t, personaId: i.alqPersona, periodo: '2026-01', neto: 1, fecha: HOY }),
  },
  {
    tabla: 'alq_concepto',
    modelo: 'alqConcepto',
    claveId: 'alqConcepto',
    campoTenant: 'tenantId',
    campoEditable: 'descripcion',
    // Sin `claveGeneracion` (concepto cargado a mano): esa columna es única por
    // inmobiliaria y vacía no choca.
    fila: (t, i) => ({
      id: i.alqConcepto,
      tenantId: t,
      contratoId: i.alqContrato,
      personaId: i.alqPersona,
      tipo: 'alquiler',
      sentido: 'a_cobrar',
      vencimiento: HOY,
      importe: 1,
    }),
  },
  {
    tabla: 'alq_cobro',
    modelo: 'alqCobro',
    claveId: 'alqCobro',
    campoTenant: 'tenantId',
    campoEditable: 'obs',
    fila: (t, i) => ({ id: i.alqCobro, tenantId: t, personaId: i.alqPersona, fecha: HOY, importe: 1, medio: 'efectivo' }),
  },
  {
    tabla: 'alq_imputacion',
    modelo: 'alqImputacion',
    claveId: 'alqImputacion',
    campoTenant: 'tenantId',
    campoEditable: 'importe',
    fila: (t, i) => ({ id: i.alqImputacion, tenantId: t, cobroId: i.alqCobro, conceptoId: i.alqConcepto, importe: 1 }),
  },
  {
    tabla: 'alq_documento',
    modelo: 'alqDocumento',
    claveId: 'alqDocumento',
    campoTenant: 'tenantId',
    campoEditable: 'proveedor',
    fila: (t, i) => ({ id: i.alqDocumento, tenantId: t, contratoId: i.alqContrato }),
  },
  {
    tabla: 'alq_firmante',
    modelo: 'alqFirmante',
    claveId: 'alqFirmante',
    campoTenant: 'tenantId',
    campoEditable: 'estado',
    fila: (t, i) => ({ id: i.alqFirmante, tenantId: t, documentoId: i.alqDocumento, personaId: i.alqPersona }),
  },
  {
    tabla: 'alq_firma_evento',
    modelo: 'alqFirmaEvento',
    claveId: 'alqFirmaEvento',
    campoTenant: 'tenantId',
    campoEditable: 'origen',
    fila: (t, i) => ({ id: i.alqFirmaEvento, tenantId: t, documentoId: i.alqDocumento, estadoNuevo: 'firmado', origen: 'manual' }),
  },
];

/**
 * Arma los identificadores de una fila intrusa a partir de los de la víctima.
 *
 * Cambia DOS cosas y nada más:
 *
 * - la clave primaria de la fila, para que no choque con la que ya existe;
 * - `n`, del que salen los campos con restricción única por inmobiliaria
 *   (`operacion.codigo`, `propiedad.tokko_id`, `integracion_credencial.proveedor`,
 *   `objetivo.anio`).
 *
 * Todo lo demás —las claves foráneas— sigue apuntando a filas reales de la
 * víctima. Esa es la única forma de que la fila sea válida en todo salvo en el
 * tenant al que pertenece, que es lo que se quiere probar. Si se regeneraran
 * todos los identificadores, el INSERT fallaría por integridad referencial y el
 * test daría verde sin haber ejercido RLS.
 */
let contador = 0;
export function idsIntrusos(base: IdsDeTenant, clave: keyof IdsDeTenant): IdsDeTenant {
  contador += 1;
  return { ...base, [clave]: randomUUID(), n: 100_000 + contador };
}

/** Un valor válido para el UPDATE de prueba de cada tabla. */
export function valorEditable(t: TablaBajoPrueba): unknown {
  if (t.campoEditable === 'anio') return 2027;
  if (t.campoEditable === 'rol') return 'direccion';
  // Columnas numéricas de las tablas de Alquileres que no tienen un campo de
  // texto propio para tocar.
  if (t.campoEditable === 'numero') return 99;
  if (t.campoEditable === 'importe') return 2;
  return 'tocado-por-el-test';
}

/**
 * Siembra las dos inmobiliarias completas. Corre como `postgres` (BYPASSRLS) a
 * propósito: es la preparación, no lo que se está probando.
 *
 * El orden importa por las claves foráneas y por eso no se genera solo.
 */
export async function sembrar(db: PrismaClient, ids: IdsDeTenant): Promise<void> {
  for (const t of TABLAS) {
    const datos = t.fila(ids.tenant, ids);
    // El delegado se busca por nombre: es lo que permite recorrer todas las tablas
    // sin escribir un bloque por cada una.
    const delegado = (
      db as unknown as Record<string, { create: (a: unknown) => Promise<unknown> } | undefined>
    )[t.modelo];
    if (!delegado) throw new Error(`No existe el delegado de Prisma "${t.modelo}"`);
    await delegado.create({ data: datos });
  }

  // Las de repuesto, para las tablas con campo único (ver `IdsDeTenant`).
  await db.usuario.create({
    data: {
      id: ids.usuarioSecundario,
      tenantId: ids.tenant,
      nombre: `Usuario secundario ${ids.n}`,
      email: `aisl-${ids.usuarioSecundario}@ejemplo.test`,
    },
  });
  await db.tasacion.create({
    data: {
      id: ids.tasacionSecundaria,
      tenantId: ids.tenant,
      agenteId: ids.usuario,
      cliente: `Cliente secundario ${ids.n}`,
      fecha: HOY,
      direccion: `Tasación secundaria ${ids.n}`,
      tipoOperacion: 'Venta',
      tipoPropiedad: 'Casa',
      superficieTotal: 100,
    },
  });
}

/** Borra todo lo que sembró. `tenant` cae en cascada sobre el resto. */
export async function limpiar(db: PrismaClient, ids: IdsDeTenant[]): Promise<void> {
  await db.tenant.deleteMany({ where: { id: { in: ids.map((i) => i.tenant) } } });
}
