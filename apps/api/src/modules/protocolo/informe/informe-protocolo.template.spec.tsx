import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { medirFotosPdf } from '../../../common/medir-fotos-pdf';
import { describe, expect, it } from 'vitest';
import { PLANTILLA_ACCIONES, type ProtocoloDto } from '@vacker/types';
import { InformeProtocoloDocument } from './informe-protocolo.template';

function protocolo(over: Partial<ProtocoloDto> = {}): ProtocoloDto {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    version: '2026-07-15T10:00:00.000Z',
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

/** Foto 4:3, la proporción de cualquier cámara de celular. Va como data URI
 *  para que el test no dependa de la red. */
const FOTO_4_3 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAEsCAIAAABi1XKVAAAEz0lEQVR4nO3OQQkAMQADsPpXMRETcbLOQn9lEIiA5LsH4AmZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASj8kc/7l+5mn7AAAAABJRU5ErkJggg==';

describe('InformeProtocoloDocument', () => {
  /** Cuenta páginas del PDF, para verificar dónde caen los cortes. */
  function paginas(buffer: Buffer): number {
    return buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
  }

  it('cada sección grande arranca en su propia página', async () => {
    const buffer = await renderToBuffer(
      <InformeProtocoloDocument protocolo={protocolo()} tenantNombre="Vacker" />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    // Resumen + acciones realizadas + conclusiones = 3 como piso; las acciones
    // pueden ocupar más de una página cuando el protocolo está avanzado.
    expect(paginas(buffer)).toBeGreaterThanOrEqual(3);
  });

  it('una ficha recién iniciada entra en pocas páginas, sin hojas casi vacías', async () => {
    // Sin acciones hechas ni análisis, el informe no debería inflarse: los
    // saltos de página están puestos entre secciones, no porque sí.
    const recien = protocolo({
      avance: 0,
      semanaActual: 1,
      devolucionesMercado: null,
      objeciones: null,
      recomendacion: null,
      decisionPropietario: null,
      proximasAcciones: null,
      acciones: [],
    });

    const buffer = await renderToBuffer(
      <InformeProtocoloDocument protocolo={recien} tenantNombre="Vacker" />,
    );
    expect(paginas(buffer)).toBe(3);
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

/**
 * La foto de la propiedad se muestra entera.
 *
 * Antes la caja era `width: 100%, height: 150` —3,5:1— contra una foto de 4:3:
 * se veía el 37% del alto y se perdía casi dos tercios. Es el mismo problema
 * que se corrigió en el informe de tasación, acá peor por ser una sola foto a
 * todo el ancho.
 *
 * La foto va solo en este test y no en el fixture compartido: agregarla allá
 * suma una página y le cambiaría la línea de base al test de cantidad de
 * páginas, que mide otra cosa.
 */
describe('InformeProtocoloDocument — la foto no se recorta', () => {
  it('la caja de la foto tiene la misma proporción que la foto', async () => {
    const conFoto = protocolo({});
    const buffer = await renderToBuffer(
      <InformeProtocoloDocument
        protocolo={{ ...conFoto, propiedad: { ...conFoto.propiedad, fotoUrl: FOTO_4_3 } }}
        tenantNombre="Vacker"
        logoUrl={null}
      />,
    );

    const medidas = medirFotosPdf(buffer);

    expect(medidas.length).toBeGreaterThan(0);
    for (const { cajaAlto, fotoAlto } of medidas) {
      expect(Math.abs(cajaAlto - fotoAlto)).toBeLessThanOrEqual(1);
    }
  }, 20_000);
});
