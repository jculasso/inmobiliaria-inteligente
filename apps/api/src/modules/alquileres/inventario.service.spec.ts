import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InventarioInputSchema, MARCADORES_PLANTILLA } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { InventarioService } from './inventario.service';
import { datosDePlantilla } from './plantilla-modelo';
import { plantillaDeEjemplo } from './plantilla-ejemplo';
import { completarPlantillaWord, problemasDePlantilla, textoDeDocx } from './plantilla-word';
import { contratoDePrueba, docx } from './plantilla-word.testing';

const CTX: TenantContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  roles: ['administracion'],
};

function servicio(contrato: {
  estado: string;
  inventario?: unknown;
  inventarioObs?: string | null;
}) {
  const tx = {
    ...mocksDeHistorial(),
    alqContrato: {
      findUnique: vi.fn(async () => ({
        codigo: 'ALT-0012',
        inventario: [],
        inventarioObs: null,
        ...contrato,
      })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        estado: contrato.estado,
        inventario: data.inventario,
        inventarioObs: data.inventarioObs,
      })),
    },
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  return { s: new InventarioService(db), tx };
}

const INVENTARIO = InventarioInputSchema.parse({
  items: [
    { descripcion: 'Cocina de 4 hornallas', cantidad: 1, estado: 'Funcionando' },
    { descripcion: 'Sillas de madera', cantidad: 4 },
    { descripcion: 'Cortinas roller' },
  ],
  observaciones: 'Las paredes se entregan recién pintadas.',
});

describe('Inventario del contrato (reglas 150 a 153)', () => {
  it('regla 150: se guarda entero y la cantidad, si no se indica, es 1', async () => {
    const { s, tx } = servicio({ estado: 'borrador' });
    const dto = await s.guardar(CTX, 'c1', INVENTARIO);
    expect(tx.alqContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: {
          inventario: [
            { descripcion: 'Cocina de 4 hornallas', cantidad: 1, estado: 'Funcionando' },
            { descripcion: 'Sillas de madera', cantidad: 4, estado: null },
            { descripcion: 'Cortinas roller', cantidad: 1, estado: null },
          ],
          inventarioObs: 'Las paredes se entregan recién pintadas.',
        },
      }),
    );
    expect(dto.items).toHaveLength(3);
    expect(dto.editable).toBe(true);
  });

  it('regla 150: un ítem sin descripción no se acepta', () => {
    const r = InventarioInputSchema.safeParse({ items: [{ descripcion: '  ', cantidad: 2 }] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe('Cada ítem del inventario lleva su descripción.');
  });

  it('regla 151: con el contrato vigente se sigue editando, y queda en el historial', async () => {
    const { s, tx } = servicio({ estado: 'vigente' });
    await s.guardar(CTX, 'c1', INVENTARIO);
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'contrato',
      contratoId: 'c1',
      accion: 'edicion',
      resumen: 'Inventario de ALT-0012: 3 ítems, con observaciones',
    });
  });

  it.each(['finalizado', 'rescindido', 'anulado'])(
    'regla 151: con el contrato %s ya no se edita',
    async (estado) => {
      const { s, tx } = servicio({ estado });
      await expect(s.guardar(CTX, 'c1', INVENTARIO)).rejects.toThrow(
        new BadRequestException(`El contrato está ${estado}: el inventario ya no se edita.`),
      );
      expect(tx.alqContrato.update).not.toHaveBeenCalled();
      expect((await s.obtener('c1')).editable).toBe(false);
    },
  );

  it('regla 153: la fila vieja se lee vacía, y algo que no se entiende no tira la ficha', async () => {
    expect(await servicio({ estado: 'vigente' }).s.obtener('c1')).toEqual({
      items: [],
      observaciones: null,
      editable: true,
    });
    const roto = servicio({ estado: 'vigente', inventario: { no: 'es una lista' } });
    expect((await roto.s.obtener('c1')).items).toEqual([]);
  });

  it('regla 152: los marcadores del inventario están en la lista única del contrato', () => {
    const nombres = MARCADORES_PLANTILLA.map((m) => m.nombre);
    expect(nombres).toContain('inventario');
    expect(nombres).toContain('contrato.inventario_observaciones');
    expect(
      problemasDePlantilla({
        buffer: docx(['{#inventario}{numero} {cantidad} {descripcion} {estado}{/inventario}']),
        originalname: 'C.docx',
        size: 100,
      }),
    ).toEqual([]);
    expect(
      problemasDePlantilla({
        buffer: docx(['{descripcion}']),
        originalname: 'C.docx',
        size: 100,
      }),
    ).toEqual(['«{descripcion}» solo se puede usar adentro de {#inventario}…{/inventario}.']);
  });

  it('regla 152: el Word lista cada ítem, y sin ítems aparece lo de {^inventario}', () => {
    const plantilla = docx([
      '{#inventario}',
      '{numero}. {cantidad} × {descripcion}. {estado}',
      '{/inventario}',
      '{^inventario}Sin inventario.{/inventario}',
      'Obs: {contrato.inventario_observaciones}',
    ]);
    const con = textoDeDocx(
      completarPlantillaWord(
        plantilla,
        datosDePlantilla(contratoDePrueba(), 'Alteva', '2026-10-15'),
      ),
    );
    expect(con).toContain('1. 1 × Cocina de 4 hornallas. Funcionando');
    expect(con).toContain('2. 4 × Sillas de madera. ');
    expect(con).not.toContain('Sin inventario.');
    expect(con).toContain('Obs: Las paredes se entregan recién pintadas.');

    const viejo = { ...contratoDePrueba(), inventario: [], inventarioObs: null };
    const sin = textoDeDocx(
      completarPlantillaWord(plantilla, datosDePlantilla(viejo, 'Alteva', '2026-10-15')),
    );
    expect(sin).toContain('Sin inventario.');
    expect(sin).not.toContain('Cocina');
  });

  it('regla 152: el Word de ejemplo trae la cláusula de inventario y lista los ítems', () => {
    const texto = textoDeDocx(
      completarPlantillaWord(
        plantillaDeEjemplo(),
        datosDePlantilla(contratoDePrueba(), 'Alteva', '2026-10-15'),
      ),
    );
    expect(texto).toContain('DÉCIMA · Inventario');
    expect(texto).toContain('1. 1 × Cocina de 4 hornallas. Funcionando');
  });
});
