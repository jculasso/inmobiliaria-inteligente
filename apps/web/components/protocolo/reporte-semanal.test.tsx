import { render, screen } from '@testing-library/react';
import type { PropiedadEnReporte, ReporteSemanal, SemanaEnReporte } from '@vacker/types';
import { describe, expect, it } from 'vitest';
import { fmtFechaCorta, ReporteSemanalVista, resumenDeVendedor } from './reporte-semanal';

function semanas(over: Partial<SemanaEnReporte>[] = []): SemanaEnReporte[] {
  return [1, 2, 3, 4, 5].map((semana, i) => ({
    semana,
    estado: 'futura' as const,
    atrasadas: 0,
    pendientes: 0,
    alertas: [],
    ...over[i],
  }));
}

function propiedad(over: Partial<PropiedadEnReporte> = {}): PropiedadEnReporte {
  return {
    protocoloId: '11111111-1111-4111-8111-111111111111',
    direccion: 'Alsina 3841',
    fotoUrl: null,
    precio: 145000,
    moneda: 'USD',
    fechaInicio: '2026-07-30',
    diasTranscurridos: 1,
    semanaActual: 1,
    prioridad: 'verde',
    listoParaCierre: false,
    pendientesArrastrados: 0,
    alertasGenerales: [],
    semanas: semanas(),
    ...over,
  };
}

function reporte(over: Partial<ReporteSemanal> = {}): ReporteSemanal {
  return {
    generadoEl: '2026-07-30',
    resumen: {
      activas: 1,
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
        vendedorNombre: 'Nicolás Vera',
        propiedades: [propiedad()],
        conRojas: 0,
      },
    ],
    ...over,
  };
}

