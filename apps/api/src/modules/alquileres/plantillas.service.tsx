import { Injectable, NotFoundException } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { NOMBRE_TIPO_CONTRATO, type DocumentoContratoDto, type Plantilla, type PlantillaDto } from '@vacker/types';
import { completarPlantilla, fechaCorta, importeEnLetras } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { FirmaService } from './firma/firma.service';
import { mesesDeContrato } from './contrato-completo.service';
import { plata, registrarEventos } from './historial';
import { marcaDe } from './marca';
import { MODELO_BASE } from './plantilla-modelo';
import { PlantillaDocument } from './plantilla.template';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const NOMBRE_INDICE: Record<string, string> = { ICL: 'el Índice para Contratos de Locación (ICL) del BCRA', IPC: 'el Índice de Precios al Consumidor (IPC) del INDEC', CCP: 'el índice Casa Propia' };

const aDto = (p: { id: string; nombre: string; tipoContrato: string | null; cuerpo: string; updatedAt: Date }): PlantillaDto => ({
  id: p.id,
  nombre: p.nombre,
  tipoContrato: p.tipoContrato as PlantillaDto['tipoContrato'],
  cuerpo: p.cuerpo,
  actualizada: p.updatedAt.toISOString(),
});

/** «20.123.456» o «20-12345678-6». */
const documento = (d: string | null) => (!d ? null : d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));

/**
 * El contrato desde una plantilla (entrega 15): plantillas por inmobiliaria
 * con variables que se completan con los datos del contrato, y el PDF que
 * queda como documento del contrato, listo para mandar a firmar.
 */
