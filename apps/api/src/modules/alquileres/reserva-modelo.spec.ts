import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { MARCADORES_RESERVA, PlantillaMetadatosSchema } from '@vacker/types';
import type { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { plantillaDeEjemploReserva } from './plantilla-ejemplo';
import { completarPlantillaWord, problemasDePlantilla, textoDeDocx } from './plantilla-word';
import { docx } from './plantilla-word.testing';
import { PlantillasService } from './plantillas.service';
import { datosDeReserva, type ReservaParaPlantilla } from './reserva-modelo';

const CTX: TenantContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  roles: ['administracion'],
};
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const persona = (
  nombre: string,
  extra: Partial<ReservaParaPlantilla['partes'][number]['persona']> = {},
) => ({
  nombre,
  documento: null,
  cuit: null,
  domicilio: null,
  localidad: null,
  telefono: null,
  email: null,
  ...extra,
});

/** Una reserva con todo: interesada, propietario, garante, seña en dólares y condiciones. */
function reservaDePrueba(garantes = 1): ReservaParaPlantilla {
  return {
    numero: 12,
    fecha: d('2026-10-15'),
    vence: d('2026-10-22'),
    obs: 'Ingresa con una mascota.',
    senaImporte: new Prisma.Decimal(500),
    senaMoneda: 'USD',
    // Cobrada, con el recibo 000123 (regla 169).
    conceptos: [
      {
        id: 'k-sena',
        sentido: 'a_cobrar',
        importe: new Prisma.Decimal(500),
        moneda: 'USD',
        personaId: 'ana',
        contratoId: null,
        cobro: { id: 'c-sena', numero: 123, fecha: d('2026-10-15'), medio: 'transferencia' },
      },
    ],
    tipo: 'vivienda',
    moneda: 'ARS',
    alquilerInicial: new Prisma.Decimal(600_000),
    inicio: d('2026-11-01'),
    duracionMeses: 24,
    ajuste: 'indexado',
    indice: 'ICL',
    periodicidadMeses: 3,
    depositoImporte: new Prisma.Decimal(600),
    depositoMoneda: 'USD',
    propiedad: { direccion: 'Bv. Oroño 1452', unidad: '4° B', ciudad: 'Rosario' },
    partes: [
      {
        papel: 'inquilino',
        personaId: 'ana',
        persona: persona('Ana Interesada', {
          cuit: '27333444559',
          domicilio: 'San Luis 820',
          localidad: 'Rosario',
          telefono: '341 555-1234',
          email: 'ana@mail.com',
        }),
      },
      { papel: 'propietario', personaId: 'juan', persona: persona('Juan Propietario') },
      ...Array.from({ length: garantes }, (_, i) => ({
        papel: 'garante',
        personaId: `g${i}`,
        persona: persona(i === 0 ? 'Carlos Garante' : `Garante ${i}`, { documento: '22333444' }),
      })),
    ],
    garantias: Array.from({ length: garantes }, (_, i) => ({
      tipo: 'propietaria',
      garante: null,
      personaId: `g${i}`,
      detalle: 'Mendoza 900, Rosario',
      estado: 'aprobada',
    })),
  };
}

const datos = (r = reservaDePrueba()) => datosDeReserva(r, 'Alteva Propiedades', '2026-10-15');

describe('MARCADORES_RESERVA y los datos de la reserva (regla 162: una sola lista)', () => {
  it.each(MARCADORES_RESERVA.map((m) => [m.nombre, m] as const))(
    '«%s» lo completa el armado de datos',
    (nombre, m) => {
      const x = datos();
      expect(Object.hasOwn(x, nombre)).toBe(true);
      const valor = x[nombre];
      if (m.tipo === 'texto') expect(typeof valor).toBe('string');
      if (m.tipo === 'condicion') expect(typeof valor).toBe(m.campos ? 'object' : 'boolean');
      if (m.tipo === 'lista') {
        expect(Array.isArray(valor)).toBe(true);
        expect((valor as unknown[]).length).toBeGreaterThan(0);
      }
      for (const item of m.tipo === 'lista' ? (valor as object[]) : m.campos ? [valor] : []) {
        expect(Object.keys(item as object).sort()).toEqual(
          (m.campos ?? []).map((c) => c.nombre).sort(),
        );
        for (const v of Object.values(item as object)) expect(typeof v).toBe('string');
      }
    },
  );

  it('no completa ningún dato que la lista no nombre', () => {
    expect(Object.keys(datos()).sort()).toEqual(MARCADORES_RESERVA.map((m) => m.nombre).sort());
  });

  it('cada marcador tiene descripción y ejemplo, y los nombres no se repiten', () => {
    const nombres = MARCADORES_RESERVA.map((m) => m.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const m of MARCADORES_RESERVA) {
      expect(m.descripcion).not.toBe('');
      expect(m.ejemplo).not.toBe('');
    }
  });
});

