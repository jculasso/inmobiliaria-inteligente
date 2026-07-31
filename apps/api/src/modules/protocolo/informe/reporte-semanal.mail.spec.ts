import { describe, expect, it } from 'vitest';
import type { ReporteSemanal } from '@vacker/types';
import { armarMailDelReporte } from './reporte-semanal.mail';
import { slugDeTenant } from './reporte-semanal-mail.service';

const APP = 'https://app.inmobiliariainteligente.net';

function reporte(over: Partial<ReporteSemanal> = {}): ReporteSemanal {
  return {
    generadoEl: '2026-07-30',
    resumen: {
      activas: 4,
      conRojas: 0,
      autorizacionesEnRiesgo: 0,
      listasParaCierre: 0,
      listasConPendientes: 0,
    },
    hayUrgencias: false,
    urgencias: [],
    porVendedor: [
      {
        vendedorId: '22222222-2222-4222-8222-222222222222',
        vendedorNombre: 'Antonella Rossi',
        conRojas: 0,
        propiedades: [
          {
            protocoloId: '11111111-1111-4111-8111-111111111111',
            direccion: 'Belgrano 2087',
            fotoUrl: null,
            precio: 145000,
            moneda: 'USD',
            fechaInicio: '2026-06-18',
            diasTranscurridos: 43,
            semanaActual: 5,
            prioridad: 'verde',
            listoParaCierre: false,
            pendientesArrastrados: 0,
            alertasGenerales: [],
            semanas: [1, 2, 3, 4, 5].map((semana) => ({
              semana,
              estado: 'completa' as const,
              atrasadas: 0,
              pendientes: 0,
              alertas: [],
            })),
          },
        ],
      },
    ],
    ...over,
  };
}

const conUrgencia = () =>
  reporte({
    resumen: {
      activas: 4,
      conRojas: 1,
      autorizacionesEnRiesgo: 0,
      listasParaCierre: 0,
      listasConPendientes: 0,
    },
    hayUrgencias: true,
    urgencias: [
      {
        vendedorNombre: 'Antonella Rossi',
        direccion: 'Belgrano 2087',
        protocoloId: '11111111-1111-4111-8111-111111111111',
        alertas: [
          {
            nivel: 'roja',
            titulo: '2 acciones atrasadas',
            detalle: 'Vencieron sin cerrarse.',
            semana: 4,
          },
        ],
      },
    ],
  });

describe('armarMailDelReporte', () => {
  it('el asunto es la misma frase que el titular de la pantalla', () => {
    const { asunto } = armarMailDelReporte(reporte(), 'Jorgito Propiedades', APP);

    expect(asunto).toBe('4 propiedades en comercialización, todas al día');
  });

  /**
   * Regla 9: cuando no hay nada urgente el mail va CORTO. Un correo semanal que
   * mide siempre lo mismo se deja de abrir en la tercera semana; el detalle
   * completo siempre está en el PDF adjunto y en la app.
   */
  it('sin urgencias no repite el detalle por vendedor', () => {
    const { html } = armarMailDelReporte(reporte(), 'Jorgito Propiedades', APP);

    expect(html).toContain('Ninguna propiedad necesita atención esta semana');
    expect(html).not.toContain('Detalle por vendedor');
    expect(html).not.toContain('Belgrano 2087');
  });

  it('con urgencias sí trae el detalle, y lo urgente primero', () => {
    const { html } = armarMailDelReporte(conUrgencia(), 'Jorgito Propiedades', APP);

    expect(html).toContain('Necesita atención');
    expect(html.indexOf('Necesita atención')).toBeLessThan(html.indexOf('Detalle por vendedor'));
    expect(html).toContain('2 acciones atrasadas');
    expect(html).toContain('Belgrano 2087');
  });

  // El rojo de urgencia no sale de la marca: con una marca azul las alertas
  // no se distinguirían de un dato informativo (CONVENCIONES §13).
  it('usa el rojo de urgencia, no un color de marca', () => {
    const { html } = armarMailDelReporte(conUrgencia(), 'Jorgito Propiedades', APP);

    expect(html).toContain('#C1121F');
  });

  it('los links llevan a la app, no a rutas relativas', () => {
    const { html } = armarMailDelReporte(conUrgencia(), 'Jorgito Propiedades', APP);

    expect(html).toContain(`${APP}/protocolo/reporte`);
    expect(html).toContain(`${APP}/protocolo/11111111-1111-4111-8111-111111111111`);
  });

  /** Sin versión en texto varios filtros suben el puntaje de spam. */
  it('trae una versión en texto con los mismos números', () => {
    const { texto } = armarMailDelReporte(conUrgencia(), 'Jorgito Propiedades', APP);

    expect(texto).toContain('Necesitan atención: 1');
    expect(texto).toContain('NECESITA ATENCIÓN');
    expect(texto).toContain('Belgrano 2087');
    expect(texto).not.toContain('<');
  });

  it('escapa el HTML de los datos', () => {
    const malicioso = reporte({
      porVendedor: [
        {
          vendedorId: '22222222-2222-4222-8222-222222222222',
          vendedorNombre: '<script>alert(1)</script>',
          conRojas: 0,
          propiedades: [],
        },
      ],
    });
    const { html } = armarMailDelReporte(malicioso, '<b>Tenant</b>', APP);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Tenant</b>');
  });
});

describe('slugDeTenant', () => {
  it('arma la parte local del remitente', () => {
    expect(slugDeTenant('Jorgito Propiedades')).toBe('jorgito-propiedades');
    expect(slugDeTenant('Vacker Negocios Inmobiliarios')).toBe('vacker-negocios-inmobiliarios');
  });

  it('saca acentos y signos', () => {
    expect(slugDeTenant('Inmobiliaria Ñandú & Cía.')).toBe('inmobiliaria-nandu-cia');
  });

  it('nunca queda vacío', () => {
    expect(slugDeTenant('///')).toBe('reportes');
  });
});
