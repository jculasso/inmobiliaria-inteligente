import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CambioFirmaManualSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SupabaseStorageService } from '../../../common/supabase-storage.service';
import { FirmaAvisosService } from './firma-avisos.service';
import { FirmaService, type ArchivoPdf } from './firma.service';
import { FirmaManual, type AvisoFirma, type ProveedorFirma } from './proveedor-firma';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const DUENO = '11111111-1111-4111-8111-111111111111';
const INQ = '22222222-2222-4222-8222-222222222222';
const C5 = '55555555-5555-4555-8555-555555555555';
const DOC = '66666666-6666-4666-8666-666666666666';

const pdf = (contenido = '%PDF-1.7 contrato'): ArchivoPdf => ({
  buffer: Buffer.from(contenido),
  mimetype: 'application/pdf',
  originalname: 'Contrato 5.pdf',
  size: 20,
});

function fila(
  estadoFirma = 'sin_enviar',
  firmantes: [string, string][] = [
    [DUENO, 'pendiente'],
    [INQ, 'pendiente'],
  ],
) {
  return {
    id: DOC,
    contratoId: C5,
    estadoFirma,
    proveedor: estadoFirma === 'sin_enviar' ? null : 'manual',
    nombreArchivo: 'Contrato 5.pdf',
    archivoFirmado: null,
    firmantes: firmantes.map(([personaId, estado]) => ({
      personaId,
      estado,
      firmadoEl: null,
      persona: { nombre: personaId === DUENO ? 'Dueño' : 'Inquilina' },
    })),
    eventos: [],
    contrato: {
      partes: [
        { personaId: DUENO, papel: 'propietario' },
        { personaId: INQ, papel: 'inquilino' },
      ],
    },
  };
}

function makeTx(documento: unknown = null) {
  return {
    alqContrato: {
      findUnique: vi.fn().mockResolvedValue({ partes: [{ personaId: DUENO }, { personaId: INQ }] }),
    },
    alqDocumento: {
      findUnique: vi.fn().mockResolvedValue(documento),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ archivo: 't1/c5/x.pdf' }),
      create: vi.fn(),
      update: vi.fn(),
    },
    alqFirmante: { createMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    alqFirmaEvento: { create: vi.fn() },
    alqPersona: {
      findMany: vi.fn().mockResolvedValue([{ id: DUENO, nombre: 'Dueño', email: 'd@x.com' }]),
    },
  };
}

function servicio(
  tx: ReturnType<typeof makeTx>,
  proveedores: Map<string, ProveedorFirma> = new Map([['manual', new FirmaManual()]]),
) {
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  const storage = {
    uploadPrivado: vi.fn(),
    signedUrl: vi.fn().mockResolvedValue('https://firmada'),
    descargarPrivado: vi.fn().mockResolvedValue(Buffer.from('%PDF')),
  };
  return {
    svc: new FirmaService(db, storage as unknown as SupabaseStorageService, proveedores),
    storage,
  };
}