describe('datosDeReserva (regla 163)', () => {
  it('la seña, las condiciones y el fin propuesto (inicio + duración − 1 día)', () => {
    const x = datos();
    expect(x).toMatchObject({
      'reserva.numero': '12',
      'reserva.vence': '22/10/2026',
      'interesado.nombre': 'Ana Interesada',
      'interesado.documento': '27-33344455-9',
      'interesado.domicilio': 'San Luis 820, Rosario',
      'sena.importe': 'U$S 500,00',
      'sena.fecha': '15/10/2026',
      'sena.medio': 'transferencia',
      'sena.recibo': '000123',
      'contrato.inicio': '01/11/2026',
      'contrato.fin': '31/10/2028',
      'alquiler.inicial': '$ 600.000,00',
      ajuste: 'el Índice para Contratos de Locación (ICL) del BCRA, cada 3 meses',
      'deposito.importe': 'U$S 600,00',
      sena_recibida: true,
      garantias: [
        {
          tipo: 'Propietaria',
          garante: 'Carlos Garante',
          detalle: 'Mendoza 900, Rosario',
          estado: 'aprobada',
        },
      ],
    });
  });

  it('una condición sin cargar dice «[a definir]»; lo opcional que falta queda vacío', () => {
    const r = {
      ...reservaDePrueba(),
      alquilerInicial: null,
      inicio: null,
      duracionMeses: null,
      indice: null,
      senaImporte: null,
      conceptos: [],
      depositoImporte: null,
      obs: null,
    };
    const x = datos(r);
    expect(x).toMatchObject({
      'contrato.inicio': '[a definir]',
      'contrato.fin': '[a definir]',
      'contrato.meses': '[a definir]',
      'alquiler.inicial': '[a definir]',
      ajuste: '[a definir]',
      'sena.importe': '',
      'sena.fecha': '',
      'deposito.importe': '',
      'reserva.observaciones': '',
      sena: null,
      sena_recibida: false,
      deposito: null,
    });
  });
});