describe('ReporteSemanalVista', () => {
  it('sin nada urgente lo dice en una línea y no arma la sección de atención', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    expect(screen.getByText(/Ninguna propiedad necesita atención esta semana/i)).toBeInTheDocument();
    expect(screen.queryByText('Necesita atención')).not.toBeInTheDocument();
  });

  it('agrupa las propiedades bajo el nombre del vendedor', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    expect(screen.getByText('Nicolás Vera')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alsina 3841' })).toHaveAttribute(
      'href',
      '/protocolo/11111111-1111-4111-8111-111111111111',
    );
  });

  it('muestra lo urgente arriba, con el vendedor al lado', () => {
    const r = reporte({
      hayUrgencias: true,
      resumen: {
        activas: 1,
        conRojas: 1,
        autorizacionesEnRiesgo: 0,
        listasParaCierre: 0,
        listasConPendientes: 0,
      },
      urgencias: [
        {
          vendedorNombre: 'Nicolás Vera',
          direccion: 'Alsina 3841',
          protocoloId: '11111111-1111-4111-8111-111111111111',
          alertas: [
            {
              nivel: 'roja',
              titulo: '2 acciones atrasadas',
              detalle: 'Vencieron sin cerrarse.',
              semana: 1,
            },
          ],
        },
      ],
    });
    render(<ReporteSemanalVista reporte={r} />);

    expect(screen.getByText('Necesita atención')).toBeInTheDocument();
    expect(screen.getAllByText('2 acciones atrasadas').length).toBeGreaterThan(0);
    expect(screen.getByText(/· Nicolás Vera/)).toBeInTheDocument();
  });

  // Lo que pidió la dirección: que el cierre con tareas pendientes no se lea
  // como un "todo listo".
  it('dice cuántas tareas arrastra una propiedad lista para cierre', () => {
    const r = reporte({
      porVendedor: [
        {
          vendedorId: '22222222-2222-4222-8222-222222222222',
          vendedorNombre: 'Nicolás Vera',
          propiedades: [propiedad({ listoParaCierre: true, pendientesArrastrados: 2 })],
          conRojas: 0,
        },
      ],
    });
    render(<ReporteSemanalVista reporte={r} />);

    expect(
      screen.getByText('Listo para cierre · 2 tareas pendientes de semanas anteriores'),
    ).toBeInTheDocument();
  });

  it('sin pendientes el cierre se anuncia limpio', () => {
    const r = reporte({
      porVendedor: [
        {
          vendedorId: '22222222-2222-4222-8222-222222222222',
          vendedorNombre: 'Nicolás Vera',
          propiedades: [propiedad({ listoParaCierre: true, pendientesArrastrados: 0 })],
          conRojas: 0,
        },
      ],
    });
    render(<ReporteSemanalVista reporte={r} />);

    expect(screen.getByText('Listo para cierre')).toBeInTheDocument();
  });

  it('sin propiedades explica que todavía no hay nada, en vez de quedar en blanco', () => {
    const r = reporte({
      resumen: {
        activas: 0,
        conRojas: 0,
        autorizacionesEnRiesgo: 0,
        listasParaCierre: 0,
        listasConPendientes: 0,
      },
      porVendedor: [],
    });
    render(<ReporteSemanalVista reporte={r} />);

    expect(screen.getByText(/No hay propiedades en comercialización/i)).toBeInTheDocument();
    expect(screen.queryByText(/Detalle por vendedor/i)).not.toBeInTheDocument();
  });

  it('la tira de semanas muestra las cinco', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    for (const s of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`S${s}`)).toBeInTheDocument();
    }
  });

  // Pedido de la dirección: llegar de un click a la semana donde está el
  // problema, sin tener que buscarla dentro de la ficha.
  it('cada alerta lleva a la semana donde está el problema', () => {
    const r = reporte({
      hayUrgencias: true,
      urgencias: [
        {
          vendedorNombre: 'Nicolás Vera',
          direccion: 'Alsina 3841',
          protocoloId: '11111111-1111-4111-8111-111111111111',
          alertas: [
            { nivel: 'roja', titulo: '2 acciones atrasadas', detalle: 'x', semana: 2 },
            { nivel: 'roja', titulo: 'Autorización vencida', detalle: 'y', semana: null },
          ],
        },
      ],
    });
    render(<ReporteSemanalVista reporte={r} />);

    const conSemana = screen.getAllByRole('link').find((a) =>
      a.textContent?.includes('2 acciones atrasadas'),
    );
    expect(conSemana).toHaveAttribute(
      'href',
      '/protocolo/11111111-1111-4111-8111-111111111111?semana=2',
    );

    // Las que no son de una semana llevan a la ficha, sin parámetro.
    const sinSemana = screen.getAllByRole('link').find((a) =>
      a.textContent?.includes('Autorización vencida'),
    );
    expect(sinSemana).toHaveAttribute('href', '/protocolo/11111111-1111-4111-8111-111111111111');
  });

  // Pedido de la dirección: ver desde cuándo está publicada y cuántos días
  // lleva, porque "semana 5 de 5" se clava y esconde la antigüedad.
  it('muestra la fecha de inicio y los días transcurridos', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    expect(screen.getByText('30/07/2026')).toBeInTheDocument();
    // Singular: decía "1 días".
    expect(screen.getByText('1 día')).toBeInTheDocument();
    expect(screen.queryByText(/pasó las 5 semanas/i)).not.toBeInTheDocument();
  });

  it('avisa cuando la propiedad ya pasó las cinco semanas', () => {
    const r = reporte({
      porVendedor: [
        {
          vendedorId: '22222222-2222-4222-8222-222222222222',
          vendedorNombre: 'Nicolás Vera',
          propiedades: [propiedad({ fechaInicio: '2026-06-18', diasTranscurridos: 43 })],
          conRojas: 0,
        },
      ],
    });
    render(<ReporteSemanalVista reporte={r} />);

    expect(screen.getByText('18/06/2026')).toBeInTheDocument();
    expect(screen.getByText('43 días')).toBeInTheDocument();
    expect(screen.getByText(/pasó las 5 semanas/i)).toBeInTheDocument();
  });

  it('muestra el precio publicado junto a la propiedad', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    expect(screen.getByText('$145.000')).toBeInTheDocument();
  });

  it('abre con la frase que resume la semana', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    expect(screen.getByText('1 propiedad en comercialización, al día')).toBeInTheDocument();
  });

  it('la tira de semanas también es navegable', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    const s3 = screen.getAllByRole('link').find((a) => a.textContent?.startsWith('S3'));
    expect(s3).toHaveAttribute(
      'href',
      '/protocolo/11111111-1111-4111-8111-111111111111?semana=3',
    );
  });
});

describe('resumenDeVendedor', () => {
  // "1 propiedad · 1 con atención" decía dos veces lo mismo.
  it('no repite el número cuando hay una sola propiedad', () => {
    expect(resumenDeVendedor(1, 1)).toBe('1 propiedad · necesita atención');
  });

  it('sin nada rojo, solo el conteo', () => {
    expect(resumenDeVendedor(1, 0)).toBe('1 propiedad');
    expect(resumenDeVendedor(4, 0)).toBe('4 propiedades');
  });

  it('con varias, dice cuántas necesitan atención', () => {
    expect(resumenDeVendedor(3, 1)).toBe('3 propiedades · 1 necesita atención');
    expect(resumenDeVendedor(3, 2)).toBe('3 propiedades · 2 necesitan atención');
  });
});

describe('fmtFechaCorta', () => {
  it('escribe la fecha como dd/mm/aaaa', () => {
    expect(fmtFechaCorta('2026-06-18')).toBe('18/06/2026');
  });
});
