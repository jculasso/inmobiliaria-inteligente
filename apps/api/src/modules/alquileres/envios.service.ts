import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvioMailDto } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { enviarMail, MailError } from '../../common/resend.client';
import { DOMINIO_ENVIO, slugDeTenant } from '../protocolo/informe/reporte-semanal-mail.service';
import { CobrosService } from './cobros.service';
import { dia, plata, registrarEventos } from './historial';
import { LiquidacionesService } from './liquidaciones.service';
import { ReciboService } from './recibo.service';

const numero = (n: number) => String(n).padStart(6, '0');
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El cuerpo del mail: corto, con lo que hay que saber, y el PDF adjunto. */
function cuerpo(saludo: string, lineas: string[], inmobiliaria: string, operador: string | null) {
  const firma = operador ? `${operador}\n${inmobiliaria}` : inmobiliaria;
  const texto = [
    `Hola, ${saludo}:`,
    '',
    ...lineas,
    '',
    'Va adjunto en PDF.',
    '',
    'Saludos,',
    firma,
  ].join('\n');
  const html = `<div style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#1D1D1F;line-height:1.5">
<p>Hola, ${escapar(saludo)}:</p>
${lineas.map((l) => `<p>${escapar(l)}</p>`).join('\n')}
<p>Va adjunto en PDF.</p>
<p>Saludos,<br>${firma.split('\n').map(escapar).join('<br>')}</p>
</div>`;
  return { texto, html };
}

/**
 * Manda por mail el recibo de un cobro o la liquidación de un propietario
 * (punto 14 de Javier, con Resend). Sale a nombre de la inmobiliaria desde el
 * dominio verificado de la plataforma; las respuestas van al operador que lo
 * mandó. Cada envío queda en el historial: quién, a quién y cuándo.
 */
@Injectable()
export class EnviosService {
  private readonly logger = new Logger(EnviosService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly config: ConfigService,
    private readonly pdfs: ReciboService,
    private readonly cobros: CobrosService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  async recibo(ctx: TenantContext, cobroId: string, para: string[]): Promise<EnvioMailDto> {
    const cobro = await this.cobros.obtener(cobroId);
    if (cobro.anulado) throw new BadRequestException('El recibo está anulado: no se manda.');
    const { buffer, nombreArchivo } = await this.pdfs.generar(ctx, cobroId);
    return this.mandar(ctx, {
      para,
      asunto: `Recibo ${numero(cobro.numero)}`,
      saludo: cobro.persona.nombre,
      lineas: [
        `Te mandamos el recibo ${numero(cobro.numero)} del ${dia(cobro.fecha)}, por ${plata(cobro.importe, cobro.moneda)}.`,
      ],
      adjunto: { nombre: `${nombreArchivo}.pdf`, contenido: buffer },
      evento: {
        entidad: 'cobro',
        entidadId: cobroId,
        personaId: cobro.persona.id,
        resumen: `Recibo ${numero(cobro.numero)} enviado a ${para.join(', ')}`,
      },
    });
  }

  async liquidacion(ctx: TenantContext, id: string, para: string[]): Promise<EnvioMailDto> {
    const liq = await this.liquidaciones.obtener(id);
    if (liq.anulado) throw new BadRequestException('La liquidación está anulada: no se manda.');
    const { buffer, nombreArchivo } = await this.pdfs.liquidacion(ctx, id);
    return this.mandar(ctx, {
      para,
      asunto: `Liquidación ${numero(liq.numero)}`,
      saludo: liq.persona.nombre,
      lineas: [
        `Te mandamos la liquidación ${numero(liq.numero)} del ${dia(liq.fecha)}: el neto a cobrar es ${plata(liq.neto, liq.moneda)}.`,
      ],
      adjunto: { nombre: `${nombreArchivo}.pdf`, contenido: buffer },
      evento: {
        entidad: 'liquidacion',
        entidadId: id,
        personaId: liq.persona.id,
        resumen: `Liquidación ${numero(liq.numero)} enviada a ${para.join(', ')}`,
      },
    });
  }

  private async mandar(
    ctx: TenantContext,
    m: {
      para: string[];
      asunto: string;
      saludo: string;
      lineas: string[];
      adjunto: { nombre: string; contenido: Buffer };
      evento: {
        entidad: 'cobro' | 'liquidacion';
        entidadId: string;
        personaId: string;
        resumen: string;
      };
    },
  ): Promise<EnvioMailDto> {
    limitarEnvios(ctx.tenantId);
    const { tenant, operador } = await this.db.withTenant(async (tx) => {
      const [tenant, operador] = await Promise.all([
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nombre: true } }),
        tx.usuario.findUnique({ where: { id: ctx.userId }, select: { nombre: true, email: true } }),
      ]);
      return { tenant, operador };
    });
    const { html, texto } = cuerpo(m.saludo, m.lineas, tenant.nombre, operador?.nombre ?? null);
    try {
      const { id } = await enviarMail(
        {
          // Entre comillas: una coma o unos «<>» en el nombre romperían el remitente.
          de: `"${tenant.nombre.replace(/["\\<>]/g, '')}" <${slugDeTenant(tenant.nombre)}@${DOMINIO_ENVIO}>`,
          para: m.para,
          // Si contestan, la respuesta le llega a quien lo mandó, no al dominio de la plataforma.
          responderA: operador?.email,
          asunto: `${m.asunto} · ${tenant.nombre}`,
          html,
          texto,
          adjuntos: [m.adjunto],
        },
        this.config.get<string>('RESEND_API_KEY') ?? '',
      );
      this.logger.log(`${m.asunto} enviado (${id})`);
    } catch (err) {
      if (err instanceof MailError) throw new BadRequestException(err.message);
      throw err;
    }
    // Recién después de que Resend lo aceptó: el historial dice lo que pasó.
    await this.db.withTenant((tx) => registrarEventos(tx, ctx, { ...m.evento, accion: 'envio' }));
    return { enviado: true, para: m.para };
  }
}

/**
 * Tope de mails por inmobiliaria y por hora. Todas salen del mismo dominio:
 * una cuenta comprometida mandando en bucle arruinaría la entrega de todas
 * (auditoría de seguridad del 6/10/2026). En memoria: alcanza mientras la API
 * corre en una sola instancia; un reinicio solo lo vuelve a cero.
 */
export const TOPE_MAILS_POR_HORA = 200;
const enviados = new Map<string, number[]>();
export function limitarEnvios(tenantId: string, ahora = Date.now()): void {
  const hace1h = ahora - 3_600_000;
  const recientes = (enviados.get(tenantId) ?? []).filter((t) => t > hace1h);
  if (recientes.length >= TOPE_MAILS_POR_HORA) {
    throw new HttpException(
      `Se mandaron ${TOPE_MAILS_POR_HORA} mails en la última hora: probá de nuevo más tarde.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  recientes.push(ahora);
  enviados.set(tenantId, recientes);
}