describe('Plantillas de reserva (reglas 162 y 163)', () => {
  const archivo = (buffer: Buffer, originalname = 'Reserva.docx') => ({
    buffer,
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    originalname,
    size: buffer.length,
  });

  it('regla 162: un Word de reserva se revisa contra SUS marcadores', () => {
    const word = docx(['Reserva {reserva.numero} de {interesado.nombre}: {contrato.codigo}']);
    expect(problemasDePlantilla(archivo(word), MARCADORES_RESERVA)).toEqual([
      '«{contrato.codigo}» no es un marcador conocido.',
    ]);
    // Y al revés: el contrato no conoce `{reserva.numero}`.
    expect(problemasDePlantilla(archivo(word))).toContain(
      '«{reserva.numero}» no es un marcador conocido.',
    );
  });

  it('regla 162: «documento» llega vacío del formulario y vale contrato', () => {
    expect(PlantillaMetadatosSchema.parse({ nombre: 'X', documento: '' }).documento).toBe(
      'contrato',
    );
    expect(PlantillaMetadatosSchema.parse({ nombre: 'X', documento: 'reserva' }).documento).toBe(
      'reserva',
    );
  });

  it('regla 163: el ejemplo de reserva es una plantilla válida y se completa entero', () => {
    const ejemplo = plantillaDeEjemploReserva();
    expect(problemasDePlantilla(archivo(ejemplo), MARCADORES_RESERVA)).toEqual([]);
    const texto = textoDeDocx(completarPlantillaWord(ejemplo, datos()));
    expect(texto).toContain('RESERVA DE LOCACIÓN N.º 12');
    expect(texto).toContain('EL INTERESADO entrega U$S 500,00');
    expect(texto).toContain('Recibida el 15/10/2026 por transferencia, recibo 000123.');
    expect(texto).toContain('de propiedad de Juan Propietario');
    expect(texto).toContain('Garantía Propietaria: Carlos Garante. Mendoza 900, Rosario');
    expect(texto).not.toContain('undefined');
  });

  function servicio(over: { plantilla?: object; reserva?: object | null; garantes?: number } = {}) {
    const tx = {
      ...mocksDeHistorial(),
      alqPlantilla: {
        findUnique: vi.fn().mockResolvedValue({
          nombre: 'Reserva Vacker',
          archivo: `${CTX.tenantId}/plantillas/p9/reserva.docx`,
          documento: 'reserva',
          ...over.plantilla,
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'p9',
          tipoContrato: null,
          tamano: 1,
          nombreArchivo: 'R.docx',
          updatedAt: new Date(),
          ...data,
        })),
      },
      alqReserva: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            over.reserva === undefined
              ? { ...reservaDePrueba(over.garantes ?? 1), estado: 'aprobada' }
              : over.reserva,
          ),
      },
      alqContrato: { findUnique: vi.fn().mockResolvedValue({ codigo: 'X' }) },
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva Propiedades' }) },
    };
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as TenantPrismaService;
    const storage = {
      uploadPrivado: vi.fn(async (_b: string, path: string) => path),
      descargarPrivado: vi.fn().mockResolvedValue(plantillaDeEjemploReserva()),
      remove: vi.fn(),
    };
    const s = new PlantillasService(db, storage as unknown as SupabaseStorageService);
    const consultas = () =>
      [
        tx.alqPlantilla.findUnique,
        tx.alqReserva.findUnique,
        tx.tenant.findUniqueOrThrow,
        tx.usuario.findUnique,
        tx.alqEvento.createMany,
      ].reduce((n, f) => n + f.mock.calls.length, 0);
    return { s, tx, storage, consultas };
  }

  it('regla 162: se sube como plantilla de reserva y un marcador de contrato la rechaza', async () => {
    const { s, storage, tx } = servicio();
    const ok = await s.crear(
      CTX,
      { nombre: 'Reserva', tipoContrato: null, documento: 'reserva' },
      archivo(plantillaDeEjemploReserva()),
    );
    expect(ok.documento).toBe('reserva');
    expect(tx.alqPlantilla.create.mock.calls[0]![0].data).toMatchObject({ documento: 'reserva' });
    storage.uploadPrivado.mockClear();
    await expect(
      s.crear(
        CTX,
        { nombre: 'Mal', tipoContrato: null, documento: 'reserva' },
        archivo(docx(['{contrato.codigo}'])),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.uploadPrivado).not.toHaveBeenCalled();
  });

  it('regla 163: «Descargar la reserva en Word» se llama Reserva-<n>.docx y queda en su historial', async () => {
    const { s, tx, storage } = servicio();
    const { nombre, buffer } = await s.generarReserva(CTX, 'r1', 'p9', '2026-10-15');
    expect(nombre).toBe('Reserva-12.docx');
    expect(textoDeDocx(buffer)).toContain('RESERVA DE LOCACIÓN N.º 12');
    expect(tx.alqEvento.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entidad: 'reserva',
          entidadId: 'r1',
          accion: 'documento',
          resumen: 'Reserva 12 en Word generada desde la plantilla «Reserva Vacker»',
        }),
      ],
    });
    expect(storage.uploadPrivado).not.toHaveBeenCalled();
  });

  it('regla 162: una plantilla de contrato no genera la reserva, ni una de reserva el contrato', async () => {
    const { s } = servicio({ plantilla: { documento: 'contrato' } });
    await expect(s.generarReserva(CTX, 'r1', 'p9')).rejects.toThrow(/Es una plantilla de contrato/);
    const otro = servicio();
    await expect(otro.s.generar(CTX, 'c1', 'p9')).rejects.toThrow(/Es una plantilla de reserva/);
  });

  it('regla 163: una reserva anulada no genera su Word', async () => {
    const { s } = servicio({ reserva: { ...reservaDePrueba(), estado: 'anulada' } });
    await expect(s.generarReserva(CTX, 'r1', 'p9')).rejects.toThrow(
      'La reserva está anulada: no se genera su Word.',
    );
  });

  it('regla 168: las mismas consultas con 1 garante o con 25', async () => {
    const uno = servicio({ garantes: 1 });
    await uno.s.generarReserva(CTX, 'r1', 'p9', '2026-10-15');
    const muchos = servicio({ garantes: 25 });
    await muchos.s.generarReserva(CTX, 'r1', 'p9', '2026-10-15');
    expect(muchos.consultas()).toBe(uno.consultas());
  });
});
