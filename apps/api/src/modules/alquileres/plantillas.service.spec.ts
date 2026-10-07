import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { ContratosController } from './contratos.controller';
import type { ContratosService } from './contratos.service';
import type { ContratoCompletoService } from './contrato-completo.service';
import type { HistorialService } from './historial';
import { mocksDeHistorial } from './historial.testing';
import { textoDeDocx } from './plantilla-word';
import { contratoDePrueba, docx } from './plantilla-word.testing';
import { nombreDelArchivo, PlantillasService } from './plantillas.service';

const CTX: TenantContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  roles: ['administracion'],
};
const PLANTILLA = docx([
  'Contrato {contrato.codigo} con {inquilinos.texto}.',
  '{#tramos}',
  'Del {desde} al {hasta}: {importe}',
  '{/tramos}',
  '{#deposito}Depósito: {importe}.{/deposito}{^deposito}Sin depósito.{/deposito}',
]);

function servicio(opciones: { plantilla?: object | null; tramos?: number } = {}) {
  const contrato = contratoDePrueba();
  if (opciones.tramos) {
    const [primero] = contrato.tramos;
    contrato.tramos = Array.from({ length: opciones.tramos }, (_, i) => ({
      ...primero!,
      numero: i + 1,
    }));
  }
  const fila = {
    id: 'p1',
    nombre: 'Locación vivienda',
    tipoContrato: null,
    archivo: `${CTX.tenantId}/plantillas/p1/viejo.docx`,
    nombreArchivo: 'Contrato.docx',
    tamano: 1234,
    updatedAt: new Date('2026-10-07T12:00:00Z'),
  };
  const tx = {
    alqPlantilla: {
      findUnique: vi
        .fn()
        .mockResolvedValue(opciones.plantilla === undefined ? fila : opciones.plantilla),
      findMany: vi
        .fn()
        .mockResolvedValue([fila, { ...fila, id: 'p2', archivo: null, nombreArchivo: null }]),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...fila, ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...fila, ...data })),
      delete: vi.fn().mockResolvedValue(fila),
    },
    alqContrato: { findUnique: vi.fn().mockResolvedValue(contrato) },
    tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva Propiedades' }) },
    ...mocksDeHistorial(),
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  const storage = {
    uploadPrivado: vi.fn(async (_b: string, path: string) => path),
    descargarPrivado: vi.fn().mockResolvedValue(PLANTILLA),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const s = new PlantillasService(db, storage as unknown as SupabaseStorageService);
  /** Cuántas consultas a la base se hicieron en total. */
  const consultas = () =>
    [
      tx.alqPlantilla.findUnique,
      tx.alqContrato.findUnique,
      tx.tenant.findUniqueOrThrow,
      tx.usuario.findUnique,
      tx.alqEvento.createMany,
    ].reduce((n, f) => n + f.mock.calls.length, 0);
  return { s, tx, storage, consultas };
}

const archivo = (buffer: Buffer, originalname = 'Contrato.docx') => ({
  buffer,
  mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  originalname,
  size: buffer.length,
});

describe('PlantillasService · generar el contrato en Word', () => {
  it('devuelve el Word completo con el nombre del contrato', async () => {
    const { s, storage } = servicio();
    const { buffer, nombre } = await s.generar(CTX, 'c1', 'p1');
    expect(nombre).toBe('Contrato-ALT-0090.docx');
    expect(storage.descargarPrivado).toHaveBeenCalledWith(
      'alquileres-contratos',
      `${CTX.tenantId}/plantillas/p1/viejo.docx`,
    );
    const texto = textoDeDocx(buffer);
    expect(texto).toContain('Contrato ALT-0090 con Ana Inquilina, DNI/CUIT 27-33344455-9.');
    expect(texto).toContain('Del 01/07/2026 al 31/10/2026: según el índice');
    expect(texto).toContain('Depósito: $ 350.000,00.');
  });

  it('deja en el historial que se generó, y NO lo guarda como el documento del contrato', async () => {
    const { s, tx, storage } = servicio();
    await s.generar(CTX, 'c1', 'p1');
    expect(tx.alqEvento.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entidad: 'contrato',
          entidadId: 'c1',
          contratoId: 'c1',
          accion: 'documento',
          resumen: 'Contrato en Word generado desde la plantilla «Locación vivienda»',
        }),
      ],
    });
    expect(storage.uploadPrivado).not.toHaveBeenCalled();
  });

  it('las mismas consultas con 5 tramos que con 25', async () => {
    const con5 = servicio({ tramos: 5 });
    await con5.s.generar(CTX, 'c1', 'p1');
    const con25 = servicio({ tramos: 25 });
    await con25.s.generar(CTX, 'c1', 'p1');
    expect(con25.consultas()).toBe(con5.consultas());
  });

  it('una plantilla de texto del editor anterior no genera: pide el Word', async () => {
    const { s } = servicio({ plantilla: { nombre: 'Vieja', archivo: null } });
    await expect(s.generar(CTX, 'c1', 'p1')).rejects.toThrow(/subí la versión en Word/);
  });
});

