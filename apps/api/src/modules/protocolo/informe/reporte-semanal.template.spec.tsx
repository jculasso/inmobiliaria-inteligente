import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import type { PropiedadEnReporte, ReporteSemanal } from '@vacker/types';
import { fuentesUsadasEnPdf, streamsDePdf, textoDePdf } from '../../../common/texto-pdf';
import { ReporteSemanalDocument } from './reporte-semanal.template';

const textoDe = textoDePdf;

function propiedad(over: Partial<PropiedadEnReporte> = {}): PropiedadEnReporte {
  return {
    protocoloId: '11111111-1111-4111-8111-111111111111',
    direccion: 'Belgrano 2087',
    fotoUrl: null,
    precio: 145000,
    moneda: 'USD',
    fechaInicio: '2026-06-18',
    diasTranscurridos: 43,
    semanaActual: 5,
    prioridad: 'roja',
    listoParaCierre: true,
    pendientesArrastrados: 2,
    alertasGenerales: [],
    semanas: [1, 2, 3, 4, 5].map((semana) => ({
      semana,
      estado: semana === 4 ? ('incompleta' as const) : ('completa' as const),
      atrasadas: semana === 4 ? 2 : 0,
      pendientes: semana === 4 ? 2 : 0,
      alertas:
        semana === 4
          ? [
              {
                nivel: 'roja' as const,
                titulo: '2 acciones atrasadas',
                detalle: 'Vencieron sin cerrarse. La más antigua es de la semana 4.',
                semana: 4,
              },
            ]
          : [],
    })),
    ...over,
  };
}

function reporte(over: Partial<ReporteSemanal> = {}): ReporteSemanal {
  return {
    generadoEl: '2026-07-30',
    resumen: {
      activas: 1,
      conRojas: 1,
      autorizacionesEnRiesgo: 0,
      listasParaCierre: 1,
      listasConPendientes: 1,
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
    porVendedor: [
      {
        vendedorId: '22222222-2222-4222-8222-222222222222',
        vendedorNombre: 'Antonella Rossi',
        conRojas: 1,
        propiedades: [propiedad()],
      },
    ],
    ...over,
  };
}

const doc = (r: ReporteSemanal, colorPrimario: string | null = null) => (
  <ReporteSemanalDocument
    reporte={r}
    tenantNombre="Jorgito Propiedades"
    logoUrl={null}
    colorPrimario={colorPrimario}
  />
);

describe('ReporteSemanalDocument', () => {
  it('abre con la misma frase que el asunto del mail', async () => {
    const texto = textoDe(await renderToBuffer(doc(reporte())));

    expect(texto).toContain('1 de 1 necesita atención: Belgrano 2087');
  });

  it('trae los cuatro números del resumen y el detalle por vendedor', async () => {
    const texto = textoDe(await renderToBuffer(doc(reporte())));

    expect(texto).toContain('EN COMERCIALIZACIÓN');
    expect(texto).toContain('NECESITAN ATENCIÓN');
    expect(texto).toContain('DETALLE POR VENDEDOR');
    expect(texto).toContain('Antonella Rossi');
    expect(texto).toContain('Belgrano 2087');
  });

  it('lleva el precio, la fecha de inicio y los días, con el aviso de las 5 semanas', async () => {
    const texto = textoDe(await renderToBuffer(doc(reporte())));

    expect(texto).toContain('$145.000');
    expect(texto).toContain('18/06/2026');
    expect(texto).toContain('43 días');
    expect(texto).toContain('pasó las 5 semanas');
  });

  it('dice el cierre con las tareas que arrastra', async () => {
    const texto = textoDe(await renderToBuffer(doc(reporte())));

    expect(texto).toContain('Listo para cierre');
    expect(texto).toContain('2 tareas pendientes de semanas anteriores');
  });

  /**
   * Misma regla que en la web (`CONVENCIONES_TECNICAS.md` §13): el rojo de
   * urgencia NO se deriva de la marca. Con la marca azul de Jorgito, el PDF
   * tiene que seguir teniendo el rojo `#C1121F` — un informe impreso donde lo
   * urgente no se distingue no sirve para nada.
   */
  it('mantiene el rojo de urgencia aunque la marca sea azul', async () => {
    const streams = streamsDePdf(await renderToBuffer(doc(reporte(), '#0B5FA5'))).join('\n');

    // #C1121F = rgb(193,18,31) → 0.757 0.071 0.122 en el content stream.
    expect(streams).toMatch(/0\.756[0-9]* 0\.070[0-9]* 0\.121[0-9]*/);
    // Y la marca azul también está: #0B5FA5 = rgb(11,95,165).
    expect(streams).toMatch(/0\.043[0-9]* 0\.372[0-9]* 0\.647[0-9]*/);
  });

  it('sin propiedades lo dice, en vez de salir una hoja en blanco', async () => {
    const vacio = reporte({
      resumen: {
        activas: 0,
        conRojas: 0,
        autorizacionesEnRiesgo: 0,
        listasParaCierre: 0,
        listasConPendientes: 0,
      },
      hayUrgencias: false,
      urgencias: [],
      porVendedor: [],
    });
    const texto = textoDe(await renderToBuffer(doc(vacio)));

    expect(texto).toContain('Sin propiedades en comercialización');
    expect(texto).toContain('Todavía no hay propiedades en comercialización');
    expect(texto).not.toContain('DETALLE POR VENDEDOR');
  });
});

/**
 * Un informe de marca no puede llevar dos tipografías.
 *
 * react-pdf incrusta una fuente de respaldo (Helvetica) por CADA carácter que
 * no encuentre en la familia registrada. Pasó con el ✓ de la tira de semanas:
 * Montserrat no lo tiene, y el PDF terminaba con Helvetica-Bold adentro por una
 * sola tilde. Este test lo detecta sin tener que abrir el archivo.
 */
describe('tipografía del PDF', () => {
  it('solo dibuja con Montserrat: ningún carácter cae a una fuente de respaldo', async () => {
    const familias = fuentesUsadasEnPdf(await renderToBuffer(doc(reporte())));

    expect(familias.every((f) => f.startsWith('Montserrat'))).toBe(true);
  });
});
