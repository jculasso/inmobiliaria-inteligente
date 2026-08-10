import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReporteView } from './reporte-view';

/**
 * El reporte de tasaciones tiene que respetar el alcance, igual que el resto.
 *
 * Era la ÚNICA pantalla del Tasador sin el check "Ver todo", y además nunca
 * mandaba `verTodo` a la API. Como el alcance por defecto es "lo propio"
 * (`scopeDeVista` en el backend), un usuario de dirección que no fuera admin
 * entraba al reporte y veía solo SUS tasaciones, sin forma de expandir.
 *
 * No lo detectó nadie durante semanas porque quien lo miraba tenía
 * `admin_plataforma`, que está exceptuado de la inversión y ve todo siempre.
 */

type Consulta = 'kpis' | 'ranking' | 'listado';
const llamadas: Record<Consulta, unknown[]> = { kpis: [], ranking: [], listado: [] };

// `ToggleVerTodo` usa el router de Next; sin esto el render explota antes de
// llegar a lo que se quiere comprobar.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/tasador/reporte',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/tasador-api', () => ({
  getKpisResumenTasador: (_t: string, f: unknown) => {
    llamadas.kpis.push(f);
    return Promise.resolve({ total: 0, tasaCaptacion: 0, distribucionEstado: [] });
  },
  getRankingCaptaciones: (_t: string, f: unknown) => {
    llamadas.ranking.push(f);
    return Promise.resolve([]);
  },
  listTasacionesResumen: (_t: string, f: unknown) => {
    llamadas.listado.push(f);
    return Promise.resolve([]);
  },
  generarInformeReporte: () => Promise.resolve(new Blob()),
}));

beforeEach(() => {
  llamadas.kpis = [];
  llamadas.ranking = [];
  llamadas.listado = [];
});

describe('ReporteView — alcance', () => {
  it('sin permiso para ver todo, no muestra el check', async () => {
    render(<ReporteView anioInicial={2026} puedeVerTodo={false} />);
    expect(await screen.findByText('Reporte de tasaciones')).toBeInTheDocument();
    expect(screen.queryByText('Ver todo')).not.toBeInTheDocument();
  });

  it('con permiso, muestra el check', async () => {
    render(<ReporteView anioInicial={2026} puedeVerTodo />);
    expect(await screen.findByText('Ver todo')).toBeInTheDocument();
  });

  it('propaga verTodo a las TRES consultas, no solo a una', async () => {
    render(<ReporteView anioInicial={2026} puedeVerTodo verTodo />);
    await screen.findByText('Reporte de tasaciones');

    // Las tres alimentan partes distintas de la pantalla: los KPIs de arriba,
    // el ranking de captaciones y la tabla. Si una sola se olvidara, el reporte
    // mostraría números de toda la inmobiliaria con una tabla de una persona.
    for (const clave of ['kpis', 'ranking', 'listado'] as Consulta[]) {
      expect(llamadas[clave].length, `no se llamó a ${clave}`).toBeGreaterThan(0);
      expect(llamadas[clave][0], `${clave} no recibió verTodo`).toMatchObject({ verTodo: true });
    }
  });

  it('sin verTodo, ninguna consulta lo pide', async () => {
    render(<ReporteView anioInicial={2026} puedeVerTodo />);
    await screen.findByText('Reporte de tasaciones');

    for (const clave of ['kpis', 'ranking', 'listado'] as Consulta[]) {
      expect(llamadas[clave][0]).toMatchObject({ verTodo: false });
    }
  });
});