describe('PlantillasService · subir una plantilla', () => {
  it('la guarda en el bucket de los contratos, bajo la carpeta de la inmobiliaria', async () => {
    const { s, storage, tx } = servicio();
    const dto = await s.crear(
      CTX,
      { nombre: 'Locación', tipoContrato: 'vivienda' },
      archivo(PLANTILLA, 'Contrato PeÃ±a.docx'),
    );
    const [bucket, clave] = storage.uploadPrivado.mock.calls[0]!;
    expect(bucket).toBe('alquileres-contratos');
    expect(clave).toMatch(
      new RegExp(`^${CTX.tenantId}/plantillas/[0-9a-f-]{36}/[0-9a-f-]{36}\\.docx$`),
    );
    expect(tx.alqPlantilla.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: CTX.tenantId,
          nombre: 'Locación',
          archivo: clave,
          nombreArchivo: 'Contrato Peña.docx',
          tamano: PLANTILLA.length,
        }),
      }),
    );
    expect(dto.formato).toBe('word');
  });

  it('un marcador desconocido la rechaza antes de subir nada, nombrándolo', async () => {
    const { s, storage } = servicio();
    const intento = s.crear(
      CTX,
      { nombre: 'X', tipoContrato: null },
      archivo(docx(['{inquilinos.texto} {deposto} {#tramos}{nombre}{/tramos}'])),
    );
    await expect(intento).rejects.toBeInstanceOf(BadRequestException);
    const err = (await intento.catch((e: BadRequestException) => e)) as BadRequestException;
    expect(err.getResponse()).toEqual({
      message: expect.stringMatching(/^La plantilla tiene 2 problemas:\n• «\{deposto\}»/),
      details: [
        '«{deposto}» no es un marcador conocido. ¿Quisiste decir {deposito}?',
        '«{nombre}» solo se puede usar adentro de {#propietarios}…{/propietarios}, {#inquilinos}…{/inquilinos}, {#garantes}…{/garantes}.',
      ],
    });
    expect(storage.uploadPrivado).not.toHaveBeenCalled();
  });

  it('un archivo que no es Word se rechaza aunque se llame .docx', async () => {
    const { s, storage } = servicio();
    await expect(
      s.crear(CTX, { nombre: 'X', tipoContrato: null }, archivo(Buffer.from('%PDF-1.7'))),
    ).rejects.toThrow('El archivo no es un Word (.docx). Abrilo en Word y guardalo como .docx.');
    expect(storage.uploadPrivado).not.toHaveBeenCalled();
  });

  it('si la base falla, el archivo recién subido se borra', async () => {
    const { s, tx, storage } = servicio();
    tx.alqPlantilla.create.mockRejectedValueOnce(new Error('caída'));
    await expect(
      s.crear(CTX, { nombre: 'X', tipoContrato: null }, archivo(PLANTILLA)),
    ).rejects.toThrow('caída');
    expect(storage.remove).toHaveBeenCalledWith(
      'alquileres-contratos',
      storage.uploadPrivado.mock.calls[0]![1],
    );
  });

  it('reemplazar el Word sube uno nuevo, borra el anterior y deja de ser de texto', async () => {
    const { s, tx, storage } = servicio();
    await s.reemplazarArchivo(CTX, 'p1', archivo(PLANTILLA));
    expect(tx.alqPlantilla.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cuerpo: null }) }),
    );
    expect(storage.remove).toHaveBeenCalledWith(
      'alquileres-contratos',
      `${CTX.tenantId}/plantillas/p1/viejo.docx`,
    );
  });

  it('borrar la plantilla borra su Word', async () => {
    const { s, storage } = servicio();
    await s.borrar('p1');
    expect(storage.remove).toHaveBeenCalledWith(
      'alquileres-contratos',
      `${CTX.tenantId}/plantillas/p1/viejo.docx`,
    );
  });

  it('la lista distingue las de Word de las de texto del editor anterior', async () => {
    const { s } = servicio();
    expect((await s.listar()).map((p) => p.formato)).toEqual(['word', 'texto']);
  });
});

describe('nombreDelArchivo', () => {
  it('arregla el nombre que Multer leyó como latin1, y deja el que ya está bien', () => {
    expect(nombreDelArchivo('Contrato PeÃ±a.docx')).toBe('Contrato Peña.docx');
    expect(nombreDelArchivo('Contrato.docx')).toBe('Contrato.docx');
    expect(nombreDelArchivo('Peña.docx')).toBe('Peña.docx');
  });
});

describe('POST /alquileres/contratos/:id/generar-desde-plantilla', () => {
  it('responde un Word para descargar, con el nombre del contrato', async () => {
    const plantillas = {
      generar: vi.fn().mockResolvedValue({ buffer: PLANTILLA, nombre: 'Contrato-ALT-0011.docx' }),
    };
    const controller = new ContratosController(
      {} as ContratosService,
      {} as HistorialService,
      {} as ContratoCompletoService,
      plantillas as unknown as PlantillasService,
    );
    const res = await controller.generarDesdePlantilla('c1', { plantillaId: 'p1' }, {
      userId: CTX.userId,
      tenantId: CTX.tenantId,
    } as never);
    const { type, disposition } = res.getHeaders();
    expect(type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(disposition).toContain('attachment; filename="Contrato-ALT-0011.docx"');
  });
});
