import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DestinatarioReporte } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { enviarMail, MailError } from '../../../common/resend.client';
import { ProtocolosService } from '../protocolos.service';
import { ReporteSemanalPdfService } from './reporte-semanal-pdf.service';
import { armarMailDelReporte } from './reporte-semanal.mail';

/** Remitente. La inmobiliaria va en la parte local y en el nombre visible. */
const DOMINIO_ENVIO = 'avisos.inmobiliariainteligente.net';

export interface ResultadoEnvio {
  enviado: boolean;
  destinatarios: string[];
  /** Por qué no se mandó, cuando `enviado` es false. */
  motivo?: string;
}

/**
 * Manda el reporte semanal por mail a quienes están marcados para recibirlo.
 *
 * El remitente sale del dominio de la PLATAFORMA, no del de la inmobiliaria:
 * hacer DNS en el dominio de cada cliente no escala —son trámites contra
 * terceros— y DKIM firma por dominio, así que un subdominio por inmobiliaria
 * sería un juego de registros por cada una. La inmobiliaria viaja en el nombre
 * visible, que es lo que se lee en la bandeja, y las respuestas van a un mail
 * real de la inmobiliaria.
 *
 * El día que haya un mail al PROPIETARIO la decisión será la contraria: ahí el
 * remitente tiene que ser la inmobiliaria, porque el propietario no tiene por
 * qué saber que existe la plataforma.
 */
@Injectable()
export class ReporteSemanalMailService {
  private readonly logger = new Logger(ReporteSemanalMailService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly config: ConfigService,
    private readonly protocolos: ProtocolosService,
    private readonly pdf: ReporteSemanalPdfService,
  ) {}

  /**
   * A quiénes les va a llegar. Se consulta ANTES de mandar para poder
   * mostrarlo en la confirmación: sin esto, la única forma de enterarse de
   * que no había nadie marcado era mandar el mail y leer el motivo.
   */
  async destinatarios(ctx: TenantContext): Promise<DestinatarioReporte[]> {
    return this.db.withTenant(
      async (tx) =>
        tx.usuario.findMany({
          where: { recibeReporteSemanal: true, estado: 'activo' },
          select: { nombre: true, email: true },
          orderBy: { nombre: 'asc' },
        }),
      ctx,
    );
  }

  async enviar(ctx: TenantContext): Promise<ResultadoEnvio> {
    const { tenant, destinatarios } = await this.db.withTenant(async (tx) => {
      const t = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
      const us = await tx.usuario.findMany({
        where: { recibeReporteSemanal: true, estado: 'activo' },
        select: { nombre: true, email: true },
        orderBy: { nombre: 'asc' },
      });
      return { tenant: t, destinatarios: us };
    }, ctx);

    if (destinatarios.length === 0) {
      // No es un error: es que nadie lo pidió todavía. Devolverlo como 400
      // haría que el cron marcara la corrida como fallida todas las semanas.
      return {
        enviado: false,
        destinatarios: [],
        motivo:
          'Nadie está marcado para recibir el reporte. Se activa por usuario desde la administración de la inmobiliaria.',
      };
    }

    const reporte = await this.protocolos.reporteSemanal(ctx);

    // Una inmobiliaria sin propiedades activas NO recibe mail. Un reporte
    // vacío todas las semanas entrena a ignorar los que sí importan.
    if (reporte.resumen.activas === 0) {
      return {
        enviado: false,
        destinatarios: destinatarios.map((d) => d.email),
        motivo: 'No hay propiedades en comercialización: no se manda un reporte vacío.',
      };
    }

    const urlApp = this.config.get<string>('WEB_URL') ?? 'https://app.inmobiliariainteligente.net';
    const { asunto, html, texto } = armarMailDelReporte(reporte, tenant.nombre, urlApp);
    const { buffer, nombreArchivo } = await this.pdf.generar(ctx);

    const slug = slugDeTenant(tenant.nombre);
    try {
      const { id } = await enviarMail(
        {
          de: `${tenant.nombre} · Inmobiliaria Inteligente <${slug}@${DOMINIO_ENVIO}>`,
          para: destinatarios.map((d) => d.email),
          // Si alguien contesta el reporte, que la conversación se quede
          // adentro de la inmobiliaria y no muera en el dominio de la
          // plataforma.
          responderA: destinatarios[0]?.email,
          asunto: `${tenant.nombre} · ${asunto}`,
          html,
          texto,
          adjuntos: [{ nombre: `${nombreArchivo}.pdf`, contenido: buffer }],
        },
        this.config.get<string>('RESEND_API_KEY') ?? '',
      );
      this.logger.log(`Reporte semanal enviado a ${destinatarios.length} destinatario(s): ${id}`);
      return { enviado: true, destinatarios: destinatarios.map((d) => d.email) };
    } catch (err) {
      if (err instanceof MailError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}

/** "Jorgito Propiedades" → "jorgito-propiedades", para la parte local del remitente. */
export function slugDeTenant(nombre: string): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'reportes'
  );
}
