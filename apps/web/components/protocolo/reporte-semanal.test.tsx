import { render, screen } from '@testing-library/react';
import type { PropiedadEnReporte, ReporteSemanal, SemanaEnReporte } from '@vacker/types';
import { describe, expect, it } from 'vitest';
import { ReporteSemanalVista } from './reporte-semanal';

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
    necesitaAtencion: false,
    necesitaDecision: [],
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
  it('sin nada urgente lo dice en una línea y no arma la sección de decisiones', () => {
    render(<ReporteSemanalVista reporte={reporte()} />);

    expect(screen.getByText(/Nada urgente esta semana/i)).toBeInTheDocument();
    expect(screen.queryByText(/Necesita decisión/i)).not.toBeInTheDocument();
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
      necesitaAtencion: true,
      resumen: {
        activas: 1,
        conRojas: 1,
        autorizacionesEnRiesgo: 0,
        listasParaCierre: 0,
        listasConPendientes: 0,
      },
      necesitaDecision: [
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

    expect(screen.getByText('Necesita decisión')).toBeInTheDocument();
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
});
