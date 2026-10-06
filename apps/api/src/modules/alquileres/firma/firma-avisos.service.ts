import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { EstadoFirma, EstadoFirmante } from '@vacker/types';
import { estadoDeFirma } from '@vacker/domain';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BUCKET_CONTRATOS, evento } from './firma.service';
import { PROVEEDORES_FIRMA, type ProveedorFirma } from './proveedor-firma';

/**
 * Los avisos de un proveedor de firma (regla 34, segunda vía).
 *
 * Llegan sin sesión y sin inmobiliaria: lo único que dice de quién son es el
 * envío. Por eso esto usa `PrismaService` directo —buscar el documento por su
 * envío es, por definición, mirar todas las inmobiliarias— y toca solo ese
 * documento, sus firmantes y sus eventos, con el `tenant_id` del documento
 * encontrado. Está en la lista de excepciones de `acceso-directo.e2e-spec.ts`.
 *
 * Lo que se rechaza, sin mirar el contenido:
 * - un proveedor que no está registrado (404);
 * - un aviso que el adaptador no reconoce como auténtico (401);
 * - un envío que no es de ningún documento, o un firmante que no es de ese
 *   documento (404 / 400).
 */
@Injectable()
export class FirmaAvisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    @Inject(PROVEEDORES_FIRMA) private readonly proveedores: Map<string, ProveedorFirma>,
  ) {}

  async procesar(nombre: string, cabeceras: Record<string, string | string[] | undefined>, cuerpo: unknown): Promise<{ estado: EstadoFirma }> {
    const proveedor = this.proveedores.get(nombre);
    if (!proveedor) throw new NotFoundException('Proveedor de firma desconocido.');
    const aviso = proveedor.leerAviso(cabeceras, cuerpo);
    if (!aviso) throw new UnauthorizedException('El aviso no es auténtico.');

    const doc = await this.prisma.alqDocumento.findUnique({
      where: { proveedor_envioExternoId: { proveedor: nombre, envioExternoId: aviso.envioId } },
      select: { id: true, tenantId: true, contratoId: true, estadoFirma: true, firmantes: { select: { personaId: true, estado: true } } },
    });
    if (!doc) throw new NotFoundException('El aviso no corresponde a ningún envío.');
    const propios = new Set(doc.firmantes.map((f) => f.personaId));
    if (aviso.firmantes.some((f) => !propios.has(f.personaId))) throw new BadRequestException('El aviso trae un firmante que no es de este documento.');

    let archivoFirmado: string | undefined;
    if (aviso.archivoFirmado) {
      archivoFirmado = `${doc.tenantId}/${doc.contratoId}/firmado-${randomUUID()}.pdf`;
      await this.storage.uploadPrivado(BUCKET_CONTRATOS, archivoFirmado, aviso.archivoFirmado, 'application/pdf');
    }

    const estados = doc.firmantes.map((f) => (aviso.firmantes.find((x) => x.personaId === f.personaId)?.estado ?? f.estado) as EstadoFirmante);
    const nuevo = aviso.vencido && !estados.every((e) => e === 'firmado') ? 'vencido' : estadoDeFirma(doc.estadoFirma as EstadoFirma, estados);
    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const f of aviso.firmantes) {
        await tx.alqFirmante.update({
          where: { documentoId_personaId: { documentoId: doc.id, personaId: f.personaId } },
          data: { estado: f.estado, firmadoEl: f.estado === 'firmado' ? ahora : null },
        });
      }
      await tx.alqDocumento.update({ where: { id: doc.id }, data: { estadoFirma: nuevo, ...(archivoFirmado ? { archivoFirmado } : {}) } });
      await evento(tx, doc.tenantId, doc.id, doc.estadoFirma, nuevo, nombre, archivoFirmado ? 'Llegó el PDF firmado.' : null);
    });
    return { estado: nuevo };
  }
}
