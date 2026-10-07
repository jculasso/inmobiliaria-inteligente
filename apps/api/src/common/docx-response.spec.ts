import { describe, expect, it } from 'vitest';
import { docxResponse } from './docx-response';

describe('docxResponse', () => {
  it('se descarga como Word, con el nombre real y su respaldo ASCII', () => {
    const res = docxResponse(Buffer.from('PK'), 'Contrato Peña.docx');
    const { type, disposition } = res.getHeaders();
    expect(type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toContain('filename="Contrato Pe_a.docx"');
    expect(disposition).toContain("filename*=UTF-8''Contrato%20Pe%C3%B1a.docx");
  });

  it('le pone la extensión si no la trae', () => {
    expect(docxResponse(Buffer.from('PK'), 'Contrato-ALT-0011').getHeaders().disposition).toContain(
      'filename="Contrato-ALT-0011.docx"',
    );
  });
});
