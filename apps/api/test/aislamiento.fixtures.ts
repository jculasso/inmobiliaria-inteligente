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
    campoEditable: 'anio',
    fila: (t, i) => ({
      id: i.objetivo,
      tenantId: t,
      usuarioId: i.usuario,
      anio: 2026,
    }),
  },
  {
    tabla: 'tasacion',
    modelo: 'tasacion',
    claveId: 'tasacion',
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
    // El delegado se busca por nombre: es lo que permite recorrer las 16 tablas
    // sin escribir 16 bloques iguales.
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
