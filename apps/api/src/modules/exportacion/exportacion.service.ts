import { Injectable, Logger } from '@nestjs/common';
import { armarCsv, fechaCsv, type Celda } from '../../common/csv';
import { crearZip, type ArchivoZip } from '../../common/zip';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

/**
 * "Sus datos son suyos y se los lleva cuando quiera."
 *
 * No es una función técnica: es la respuesta al miedo más caro de esta venta
 * —"¿y si contrato esto, cargo dos años de operaciones, y después no puedo
 * salir?"—. Por eso está pensada para que la use el dueño de la inmobiliaria,
 * no un desarrollador: un ZIP con planillas que abre con Excel y entiende sin
 * que nadie se las explique.
 *
 * Ninguno de los competidores lo ofrece, porque a todos les conviene que el
 * cliente no se pueda ir. Ahí está la oportunidad.
 *
 * Se exporta TODO lo del inquilino, sin tope de filas: poner un límite haría
 * que la exportación mintiera justo en la inmobiliaria más grande, que es la
 * que más lo necesita. Los volúmenes acá son de miles de filas, no de millones.
 */
@Injectable()
export class ExportacionService {
  private readonly logger = new Logger(ExportacionService.name);

  constructor(private readonly db: TenantPrismaService) {}

  async exportar(ctx: TenantContext): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // El filtro por inquilino va EXPLÍCITO además de RLS. En el resto del
    // sistema alcanza con RLS —es la barrera real y está probada—, pero este es
    // el único endpoint que vuelca la cartera entera: si algún día faltara una
    // policy en una tabla nueva, acá la fuga sería total. Dos barreras cuestan
    // una línea por consulta.
    const delInquilino = { tenantId: ctx.tenantId };

    const datos = await this.db.withTenant(async (tx) => {
      const [tenant, usuarios, objetivos, operaciones, tasaciones, protocolos, acciones] =
        await Promise.all([
          tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
          tx.usuario.findMany({
            where: delInquilino,
            orderBy: { nombre: 'asc' },
            include: { roles: { select: { rol: true } }, lider: { select: { nombre: true } } },
          }),
          tx.objetivo.findMany({
            where: delInquilino,
            include: { usuario: { select: { nombre: true } } },
          }),
          tx.operacion.findMany({
            where: delInquilino,
            orderBy: { codigo: 'asc' },
            include: { puntas: { include: { usuario: { select: { nombre: true } } } } },
          }),
          tx.tasacion.findMany({
            where: delInquilino,
            orderBy: { fecha: 'desc' },
            include: {
              agente: { select: { nombre: true } },
              comparables: true,
            },
          }),
          tx.protocolo.findMany({
            where: delInquilino,
            orderBy: { fechaInicio: 'desc' },
            include: {
              agente: { select: { nombre: true } },
              tasacion: { select: { direccion: true } },
            },
          }),
          tx.protocoloAccion.findMany({
            where: delInquilino,
            orderBy: [{ semana: 'asc' }, { orden: 'asc' }],
          }),
        ]);
      return { tenant, usuarios, objetivos, operaciones, tasaciones, protocolos, acciones };
    }, ctx);

    const dir = new Map(datos.protocolos.map((p) => [p.id, p.tasacion.direccion]));
    const obj = new Map(datos.objetivos.map((o) => [`${o.usuarioId}-${o.anio}`, o]));
    const num = (v: unknown): Celda => (v == null ? null : Number(v));

