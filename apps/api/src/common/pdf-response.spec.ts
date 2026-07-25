import { describe, expect, it } from 'vitest';
import { pdfResponse } from './pdf-response';

describe('pdfResponse', () => {
  it('manda el nombre en Content-Disposition, con respaldo ASCII', () => {
    const res = pdfResponse(Buffer.from('%PDF'), 'Tasacion Vacker - Juan Pérez - Córdoba 1234');
    const disposition = res.getHeaders().disposition;

    // `filename*` lleva el nombre real (acentos incluidos)…
    expect(disposition).toContain(
      "filename*=UTF-8''Tasacion%20Vacker%20-%20Juan%20P%C3%A9rez%20-%20C%C3%B3rdoba%201234.pdf",
    );
    // …y `filename` queda como respaldo para clientes viejos.
    expect(disposition).toContain('filename="Tasacion Vacker - Juan P_rez - C_rdoba 1234.pdf"');
  });

  it('se muestra en el navegador en vez de forzar la descarga', () => {
    const res = pdfResponse(Buffer.from('%PDF'), 'Informe');
    expect(res.getHeaders().disposition).toMatch(/^inline;/);
    expect(res.getHeaders().type).toBe('application/pdf');
  });
});
