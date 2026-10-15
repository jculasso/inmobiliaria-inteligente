import { describe, expect, it } from 'vitest';
import {
  ConfiguracionAlquileresSchema,
  ContratoDtoSchema,
  ContratoInputSchema,
  CorregirImporteTramoSchema,
  defectosDeContrato,
} from './alquileres';
import { TenantConfigSchema, alicuotaDeSellado, selladoDeLaInmobiliaria } from './tenant';

/*
 * Entrega A para Vacker (Florencia, 15/10/2026): reglas 99 a 111 de
 * docs/specs/alquileres-fase-1.md. Lo que se prueba acá es la forma y la
 * traducción de lo guardado antes; las cuentas están en @vacker/domain.
 */

describe('regla 99: lo que se propone en un contrato nuevo', () => {
  it('una inmobiliaria que no configuró nada ve lo mismo que antes (8%, 2%, sin punitorio, días 5 y 10)', () => {
    const c = TenantConfigSchema.parse({});
    expect({
      honorarios: c.contratoHonorariosPct,
      gastos: c.contratoGastosAdmPct,
      punitorio: c.contratoPunitorioDiarioPct,
      vence: c.contratoDiaVencimiento,
      paga: c.contratoDiaPagoPropietario,
    }).toEqual({ honorarios: 8, gastos: 2, punitorio: 0, vence: 5, paga: 10 });
  });

  it('los valores de Vacker se guardan y se proponen tal cual', () => {
    const config = ConfiguracionAlquileresSchema.parse({
      ivaHonorariosPct: 21,
      comisionInicialPct: 5,
      comisionInicialCuotas: 2,
      comisionInicialConIva: true,
      selladoInquilinoPct: 100,
      depositoGestion: 'entrega_propietario',
      contratoHonorariosPct: 8,
      contratoGastosAdmPct: 2,
      contratoPunitorioDiarioPct: 0.3,
      contratoDiaVencimiento: 5,
      contratoDiaPagoPropietario: 10,
    });
    expect(defectosDeContrato(config)).toEqual({
      honorariosPct: 8,
      gastosAdmPct: 2,
      punitorioDiarioPct: 0.3,
      diaVencimiento: 5,
      diaPagoPropietario: 10,
    });
  });

  it('la respuesta de una API anterior, sin los campos nuevos, se sigue leyendo', () => {
    // La web sale antes que la API: unos minutos, la API vieja contesta así.
    const vieja = ConfiguracionAlquileresSchema.safeParse({
      ivaHonorariosPct: 21,
      comisionInicialPct: 5,
      comisionInicialCuotas: 2,
      comisionInicialConIva: true,
      selladoPct: 0,
      selladoInquilinoPct: 50,
      depositoGestion: 'entrega_propietario',
    });
    expect(vieja.success).toBe(true);
  });

  it('un día de vencimiento después del 28 no se acepta: no existe en todos los meses', () => {
    expect(TenantConfigSchema.safeParse({ contratoDiaVencimiento: 30 }).success).toBe(false);
  });
});

describe('regla 103: el sellado por tipo de contrato y MiPyme', () => {
  it('sin configurar: particular exento, comercial 1%, comercial MiPyme 0,25%, todo a cargo del inquilino', () => {
    expect(selladoDeLaInmobiliaria(TenantConfigSchema.parse({}))).toEqual({
      viviendaPct: 0,
      comercialPct: 1,
      comercialMipymePct: 0.25,
      inquilinoPct: 100,
    });
  });

  it('una alícuota única guardada antes y mayor que cero se conserva para los tres, con su reparto', () => {
    expect(
      selladoDeLaInmobiliaria(
        TenantConfigSchema.parse({ selladoPct: 1.2, selladoInquilinoPct: 50 }),
      ),
    ).toEqual({ viviendaPct: 1.2, comercialPct: 1.2, comercialMipymePct: 1.2, inquilinoPct: 50 });
  });

  it('una alícuota vieja en cero (no se calculaba) deja regir la regla, y su reparto no cuenta', () => {
    expect(
      selladoDeLaInmobiliaria(TenantConfigSchema.parse({ selladoPct: 0, selladoInquilinoPct: 50 })),
    ).toEqual({ viviendaPct: 0, comercialPct: 1, comercialMipymePct: 0.25, inquilinoPct: 100 });
  });

  it('lo configurado con los campos nuevos manda sobre todo lo anterior', () => {
    expect(
      selladoDeLaInmobiliaria(
        TenantConfigSchema.parse({
          selladoPct: 1.2,
          selladoViviendaPct: 0.5,
          selladoComercialPct: 1.5,
          selladoComercialMipymePct: 0.3,
          selladoInquilinoPct: 70,
        }),
      ),
    ).toEqual({ viviendaPct: 0.5, comercialPct: 1.5, comercialMipymePct: 0.3, inquilinoPct: 70 });
  });

  it('la alícuota de un contrato: el certificado MiPyme solo cuenta en un comercial', () => {
    const s = { viviendaPct: 0, comercialPct: 1, comercialMipymePct: 0.25 };
    expect(alicuotaDeSellado(s, 'vivienda', false)).toBe(0);
    expect(alicuotaDeSellado(s, 'vivienda', true)).toBe(0);
    expect(alicuotaDeSellado(s, 'comercial', false)).toBe(1);
    expect(alicuotaDeSellado(s, 'comercial', true)).toBe(0.25);
  });
});