    const archivos: ArchivoZip[] = [
      {
        nombre: 'LEEME.txt',
        contenido: Buffer.from(this.leeme(datos.tenant.nombre), 'utf8'),
      },
      {
        nombre: 'operaciones.csv',
        contenido: armarCsv(
          [
            { clave: 'codigo', titulo: 'Código' },
            { clave: 'tipo', titulo: 'Tipo' },
            { clave: 'direccion', titulo: 'Dirección' },
            { clave: 'precio', titulo: 'Precio' },
            { clave: 'valorMensual', titulo: 'Valor mensual' },
            { clave: 'moneda', titulo: 'Moneda' },
            { clave: 'estado', titulo: 'Estado' },
            { clave: 'puntas', titulo: 'Puntas' },
            { clave: 'vendedores', titulo: 'Vendedores' },
            { clave: 'comision', titulo: 'Comisión total' },
            { clave: 'reserva', titulo: 'Fecha de reserva' },
            { clave: 'firma', titulo: 'Fecha de firma' },
            { clave: 'obs', titulo: 'Observaciones' },
          ],
          datos.operaciones.map((o) => ({
            codigo: o.codigo,
            tipo: o.tipo,
            direccion: o.direccion,
            precio: num(o.precio),
            valorMensual: num(o.valorMensual),
            moneda: o.moneda,
            estado: o.estado,
            puntas: o.cantPuntas,
            vendedores: o.puntas.map((p) => p.usuario.nombre).join(' · '),
            comision: num(o.comTotal),
            reserva: fechaCsv(o.fechaReserva),
            firma: fechaCsv(o.fechaFirma),
            obs: o.obs,
          })),
        ),
      },
      {
        nombre: 'operaciones-puntas.csv',
        contenido: armarCsv(
          [
            { clave: 'codigo', titulo: 'Código de operación' },
            { clave: 'lado', titulo: 'Punta' },
            { clave: 'vendedor', titulo: 'Vendedor' },
            { clave: 'comision', titulo: 'Comisión' },
          ],
          datos.operaciones.flatMap((o) =>
            o.puntas.map((p) => ({
              codigo: o.codigo,
              lado: p.lado,
              vendedor: p.usuario.nombre,
              comision: num(p.comision),
            })),
          ),
        ),
      },
      {
        nombre: 'tasaciones.csv',
        contenido: armarCsv(
          [
            { clave: 'fecha', titulo: 'Fecha' },
            { clave: 'cliente', titulo: 'Cliente' },
            { clave: 'direccion', titulo: 'Dirección' },
            { clave: 'barrio', titulo: 'Barrio' },
            { clave: 'ciudad', titulo: 'Ciudad' },
            { clave: 'tipoPropiedad', titulo: 'Tipo' },
            { clave: 'tipoOperacion', titulo: 'Operación' },
            { clave: 'estado', titulo: 'Estado' },
            { clave: 'agente', titulo: 'Agente' },
            { clave: 'supCubierta', titulo: 'Sup. cubierta' },
            { clave: 'dormitorios', titulo: 'Dormitorios' },
            { clave: 'banos', titulo: 'Baños' },
            { clave: 'valorMinimo', titulo: 'Valor mínimo' },
            { clave: 'valorRecomendado', titulo: 'Valor recomendado' },
            { clave: 'comparables', titulo: 'Comparables cargados' },
          ],
          datos.tasaciones.map((t) => ({
            fecha: fechaCsv(t.fecha),
            cliente: t.cliente,
            direccion: t.direccion,
            barrio: t.barrio,
            ciudad: t.ciudad,
            tipoPropiedad: t.tipoPropiedad,
            tipoOperacion: t.tipoOperacion,
            estado: t.estado,
            agente: t.agente.nombre,
            supCubierta: num(t.supCubierta),
            dormitorios: t.dormitorios,
            banos: t.banos,
            valorMinimo: num(t.valorMinimo),
            valorRecomendado: num(t.valorRecomendado),
            comparables: t.comparables.length,
          })),
        ),
      },
      {
        nombre: 'tasaciones-comparables.csv',
        contenido: armarCsv(
          [
            { clave: 'tasacion', titulo: 'Tasación (dirección)' },
            { clave: 'direccion', titulo: 'Comparable' },
            { clave: 'superficie', titulo: 'Superficie' },
            { clave: 'precio', titulo: 'Precio' },
            { clave: 'dormitorios', titulo: 'Dormitorios' },
            { clave: 'estado', titulo: 'Estado' },
            { clave: 'fuente', titulo: 'Fuente' },
            { clave: 'fecha', titulo: 'Fecha de referencia' },
          ],
          datos.tasaciones.flatMap((t) =>
            t.comparables.map((c) => ({
              tasacion: t.direccion,
              direccion: c.direccion,
              superficie: num(c.superficie),
              precio: num(c.precio),
              dormitorios: c.dormitorios,
              estado: c.estado,
              fuente: c.fuente,
              fecha: fechaCsv(c.fechaReferencia),
            })),
          ),
        ),
      },
      {
        nombre: 'protocolos.csv',
        contenido: armarCsv(
          [
            { clave: 'direccion', titulo: 'Dirección' },
            { clave: 'agente', titulo: 'Agente' },
            { clave: 'inicio', titulo: 'Inicio' },
            { clave: 'estado', titulo: 'Estado' },
            { clave: 'precio', titulo: 'Precio publicado' },
            { clave: 'vencimiento', titulo: 'Vence la autorización' },
            { clave: 'propietario', titulo: 'Propietario' },
            { clave: 'consultas', titulo: 'Consultas' },
            { clave: 'visitas', titulo: 'Visitas' },
            { clave: 'ofertas', titulo: 'Ofertas' },
            { clave: 'archivado', titulo: 'Archivado el' },
            { clave: 'motivo', titulo: 'Motivo de archivo' },
          ],
          datos.protocolos.map((p) => ({
            direccion: p.tasacion.direccion,
            agente: p.agente.nombre,
            inicio: fechaCsv(p.fechaInicio),
            estado: p.estado,
            precio: num(p.precioPublicado),
            vencimiento: fechaCsv(p.vencimientoAutorizacion),
            propietario: p.propietarioNombre,
            consultas: p.consultas,
            visitas: p.visitas,
            ofertas: p.ofertas,
            archivado: fechaCsv(p.archivadoEn),
            motivo: p.motivoArchivo,
          })),
        ),
      },
      {
        nombre: 'protocolos-acciones.csv',
        contenido: armarCsv(
          [
            { clave: 'propiedad', titulo: 'Propiedad' },
            { clave: 'semana', titulo: 'Semana' },
            { clave: 'accion', titulo: 'Acción' },
            { clave: 'estado', titulo: 'Estado' },
            { clave: 'prevista', titulo: 'Fecha prevista' },
            { clave: 'realizada', titulo: 'Fecha realizada' },
            { clave: 'resultado', titulo: 'Resultado' },
          ],
          datos.acciones.map((a) => ({
            propiedad: dir.get(a.protocoloId) ?? '',
            semana: a.semana,
            accion: a.titulo,
            estado: a.estado,
            prevista: fechaCsv(a.fechaPrevista),
            realizada: fechaCsv(a.fechaRealizada),
            resultado: a.resultado,
          })),
        ),
      },
      {
        nombre: 'vendedores.csv',
        contenido: armarCsv(
          [
            { clave: 'nombre', titulo: 'Nombre' },
            { clave: 'email', titulo: 'Correo' },
            { clave: 'telefono', titulo: 'Teléfono' },
            { clave: 'estado', titulo: 'Estado' },
            { clave: 'roles', titulo: 'Roles' },
            { clave: 'lider', titulo: 'Reporta a' },
            { clave: 'objComision', titulo: 'Objetivo de comisión 2026' },
            { clave: 'objPuntas', titulo: 'Objetivo de puntas 2026' },
          ],
          datos.usuarios.map((u) => {
            const o = obj.get(`${u.id}-2026`);
            return {
              nombre: u.nombre,
              email: u.email,
              telefono: u.telefono,
              estado: u.estado,
              roles: u.roles.map((r) => r.rol).join(' · '),
              lider: u.lider?.nombre ?? '',
              objComision: o ? Number(o.objComision) : null,
              objPuntas: o ? o.objPuntas : null,
            };
          }),
        ),
      },
    ];

