import { describe, expect, it } from 'vitest';
import { periodosTranscurridos } from './meses';

const el = (iso: string) => new Date(iso);

describe('periodosTranscurridos', () => {
  it('en el año en curso, hasta el mes de hoy inclusive', () => {
    expect(periodosTranscurridos(2026, 'mes', el('2026-10-05T15:00:00Z'))).toBe(10);
    expect(periodosTranscurridos(2026, 'trimestre', el('2026-10-05T15:00:00Z'))).toBe(4);
    expect(periodosTranscurridos(2026, 'trimestre', el('2026-09-30T15:00:00Z'))).toBe(3);
  });

  it('un año pasado se dibuja entero; uno futuro, nada', () => {
    expect(periodosTranscurridos(2025, 'mes', el('2026-10-05T15:00:00Z'))).toBe(12);
    expect(periodosTranscurridos(2027, 'mes', el('2026-10-05T15:00:00Z'))).toBe(0);
  });

  it('cuenta con la hora de Argentina, no la de UTC', () => {
    // 1/11 a las 01:00 UTC es 31/10 a las 22:00 en Rosario: todavía octubre.
    expect(periodosTranscurridos(2026, 'mes', el('2026-11-01T01:00:00Z'))).toBe(10);
  });
});
