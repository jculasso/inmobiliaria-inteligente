import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  MARCADORES_ANEXO_INVENTARIO,
  MARCADORES_PLANTILLA,
  MARCADORES_POR_DOCUMENTO,
} from '@vacker/types';
import type { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { datosDePlantilla } from './plantilla-modelo';
import {
  anexoDeLaPlataforma,
  plantillaDeEjemplo,
  plantillaDeEjemploAnexo,
} from './plantilla-ejemplo';
import { completarPlantillaWord, problemasDePlantilla, textoDeDocx } from './plantilla-word';
import { contratoDePrueba, docx } from './plantilla-word.testing';
import { PlantillasService } from './plantillas.service';

const CTX: TenantContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  roles: ['administracion'],
};
const archivo = (buffer: Buffer) => ({
  buffer,
  mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  originalname: 'Anexo.docx',
  size: buffer.length,
});

// Regla 174 (Florencia, Vacker, 15/10/2026): «el inventario: lo mejor es que sea un apéndice del contrato».
describe('El anexo de inventario (regla 174)', () => {
  it('sus marcadores son los del contrato (los completa el mismo armado) y traen el inventario', () => {
    const datos = datosDePlantilla(contratoDePrueba(), 'Alteva', '2026-10-15');
    for (const m of MARCADORES_ANEXO_INVENTARIO) expect(Object.hasOwn(datos, m.nombre)).toBe(true);
    expect(MARCADORES_ANEXO_INVENTARIO.map((m) => m.nombre)).toEqual(
      expect.arrayContaining([
        'contrato.codigo',
        'propiedad.direccion',
        'propietarios.texto',
        'inquilinos.texto',
        'fecha.hoy',
        'inventario',
        'contrato.inventario_observaciones',
      ]),
    );
    expect(MARCADORES_POR_DOCUMENTO.inventario).toBe(MARCADORES_ANEXO_INVENTARIO);
  });

  it('un Word de anexo se revisa contra sus marcadores: el alquiler no es del anexo', () => {
    const word = docx(['Anexo {contrato.codigo}: {alquiler.inicial}']);
    expect(problemasDePlantilla(archivo(word), MARCADORES_ANEXO_INVENTARIO)).toEqual([
      '«{alquiler.inicial}» no es un marcador conocido.',
    ]);
  });

  it('el ejemplo es una plantilla válida y, completo, lista cada ítem con las partes', () => {
    const ejemplo = plantillaDeEjemploAnexo();
    expect(problemasDePlantilla(archivo(ejemplo), MARCADORES_ANEXO_INVENTARIO)).toEqual([]);
    expect(
      problemasDePlantilla(archivo(anexoDeLaPlataforma()), MARCADORES_ANEXO_INVENTARIO),
    ).toEqual([]);
    const texto = textoDeDocx(
      completarPlantillaWord(ejemplo, datosDePlantilla(contratoDePrueba(), 'Alteva', '2026-10-15')),
    );
    expect(texto).toContain('ANEXO DE INVENTARIO · CONTRATO ALT-0090');
    expect(texto).toContain('1. 1 × Cocina de 4 hornallas. Funcionando');
    expect(texto).toContain('Firma de LA PARTE LOCATARIA: Ana Inquilina');
    expect(texto).not.toContain('undefined');
  });

  describe('el texto que presenta la lista va una sola vez, no una por ítem', () => {
    const PRESENTACION =
      'LA PARTE LOCATARIA recibe, junto con el inmueble, los siguientes elementos';
    const SIN_INVENTARIO = 'El inmueble se entrega sin muebles ni elementos inventariados.';
    const veces = (texto: string, frase: string) => texto.split(frase).length - 1;
    const conItems = (
      inventario: { descripcion: string; cantidad: number; estado: string | null }[],
    ) => datosDePlantilla({ ...contratoDePrueba(), inventario }, 'Alteva', '2026-10-15');
    const TRES = [
      { descripcion: 'Cocina de 4 hornallas', cantidad: 1, estado: 'Funcionando' },
      { descripcion: 'Sillas de madera', cantidad: 4, estado: null },
      { descripcion: 'Heladera con freezer', cantidad: 1, estado: 'Sin el estante de abajo' },
    ];

    it.each([
      ['el anexo de la plataforma', anexoDeLaPlataforma, MARCADORES_ANEXO_INVENTARIO],
      ['el ejemplo del anexo', plantillaDeEjemploAnexo, MARCADORES_ANEXO_INVENTARIO],
      ['la DÉCIMA del contrato de ejemplo', plantillaDeEjemplo, MARCADORES_PLANTILLA],
    ])('%s: con 3 ítems, la frase una vez y los 3 renglones', (_, plantilla, marcadores) => {
      expect(problemasDePlantilla(archivo(plantilla()), marcadores)).toEqual([]);
      const texto = textoDeDocx(completarPlantillaWord(plantilla(), conItems(TRES)));
      expect(veces(texto, PRESENTACION)).toBe(1);
      expect(texto).toContain('1. 1 × Cocina de 4 hornallas. Funcionando');
      expect(texto).toContain('2. 4 × Sillas de madera.');
      expect(texto).toContain('3. 1 × Heladera con freezer. Sin el estante de abajo');
      expect(veces(texto, SIN_INVENTARIO)).toBe(0);
    });

    it.each([
      ['el anexo de la plataforma', anexoDeLaPlataforma],
      ['la DÉCIMA del contrato de ejemplo', plantillaDeEjemplo],
    ])('%s: sin ítems, sin la frase y con el texto de «sin inventario»', (_, plantilla) => {
      const texto = textoDeDocx(completarPlantillaWord(plantilla(), conItems([])));
      expect(veces(texto, PRESENTACION)).toBe(0);
      expect(veces(texto, SIN_INVENTARIO)).toBe(1);
    });
  });

  function servicio(over: { plantilla?: object | null; estado?: string } = {}) {
    const tx = {
      ...mocksDeHistorial(),
      alqPlantilla: {
        findUnique: vi.fn().mockResolvedValue(
          over.plantilla === undefined
            ? {
                nombre: 'Anexo Vacker',
                archivo: `${CTX.tenantId}/plantillas/p7/anexo.docx`,
                documento: 'inventario',
              }
            : over.plantilla,
        ),
      },
      alqContrato: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...contratoDePrueba(), estado: over.estado ?? 'vigente' }),
      },
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva Propiedades' }) },
    };
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as TenantPrismaService;
    const storage = {
      descargarPrivado: vi.fn().mockResolvedValue(plantillaDeEjemploAnexo()),
      uploadPrivado: vi.fn(),
      remove: vi.fn(),
    };
    return {
      s: new PlantillasService(db, storage as unknown as SupabaseStorageService),
      tx,
      storage,
    };
  }

  it('sin plantilla de anexo, sale con el modelo de la plataforma y queda en el historial', async () => {
    const { s, tx, storage } = servicio();
    const { nombre, buffer } = await s.generarAnexo(CTX, 'c1', null);
    expect(nombre).toBe('Anexo-inventario-ALT-0090.docx');
    const texto = textoDeDocx(buffer);
    expect(texto).toContain('ANEXO DE INVENTARIO · CONTRATO ALT-0090');
    expect(texto).toContain('2. 4 × Sillas de madera.');
    expect(texto).not.toContain('Cómo se escriben');
    expect(storage.descargarPrivado).not.toHaveBeenCalled();
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'contrato',
      contratoId: 'c1',
      accion: 'documento',
      resumen: 'Anexo de inventario en Word generado con el modelo de la plataforma',
    });
  });

  it('con la plantilla de anexo de la inmobiliaria, sale con la suya', async () => {
    const { s, storage } = servicio();
    await s.generarAnexo(CTX, 'c1', '33333333-3333-4333-8333-333333333333');
    expect(storage.descargarPrivado).toHaveBeenCalledWith(
      'alquileres-contratos',
      `${CTX.tenantId}/plantillas/p7/anexo.docx`,
    );
  });

  it('una plantilla de contrato no sirve de anexo, ni el anexo de contrato; un contrato anulado no tiene anexo', async () => {
    const deContrato = servicio({
      plantilla: { nombre: 'Contrato', archivo: 'x.docx', documento: 'contrato' },
    });
    await expect(deContrato.s.generarAnexo(CTX, 'c1', 'p')).rejects.toThrow(
      new BadRequestException('Es una plantilla de contrato: se usa desde el contrato.'),
    );
    const anexoComoContrato = servicio();
    await expect(anexoComoContrato.s.generar(CTX, 'c1', 'p7')).rejects.toThrow(
      /Es una plantilla de anexo de inventario/,
    );
    const anulado = servicio({ estado: 'anulado' });
    await expect(anulado.s.generarAnexo(CTX, 'c1', null)).rejects.toThrow(
      'El contrato está anulado: no se genera su anexo.',
    );
  });
});
