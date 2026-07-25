import { describe, expect, it } from 'vitest';
import { corsOptions, esOrigenPermitido } from './cors';

describe('CORS · headers expuestos', () => {
  it('expone Content-Disposition', () => {
    // Regresión: sin esto el navegador NO puede leer el header desde otro
    // origen, así que el nombre del informe no llegaba y los PDF se guardaban
    // con un nombre genérico. La web y la API son subdominios distintos.
    expect(corsOptions.exposedHeaders).toContain('Content-Disposition');
  });
});

describe('CORS · orígenes', () => {
  const permitido = (origin: string | undefined) =>
    new Promise<boolean>((resolve) => {
      const fn = corsOptions.origin as (
        o: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void;
      fn(origin, (err) => resolve(err === null));
    });

  it('acepta el dominio de producción', async () => {
    await expect(permitido('https://app.inmobiliariainteligente.net')).resolves.toBe(true);
  });

  it('acepta previews de Vercel y localhost', async () => {
    await expect(permitido('https://mi-preview-abc123.vercel.app')).resolves.toBe(true);
    await expect(permitido('http://localhost:3000')).resolves.toBe(true);
  });

  it('acepta requests sin Origin (curl, health checks, server-to-server)', async () => {
    await expect(permitido(undefined)).resolves.toBe(true);
  });

  it('rechaza un origen ajeno', async () => {
    await expect(permitido('https://sitio-malicioso.com')).resolves.toBe(false);
    // Ojo con dominios que solo *terminan* parecido.
    await expect(permitido('https://app.inmobiliariainteligente.net.evil.com')).resolves.toBe(false);
  });

  it('esOrigenPermitido no acepta http en el dominio de producción', () => {
    expect(esOrigenPermitido('http://app.inmobiliariainteligente.net')).toBe(false);
  });
});
