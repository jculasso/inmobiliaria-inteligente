import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { FirmaService } from './firma/firma.service';
import { MODELO_BASE } from './plantilla-modelo';
import { PlantillasService } from './plantillas.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const contrato = {
  codigo: 'ALT-0090',
  tipo: 'vivienda',
  moneda: 'ARS',
  inicio: d('2026-03-01'),
  fin: d('2028-02-29'),
  ajuste: 'indexado',
  indice: 'ICL',
  periodicidadMeses: 4,
  diaVencimiento: 10,
  punitorioDiarioPct: new Prisma.Decimal(0.5),
  depositoImporte: new Prisma.Decimal(350_000),
  depositoMoneda: 'ARS',
  propiedad: { direccion: 'Bv. Oroño 1452', unidad: '4° B', ciudad: 'Rosario' },
  partes: [
    { papel: 'propietario', persona: { nombre: 'Juan Propietario', documento: '20123456', cuit: null, domicilio: 'Córdoba 1452', localidad: 'Rosario' } },
    { papel: 'inquilino', persona: { nombre: 'Ana Inquilina', documento: null, cuit: '27333444559', domicilio: null, localidad: null } },
  ],
  tramos: [
    { numero: 1, desde: d('2026-03-01'), hasta: d('2026-06-30'), importe: new Prisma.Decimal(350_000) },
    { numero: 2, desde: d('2026-07-01'), hasta: d('2026-10-31'), importe: null },
  ],
};

function servicio() {
  const tx = { alqContrato: { findUnique: vi.fn().mockResolvedValue(contrato) }, tenant: { findFirstOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva Propiedades' }) } };
  const db = { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
  return new PlantillasService(db, {} as FirmaService);
}

describe('PlantillasService (entrega 15)', () => {
  it('completa partes, importes en letras, ajuste y tramos', async () => {
    const t = await servicio().texto('c1', 'Entre {{propietarios}} y {{inquilinos}}. Precio {{alquiler.inicial}} ({{alquiler.inicial.letras}}), {{ajuste}}.\n{{tramos}}\nGarantes: {{garantes}}.');
    expect(t).toContain('Juan Propietario, DNI/CUIT 20.123.456, con domicilio en Córdoba 1452, Rosario');
    expect(t).toContain('Ana Inquilina, DNI/CUIT 27-33344455-9');
    expect(t).toContain('Precio $ 350.000,00 (pesos trescientos cincuenta mil)');
    expect(t).toContain("el Índice para Contratos de Locación (ICL) del BCRA, cada 4 meses");
    expect(t).toContain('- Tramo 2: del 01/07/2026 al 31/10/2026: según el índice');
    expect(t).toContain('Garantes: [sin cargar].');
  });

  it('el modelo base no deja variables sin completar', async () => {
    expect(await servicio().texto('c1', MODELO_BASE)).not.toContain('[falta:');
  });
});