@Injectable()
export class PlantillasService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly firma: FirmaService,
  ) {}

  async listar(): Promise<PlantillaDto[]> {
    return this.db.withTenant(async (tx) => (await tx.alqPlantilla.findMany({ orderBy: { nombre: 'asc' } })).map(aDto));
  }

  /** El modelo para empezar, si la inmobiliaria todavía no cargó el suyo. */
  modeloBase(): { cuerpo: string } {
    return { cuerpo: MODELO_BASE };
  }

  async crear(ctx: TenantContext, dto: Plantilla): Promise<PlantillaDto> {
    return this.db.withTenant(async (tx) => aDto(await tx.alqPlantilla.create({ data: { ...dto, tenantId: ctx.tenantId, creadoPorId: ctx.userId } })));
  }

  async actualizar(id: string, dto: Plantilla): Promise<PlantillaDto> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqPlantilla.findUnique({ where: { id }, select: { id: true } });
      if (!p) throw new NotFoundException('La plantilla no existe.');
      return aDto(await tx.alqPlantilla.update({ where: { id }, data: dto }));
    });
  }

  async borrar(id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqPlantilla.deleteMany({ where: { id } });
      if (!count) throw new NotFoundException('La plantilla no existe.');
      return { id };
    });
  }

  /** El texto de una plantilla con los datos del contrato, sin armar el PDF. */
  async texto(contratoId: string, cuerpo: string): Promise<string> {
    return this.db.withTenant((tx) => this.completar(tx, contratoId, cuerpo));
  }

  /** El PDF de un texto con los datos de un contrato, para ver cómo queda antes de guardar. */
  async vistaPrevia(ctx: TenantContext, contratoId: string, cuerpo: string): Promise<Buffer> {
    const [texto, marca] = await Promise.all([this.db.withTenant((tx) => this.completar(tx, contratoId, cuerpo)), marcaDe(this.db, ctx)]);
    return renderToBuffer(<PlantillaDocument texto={texto} tenantNombre={marca.nombre} logoUrl={marca.logoUrl} colorPrimario={marca.colorPrimario} />);
  }

  /** Genera el contrato y lo deja como su documento, para mandar a firmar (reglas 33 a 36). */
  async generar(ctx: TenantContext, contratoId: string, plantillaId: string): Promise<DocumentoContratoDto> {
    const { texto, codigo, nombre } = await this.db.withTenant(async (tx) => {
      const p = await tx.alqPlantilla.findUnique({ where: { id: plantillaId }, select: { nombre: true, cuerpo: true } });
      if (!p) throw new NotFoundException('La plantilla no existe.');
      const c = await tx.alqContrato.findUnique({ where: { id: contratoId }, select: { codigo: true } });
      if (!c) throw new NotFoundException('El contrato no existe.');
      return { texto: await this.completar(tx, contratoId, p.cuerpo), codigo: c.codigo, nombre: p.nombre };
    });
    const marca = await marcaDe(this.db, ctx);
    const buffer = await renderToBuffer(<PlantillaDocument texto={texto} tenantNombre={marca.nombre} logoUrl={marca.logoUrl} colorPrimario={marca.colorPrimario} />);
    const doc = await this.firma.cargar(ctx, contratoId, { buffer, mimetype: 'application/pdf', originalname: `Contrato-${codigo}.pdf`, size: buffer.length });
    await this.db.withTenant((tx) =>
      registrarEventos(tx, ctx, { entidad: 'documento', entidadId: doc.id, contratoId, accion: 'documento', resumen: `Contrato generado desde la plantilla «${nombre}»` }),
    );
    return doc;
  }

  /** Los valores de las variables, con los datos del contrato. Dos consultas. */
  private async completar(tx: Tx, contratoId: string, cuerpo: string): Promise<string> {
    const [c, tenant] = await Promise.all([
      tx.alqContrato.findUnique({
        where: { id: contratoId },
        include: {
          propiedad: true,
          partes: { include: { persona: { select: { nombre: true, documento: true, cuit: true, domicilio: true, localidad: true } } } },
          tramos: { orderBy: { numero: 'asc' } },
        },
      }),
      tx.tenant.findFirstOrThrow({ select: { nombre: true } }),
    ]);
    if (!c) throw new NotFoundException('El contrato no existe.');
    const moneda = c.moneda as 'ARS' | 'USD';
    const personas = (papel: string) =>
      c.partes
        .filter((p) => p.papel === papel)
        .map((p) => {
          const doc = documento(p.persona.documento) ?? documento(p.persona.cuit);
          const dom = [p.persona.domicilio, p.persona.localidad].filter(Boolean).join(', ');
          return [p.persona.nombre, doc && `DNI/CUIT ${doc}`, dom && `con domicilio en ${dom}`].filter(Boolean).join(', ');
        })
        .join('; ') || '[sin cargar]';
    const inicio = fromDate(c.inicio)!;
    const fin = fromDate(c.fin)!;
    const inicial = c.tramos[0]?.importe != null ? decToNum(c.tramos[0].importe) : 0;
    const deposito = c.depositoImporte != null ? decToNum(c.depositoImporte) : 0;
    const monedaDeposito = (c.depositoMoneda ?? c.moneda) as 'ARS' | 'USD';
    const valores: Record<string, string> = {
      inmobiliaria: tenant.nombre,
      'contrato.codigo': c.codigo,
      'contrato.tipo': NOMBRE_TIPO_CONTRATO[c.tipo as 'vivienda' | 'comercial'],
      'contrato.destino': c.tipo === 'comercial' ? 'uso comercial' : 'vivienda familiar',
      'contrato.inicio': fechaCorta(inicio),
      'contrato.fin': fechaCorta(fin),
      'contrato.meses': String(mesesDeContrato(inicio, fin)),
      'propiedad.direccion': [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' '),
      'propiedad.ciudad': c.propiedad.ciudad ?? '[ciudad]',
      propietarios: personas('propietario'),
      inquilinos: personas('inquilino'),
      garantes: personas('garante'),
      'alquiler.inicial': plata(inicial, moneda),
      'alquiler.inicial.letras': importeEnLetras(inicial, moneda),
      ajuste:
        c.ajuste === 'indexado' && c.indice
          ? `${NOMBRE_INDICE[c.indice] ?? c.indice}, cada ${c.periodicidadMeses} meses`
          : 'los importes escalonados que se detallan',
      tramos: c.tramos
        .map((t) => `- Tramo ${t.numero}: del ${fechaCorta(fromDate(t.desde)!)} al ${fechaCorta(fromDate(t.hasta)!)}: ${t.importe != null ? plata(decToNum(t.importe), moneda) : 'según el índice'}`)
        .join('\n'),
      'vencimiento.dia': String(c.diaVencimiento),
      punitorio: `${decToNum(c.punitorioDiarioPct).toLocaleString('es-AR')}%`,
      deposito: deposito ? plata(deposito, monedaDeposito) : '[sin depósito]',
      'deposito.letras': deposito ? importeEnLetras(deposito, monedaDeposito) : '[sin depósito]',
      'fecha.hoy': fechaCorta(hoyArgentina()),
    };
    return completarPlantilla(cuerpo, valores);
  }
}
