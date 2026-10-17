import { describe, expect, it } from 'vitest';
import {
  ConfiguracionAlquileresSchema,
  TableroAlquileresDtoSchema,
  type CicloDelMes,
} from './alquileres';
import { compactarTableros, expandirTableros } from './tablero-alquileres-compacto';
import { TenantConfigSchema } from './tenant';

/*
 * Dashboard en tres bloques (17/10/2026): reglas 178 y 181 de
 * docs/specs/alquileres-fase-1.md. Acá, la forma: el día del aviso en la
 * configuración y lo que el tablero suma (la línea del mes y las tareas de
 * generar), con sus defaults por el orden de despliegue.
 */

/** Lo mínimo de un corte del tablero, como lo mandaba la API antes del 17/10/2026. */
const corteViejo = {
  hoy: '2026-10-15',
  mes: '2026-10',
  cartera: { vigentes: { valor: 0, filas: [] }, vivienda: 0, comercial: 0, alquilerMensual: [] },
  cobranza: [],
  morosidad: [],
  evolucion: [],
  ingresos: [],
  tareas: {
    indexacionesVencidas: { valor: 0, filas: [] },
    indexacionesProximas: { valor: 0, filas: [] },
    vencen: [],
    depositos: { valor: 0, filas: [] },
    liquidaciones: { valor: 0, filas: [] },
    deudores: { valor: 0, filas: [] },
  },
};

const OCTUBRE: CicloDelMes = {
  mes: '2026-10',
  vencimiento: { dia: 5, fecha: '2026-10-05', motivo: null },
  pagoPropietarios: { dia: 10, fecha: '2026-10-13', motivo: 'el 10 fue sábado y el 12 feriado' },
  generarSiguiente: { dia: 25, fecha: '2026-10-26', motivo: 'el 25 es domingo', mes: '2026-11' },
};

describe('regla 181: el día del aviso de generar el mes siguiente', () => {
  it('regla 181: una inmobiliaria que no lo configuró avisa desde el 25', () => {
    expect(TenantConfigSchema.parse({}).diaAvisoGenerar).toBe(25);
  });

  it('regla 181: va del 1 al 28, como los otros días: el 29 no existe en febrero', () => {
    expect(TenantConfigSchema.safeParse({ diaAvisoGenerar: 1 }).success).toBe(true);
    expect(TenantConfigSchema.safeParse({ diaAvisoGenerar: 28 }).success).toBe(true);
    expect(TenantConfigSchema.safeParse({ diaAvisoGenerar: 0 }).success).toBe(false);
    expect(TenantConfigSchema.safeParse({ diaAvisoGenerar: 29 }).success).toBe(false);
    expect(TenantConfigSchema.safeParse({ diaAvisoGenerar: 12.5 }).success).toBe(false);
  });

  it('regla 181: la configuración de una API anterior, sin el día, se lee con el 25', () => {
    const vieja = ConfiguracionAlquileresSchema.parse({
      ivaHonorariosPct: 21,
      comisionInicialPct: 5,
      comisionInicialCuotas: 2,
      comisionInicialConIva: true,
      selladoInquilinoPct: 100,
      depositoGestion: 'entrega_propietario',
    });
    expect(vieja.diaAvisoGenerar).toBe(25);
    expect(ConfiguracionAlquileresSchema.safeParse({ ...vieja, diaAvisoGenerar: 30 }).success).toBe(
      false,
    );
  });
});

describe('regla 178: la línea del mes viaja con el tablero', () => {
  it('regla 178: un tablero de una API anterior, sin la línea ni las tareas de generar, se lee', () => {
    const t = TableroAlquileresDtoSchema.parse(corteViejo);
    expect(t.ciclo).toBeNull();
    expect(t.tareas.generarMes).toEqual({ valor: 0, filas: [] });
    // El mes siguiente no existe todavía: ni siquiera en «Al día».
    expect(t.tareas.generarSiguiente).toBeNull();
  });

  it('regla 178: octubre de 2026, con el pago corrido por el sábado y el feriado', () => {
    const t = TableroAlquileresDtoSchema.parse({ ...corteViejo, ciclo: OCTUBRE });
    expect(t.ciclo).toEqual(OCTUBRE);
  });

  it('regla 178: una fecha que no es una fecha no pasa', () => {
    const malo = { ...OCTUBRE, vencimiento: { dia: 5, fecha: '5/10/2026', motivo: null } };
    expect(TableroAlquileresDtoSchema.safeParse({ ...corteViejo, ciclo: malo }).success).toBe(
      false,
    );
  });

  it('regla 175: la línea y las tareas de generar llegan iguales en la forma compacta', () => {
    const generar = {
      valor: 1,
      filas: [
        {
          id: 'c1|2026-10',
          href: '/alquileres/contratos/c1',
          contrato: 'ALT-0001',
          persona: null,
          detalle: 'Alquiler de octubre de 2026',
          fecha: null,
          importe: null,
          estado: 'Sin generar',
        },
      ],
    };
    const corte = TableroAlquileresDtoSchema.parse({
      ...corteViejo,
      ciclo: OCTUBRE,
      tareas: { ...corteViejo.tareas, generarMes: generar, generarSiguiente: generar },
    });
    const tres = { todos: corte, vivienda: corte, comercial: corte };
    expect(expandirTableros(compactarTableros(tres))).toEqual(tres);
  });
});
