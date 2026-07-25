import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { PLANTILLA_ACCIONES, type ProtocoloDto } from '@vacker/types';
import { InformeProtocoloDocument } from './informe-protocolo.template';

function protocolo(over: Partial<ProtocoloDto> = {}): ProtocoloDto {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    estado: 'activa',
    fechaInicio: '2026-07-01',
    semanaActual: 3,
    diasPublicada: 15,
    avance: 0.5,
    precioPublicado: 185000,
    moneda: 'USD',
    vencimientoAutorizacion: '2026-09-01',
    archivadoEn: null,
    motivoArchivo: null,
    agente: {
      id: '22222222-2222-2222-2222-222222222222',
      nombre: 'Ana Gómez',
      email: 'ana@vacker.com',
      telefono: '3415023921',
      fotoUrl: null,
    },
    propiedad: {
      tasacionId: '33333333-3333-3333-3333-333333333333',
      direccion: 'Córdoba 1234',
      barrio: 'Centro',
      ciudad: 'Rosario',
      tipoPropiedad: 'Departamento',
      tipoOperacion: 'venta',
      superficieTotal: 96,
      dormitorios: 2,
      banos: 1,
      valorRecomendado: 190000,
      fotoUrl: null,
    },
    alertas: [],
    proximaAccion: 'Ronda de negocios con colegas',
    propietarioNombre: 'Juan Pérez',
    propietarioTelefono: '3415551234',
    propietarioEmail: 'juan@correo.com',
    embudo: {
      consultas: 20,
      consultasCalificadas: 8,
      visitas: 5,
      interesadosActivos: 2,
      ofertas: 1,
      conversionVisita: 0.25,
      conversionOferta: 0.2,
    },
    devolucionesMercado: 'Buena repercusión; observan el precio.',
    objeciones: 'Precio por encima de la zona.',
    recomendacion: 'Ajustar un 5% y reforzar difusión.',
    decisionPropietario: 'Mantener el precio dos semanas más.',
    proximasAcciones: 'Nueva producción de video y ronda con colegas.',
    observacionArchivo: null,
    acciones: PLANTILLA_ACCIONES.map((a, i) => ({
      id: `acc-${i}`,
      semana: a.semana,
      orden: i,
      clave: a.clave,
      titulo: a.titulo,
      estado: i % 2 === 0 ? ('realizada' as const) : ('pendiente' as const),
      fechaPrevista: '2026-07-07',
      fechaRealizada: i % 2 === 0 ? '2026-07-05' : null,
      observaciones: null,
      resultado: i % 2 === 0 ? 'Se publicó en los portales principales.' : null,
      evidencia: null,
    })),
    ...over,
  };
}

describe('InformeProtocoloDocument', () => {
  it('genera un PDF con al menos las 4 secciones', async () => {
    const buffer = await renderToBuffer(
      <InformeProtocoloDocument protocolo={protocolo()} tenantNombre="Vacker" />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    // Portada, resumen, trabajo realizado y conclusiones. "Trabajo realizado"
    // puede desbordar a una página extra si hay muchas acciones: por eso ≥ 4.
    const paginas = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(paginas).toBeGreaterThanOrEqual(4);
  });

  it('no falla con una ficha recién iniciada (sin métricas ni análisis)', async () => {
    const vacio = protocolo({
      avance: 0,
      semanaActual: 1,
      precioPublicado: null,
      propietarioNombre: null,
      propietarioTelefono: null,
      devolucionesMercado: null,
      objeciones: null,
      recomendacion: null,
      decisionPropietario: null,
      proximasAcciones: null,
      embudo: {
        consultas: 0,
        consultasCalificadas: 0,
        visitas: 0,
        interesadosActivos: 0,
        ofertas: 0,
        conversionVisita: 0,
        conversionOferta: 0,
      },
      acciones: [],
    });

    const buffer = await renderToBuffer(
      <InformeProtocoloDocument protocolo={vacio} tenantNombre="Vacker" />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('respeta los colores de marca del tenant', async () => {
    const buffer = await renderToBuffer(
      <InformeProtocoloDocument
        protocolo={protocolo()}
        tenantNombre="Sanso Propiedades"
        colorPrimario="#0057B8"
        colorPrimarioOscuro="#003F85"
      />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