describe('reglas 104 y 106: un contrato tomado en curso', () => {
  const base = {
    propiedadId: '11111111-1111-4111-8111-111111111111',
    inicio: '2025-01-01',
    fin: '2026-12-31',
    ajuste: 'indexado' as const,
    indice: 'ICL' as const,
    periodicidadMeses: 6,
    partes: [
      { personaId: '22222222-2222-4222-8222-222222222222', papel: 'propietario' as const },
      { personaId: '33333333-3333-4333-8333-333333333333', papel: 'inquilino' as const },
    ],
    tramos: [
      { numero: 1, desde: '2025-01-01', hasta: '2025-06-30', importe: null },
      { numero: 2, desde: '2025-07-01', hasta: '2025-12-31', importe: null },
      { numero: 3, desde: '2026-01-01', hasta: '2026-06-30', importe: 750_000 },
      { numero: 4, desde: '2026-07-01', hasta: '2026-12-31', importe: null },
    ],
  };
  const errores = (x: unknown) => {
    const r = ContratoInputSchema.safeParse(x);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it('alcanza con el alquiler vigente: los tramos de antes pueden quedar sin importe', () => {
    expect(errores({ ...base, administradoDesde: '2026-03-01' })).toEqual([]);
  });

  it('sin el alquiler vigente no se guarda, y el error nombra el tramo', () => {
    expect(
      errores({
        ...base,
        administradoDesde: '2026-03-01',
        tramos: base.tramos.map((t) => ({ ...t, importe: null })),
      }),
    ).toEqual(['Falta el alquiler vigente: el importe del tramo 3, el que corre el 01/03/2026.']);
  });

  it('un contrato que no está en curso sigue necesitando el importe del primer tramo', () => {
    expect(errores(base)).toEqual(['El primer tramo necesita su importe.']);
  });

  it('«administrado desde» va después del inicio y no después del fin', () => {
    const msg = '«Administrado desde» tiene que caer después del inicio y antes del fin.';
    expect(errores({ ...base, administradoDesde: '2025-01-01' })).toContain(msg);
    expect(errores({ ...base, administradoDesde: '2027-01-01' })).toContain(msg);
  });

  it('una ficha de una API anterior, sin los campos nuevos, se sigue leyendo', () => {
    const r = ContratoDtoSchema.shape.administradoDesde.safeParse(undefined);
    expect(r.success && r.data).toBeNull();
    expect(ContratoDtoSchema.shape.inquilinoMipyme.parse(undefined)).toBe(false);
  });
});

describe('regla 108: corregir el importe pide importe, mes y motivo', () => {
  it('el motivo es obligatorio', () => {
    expect(
      CorregirImporteTramoSchema.safeParse({ importe: 450_000, desde: '2026-11', motivo: '' })
        .success,
    ).toBe(false);
    expect(
      CorregirImporteTramoSchema.safeParse({
        importe: 450_000,
        desde: '2026-11',
        motivo: 'Lo negociaron las partes',
      }).success,
    ).toBe(true);
  });

  it('un importe en cero o un mes mal escrito no se aceptan', () => {
    expect(
      CorregirImporteTramoSchema.safeParse({ importe: 0, desde: '2026-11', motivo: 'acuerdo' })
        .success,
    ).toBe(false);
    expect(
      CorregirImporteTramoSchema.safeParse({ importe: 1, desde: '2026-13', motivo: 'acuerdo' })
        .success,
    ).toBe(false);
  });
});