describe('FirmaService (reglas 33 y 34)', () => {
  it('cargar el PDF crea el documento sin enviar, con todas las partes como firmantes', async () => {
    const tx = makeTx();
    tx.alqDocumento.findUnique.mockResolvedValueOnce(null).mockResolvedValue(fila());
    const { svc, storage } = servicio(tx);
    await svc.cargar(CTX, C5, pdf());
    expect(storage.uploadPrivado.mock.calls[0]![0]).toBe('alquileres-contratos');
    expect(tx.alqDocumento.create.mock.calls[0]![0].data).toMatchObject({
      tenantId: 't1',
      contratoId: C5,
      estadoFirma: 'sin_enviar',
      nombreArchivo: 'Contrato 5.pdf',
    });
    expect(
      tx.alqFirmante.createMany.mock.calls[0]![0].data.map(
        (f: { personaId: string }) => f.personaId,
      ),
    ).toEqual([DUENO, INQ]);
    expect(tx.alqFirmaEvento.create.mock.calls[0]![0].data).toMatchObject({
      estadoAnterior: null,
      estadoNuevo: 'sin_enviar',
      origen: 'manual',
    });
  });

  it('solo acepta un PDF de verdad, no algo que dice ser PDF', async () => {
    const { svc } = servicio(makeTx());
    await expect(svc.cargar(CTX, C5, pdf('<html>'))).rejects.toThrow(
      'El contrato tiene que ser un PDF.',
    );
  });

  it('una vez enviado, el PDF no se cambia: se firma lo que se envió', async () => {
    const tx = makeTx();
    tx.alqDocumento.findUnique.mockResolvedValue({ id: DOC, estadoFirma: 'enviado' });
    await expect(servicio(tx).svc.cargar(CTX, C5, pdf())).rejects.toThrow(/ya se envió a firmar/);
  });

  // Regla 35: el envío pasa por la interfaz; el manual no baja el PDF.
  it('enviar usa el proveedor configurado y deja el envío registrado', async () => {
    const tx = makeTx(fila());
    const enviar = vi.fn(
      async (doc: { obtenerPdf: () => Promise<Buffer> }, _firmantes: unknown[]) => {
        await doc.obtenerPdf();
        return { envioId: 'env-1' };
      },
    );
    const { svc, storage } = servicio(
      tx,
      new Map([['manual', { nombre: 'manual', enviar, leerAviso: () => null }]]),
    );
    await svc.enviar(CTX, DOC);
    expect(enviar.mock.calls[0]![1]).toEqual([
      { personaId: DUENO, nombre: 'Dueño', email: 'd@x.com' },
    ]);
    expect(storage.descargarPrivado).toHaveBeenCalledWith('alquileres-contratos', 't1/c5/x.pdf');
    expect(tx.alqDocumento.update.mock.calls[0]![0].data).toEqual({
      estadoFirma: 'enviado',
      proveedor: 'manual',
      envioExternoId: 'env-1',
    });
  });

  // Regla 34: el estado sale de los firmantes y cada cambio queda registrado.
  it('marcar a mano: firmó uno de dos, queda firmado en parte, con el evento', async () => {
    const tx = makeTx(fila('enviado'));
    await servicio(tx).svc.cambiar(
      CTX,
      DOC,
      CambioFirmaManualSchema.parse({
        firmantes: [{ personaId: DUENO, estado: 'firmado' }],
        nota: 'Firmó en la oficina',
      }),
    );
    expect(tx.alqDocumento.update.mock.calls[0]![0].data).toMatchObject({
      estadoFirma: 'firmado_parcial',
    });
    expect(tx.alqFirmaEvento.create.mock.calls[0]![0].data).toMatchObject({
      estadoAnterior: 'enviado',
      estadoNuevo: 'firmado_parcial',
      origen: 'manual',
      detalle: { texto: 'Firmó en la oficina' },
    });
  });

  it('un firmante que no es del documento se rechaza; un firmado no vence', async () => {
    const otro = '99999999-9999-4999-8999-999999999999';
    await expect(
      servicio(makeTx(fila('enviado'))).svc.cambiar(
        CTX,
        DOC,
        CambioFirmaManualSchema.parse({ firmantes: [{ personaId: otro, estado: 'firmado' }] }),
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servicio(makeTx(fila('firmado'))).svc.cambiar(
        CTX,
        DOC,
        CambioFirmaManualSchema.parse({ marcar: 'vencido' }),
      ),
    ).rejects.toThrow('Un contrato firmado no vence.');
  });

  it('subir el PDF firmado: firmaron todos', async () => {
    const tx = makeTx(fila('enviado'));
    await servicio(tx).svc.cargarFirmado(CTX, DOC, pdf());
    expect(tx.alqFirmante.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { documentoId: DOC, estado: { not: 'firmado' } },
      data: { estado: 'firmado' },
    });
    expect(tx.alqDocumento.update.mock.calls[0]![0].data).toMatchObject({ estadoFirma: 'firmado' });
  });

  it('el schema no acepta un cambio vacío', () => {
    expect(() => CambioFirmaManualSchema.parse({})).toThrow(/No hay ningún cambio/);
  });
});