    this.logger.log(
      `Exportación de ${datos.tenant.nombre}: ${datos.operaciones.length} operaciones, ` +
        `${datos.tasaciones.length} tasaciones, ${datos.protocolos.length} protocolos.`,
    );

    return {
      buffer: crearZip(archivos),
      nombreArchivo: `${slug(datos.tenant.nombre)}-datos-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  /** Lo primero que abre quien descarga: qué es cada archivo. */
  private leeme(tenant: string): string {
    return [
      `DATOS DE ${tenant.toUpperCase()}`,
      `Exportado el ${fechaCsv(new Date())}`,
      '',
      'Este archivo contiene TODO lo que la inmobiliaria tiene cargado en',
      'Inmobiliaria Inteligente. Es suyo: puede usarlo, guardarlo o llevarlo a',
      'otro sistema cuando quiera.',
      '',
      'QUÉ ES CADA PLANILLA',
      '',
      '  operaciones.csv .............. ventas y alquileres cerrados',
      '  operaciones-puntas.csv ....... quién intervino en cada una y su comisión',
      '  tasaciones.csv ............... todas las tasaciones y su estado',
      '  tasaciones-comparables.csv ... los comparables usados en cada tasación',
      '  protocolos.csv ............... las propiedades en comercialización',
      '  protocolos-acciones.csv ...... las 29 acciones de cada protocolo',
      '  vendedores.csv ............... el equipo, sus roles y objetivos',
      '',
      'CÓMO ABRIRLAS',
      '',
      'Doble clic en cualquiera de los archivos .csv: se abren con Excel, con',
      'las columnas y los acentos en su lugar.',
      '',
      'Las fotos de las tasaciones y los informes en PDF no viajan en este',
      'archivo por su tamaño. Si los necesita, pídalos y se los preparamos.',
      '',
    ].join('\n');
  }
}

/** "Alteva Propiedades" → "alteva-propiedades", para el nombre del archivo. */
function slug(nombre: string): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'inmobiliaria'
  );
}
