import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndicesService } from '../alquileres/indices.service';
import { TareasController } from './tareas.controller';
import type { TareasService } from './tareas.service';

describe('POST /tareas/indices (reglas 8 y 101)', () => {
  const antes = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = 'secreto-de-prueba';
  });
  afterEach(() => {
    // Asignar `undefined` dejaría la cadena «undefined»: se borra.
    if (antes === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = antes;
  });

  const indices = () => ({
    importar: vi.fn().mockResolvedValue([
      { indice: 'ICL', nuevos: 1, ultimaFecha: '2026-10-25' },
      { indice: 'IPC', nuevos: 0, ultimaFecha: '2026-09-01' },
    ]),
    importarFeriados: vi
      .fn()
      .mockResolvedValue({ indice: 'Feriados', nuevos: 0, ultimaFecha: '2027-12-25' }),
  });

  it('la misma tarea diaria trae los índices y los feriados, en un renglón cada uno', async () => {
    const i = indices();
    const c = new TareasController({} as TareasService, i as unknown as IndicesService);
    expect(await c.indicesDiarios('secreto-de-prueba')).toEqual([
      { indice: 'ICL', nuevos: 1, ultimaFecha: '2026-10-25' },
      { indice: 'IPC', nuevos: 0, ultimaFecha: '2026-09-01' },
      { indice: 'Feriados', nuevos: 0, ultimaFecha: '2027-12-25' },
    ]);
  });

  it('sin el secreto no corre nada', async () => {
    const i = indices();
    const c = new TareasController({} as TareasService, i as unknown as IndicesService);
    await expect(c.indicesDiarios('otro')).rejects.toThrow(/Secreto/);
    expect(i.importarFeriados).not.toHaveBeenCalled();
  });
});