describe('FirmaAvisosService (reglas 34 y 35)', () => {
  /** Un proveedor de mentira: el aviso es auténtico si trae el token. */
  const falso: ProveedorFirma = {
    nombre: 'falso',
    enviar: async () => ({ envioId: 'x' }),
    leerAviso: (cabeceras, cuerpo) =>
      cabeceras['x-token'] === 'ok' ? (cuerpo as AvisoFirma) : null,
  };

  function avisos(doc: unknown) {
    const tx = {
      alqFirmante: { update: vi.fn() },
      alqDocumento: { update: vi.fn() },
      alqFirmaEvento: { create: vi.fn() },
    };
    const prisma = {
      alqDocumento: { findUnique: vi.fn().mockResolvedValue(doc) },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const storage = { uploadPrivado: vi.fn() } as unknown as SupabaseStorageService;
    return {
      svc: new FirmaAvisosService(prisma, storage, new Map([['falso', falso]])),
      tx,
      prisma,
    };
  }
  const doc = {
    id: DOC,
    tenantId: 't9',
    contratoId: C5,
    estadoFirma: 'enviado',
    firmantes: [
      { personaId: DUENO, estado: 'pendiente' },
      { personaId: INQ, estado: 'pendiente' },
    ],
  };

  it('un aviso auténtico de un envío conocido cambia el estado, con el proveedor como origen', async () => {
    const { svc, tx, prisma } = avisos(doc);
    const r = await svc.procesar(
      'falso',
      { 'x-token': 'ok' },
      {
        envioId: 'env-1',
        firmantes: [
          { personaId: DUENO, estado: 'firmado' },
          { personaId: INQ, estado: 'firmado' },
        ],
      },
    );
    expect(r).toEqual({ estado: 'firmado' });
    expect(
      (prisma.alqDocumento.findUnique as ReturnType<typeof vi.fn>).mock.calls[0]![0].where,
    ).toEqual({ proveedor_envioExternoId: { proveedor: 'falso', envioExternoId: 'env-1' } });
    expect(tx.alqFirmaEvento.create.mock.calls[0]![0].data).toMatchObject({
      tenantId: 't9',
      estadoAnterior: 'enviado',
      estadoNuevo: 'firmado',
      origen: 'falso',
    });
  });

  it('un aviso que no es auténtico se rechaza sin mirarlo', async () => {
    const { svc, prisma } = avisos(doc);
    await expect(svc.procesar('falso', {}, { envioId: 'env-1', firmantes: [] })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.alqDocumento.findUnique).not.toHaveBeenCalled();
  });

  // Regla 34: un aviso que no corresponde al envío se rechaza.
  it('un envío que no es de ningún documento, o un firmante ajeno, se rechazan', async () => {
    await expect(
      avisos(null).svc.procesar('falso', { 'x-token': 'ok' }, { envioId: 'otro', firmantes: [] }),
    ).rejects.toThrow('El aviso no corresponde a ningún envío.');
    const { svc, tx } = avisos(doc);
    await expect(
      svc.procesar(
        'falso',
        { 'x-token': 'ok' },
        {
          envioId: 'env-1',
          firmantes: [{ personaId: '99999999-9999-4999-8999-999999999999', estado: 'firmado' }],
        },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.alqDocumento.update).not.toHaveBeenCalled();
  });

  it('un proveedor que no está registrado, ni el manual, recibe avisos', async () => {
    await expect(avisos(doc).svc.procesar('manual', { 'x-token': 'ok' }, {})).rejects.toThrow(
      NotFoundException,
    );
  });
});
