import { describe, expect, it } from 'vitest';
import { MARCADORES_PLANTILLA } from '@vacker/types';
import { datosDePlantilla } from './plantilla-modelo';
import { plantillaDeEjemplo } from './plantilla-ejemplo';
import { completarPlantillaWord, problemasDePlantilla, textoDeDocx } from './plantilla-word';
import { contratoDePrueba } from './plantilla-word.testing';

const datos = (c = contratoDePrueba()) =>
  datosDePlantilla(c, 'Alteva Propiedades', '2026-10-07') as Record<string, unknown>;

describe('MARCADORES_PLANTILLA y los datos del contrato (una sola lista)', () => {
  // La lista valida el Word al subirlo, arma el ejemplo y la ayuda: si un
  // nombre no lo completa nadie, la plantilla pasaría la validación y saldría
  // vacío en el contrato.
  it.each(MARCADORES_PLANTILLA.map((m) => [m.nombre, m] as const))(
    '«%s» lo completa el armado de datos',
    (nombre, m) => {
      const x = datos();
      expect(Object.hasOwn(x, nombre)).toBe(true);
      const valor = x[nombre];
      if (m.tipo === 'texto') expect(typeof valor).toBe('string');
      // Sí o no; la que trae datos (el depósito), un objeto con sus campos.
      if (m.tipo === 'condicion') expect(typeof valor).toBe(m.campos ? 'object' : 'boolean');
      if (m.tipo === 'lista') {
        expect(Array.isArray(valor)).toBe(true);
        expect((valor as unknown[]).length).toBeGreaterThan(0);
      }
      for (const item of m.tipo === 'lista' ? (valor as object[]) : m.campos ? [valor] : []) {
        expect(Object.keys(item as object).sort()).toEqual(
          (m.campos ?? []).map((c) => c.nombre).sort(),
        );
        for (const v of Object.values(item as object)) expect(typeof v).toBe('string');
      }
    },
  );

  it('no completa ningún dato que la lista no nombre', () => {
    expect(Object.keys(datos()).sort()).toEqual(MARCADORES_PLANTILLA.map((m) => m.nombre).sort());
  });

  it('cada marcador tiene descripción y ejemplo, y los nombres no se repiten', () => {
    const nombres = MARCADORES_PLANTILLA.map((m) => m.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const m of MARCADORES_PLANTILLA) {
      expect(m.descripcion).not.toBe('');
      expect(m.ejemplo).not.toBe('');
    }
  });
});

describe('datosDePlantilla', () => {
  it('partes, importes en letras, ajuste y tramos', () => {
    const x = datos();
    expect(x['propietarios.texto']).toBe(
      'Juan Propietario, DNI/CUIT 20.123.456, con domicilio en Córdoba 1452, Rosario; Marta Propietaria, DNI/CUIT 21.987.654',
    );
    expect(x['inquilinos.texto']).toBe('Ana Inquilina, DNI/CUIT 27-33344455-9');
    expect(x['alquiler.inicial']).toBe('$ 350.000,00');
    expect(x['alquiler.inicial.letras']).toBe('pesos trescientos cincuenta mil');
    expect(x.ajuste).toBe('el Índice para Contratos de Locación (ICL) del BCRA, cada 4 meses');
    expect(x.tramos).toEqual([
      {
        numero: '1',
        desde: '01/03/2026',
        hasta: '30/06/2026',
        importe: '$ 350.000,00',
        letras: 'pesos trescientos cincuenta mil',
      },
      {
        numero: '2',
        desde: '01/07/2026',
        hasta: '31/10/2026',
        importe: 'según el índice',
        letras: '',
      },
    ]);
    expect(x.propietarios).toEqual([
      expect.objectContaining({ nombre: 'Juan Propietario', porcentaje: '50%', separador: ' y ' }),
      expect.objectContaining({ nombre: 'Marta Propietaria', separador: '' }),
    ]);
  });

  it('sin depósito ni garantes, la condición y la lista quedan vacías', () => {
    const c = contratoDePrueba();
    c.depositoImporte = null;
    c.partes = c.partes.filter((p) => p.papel !== 'garante');
    const x = datos(c);
    expect(x.deposito).toBeNull();
    expect(x['deposito.importe']).toBe('');
    expect(x.garantes).toEqual([]);
    expect(x['garantes.texto']).toBe('[sin cargar]');
  });
});

describe('La plantilla de ejemplo', () => {
  const ejemplo = plantillaDeEjemplo();

  it('es un Word válido como plantilla: subirla tal cual funciona', () => {
    expect(
      problemasDePlantilla({ buffer: ejemplo, originalname: 'Ejemplo.docx', size: ejemplo.length }),
    ).toEqual([]);
  });

  it('nombra cada marcador de la lista, y cada campo de las listas', () => {
    const texto = textoDeDocx(ejemplo);
    for (const m of MARCADORES_PLANTILLA) {
      expect(texto).toContain(m.tipo === 'texto' ? `{${m.nombre}}` : `{#${m.nombre}}`);
      for (const c of m.campos ?? []) expect(texto).toContain(`{${c.nombre}}`);
    }
  });

  it('con un contrato, el contrato modelo sale completo', () => {
    const texto = textoDeDocx(completarPlantillaWord(ejemplo, datos()));
    expect(texto).toContain(
      'Entre Juan Propietario, DNI/CUIT 20.123.456, con domicilio en Córdoba 1452, Rosario; Marta Propietaria',
    );
    expect(texto).toContain('Tramo 2: del 01/07/2026 al 31/10/2026, según el índice.');
    expect(texto).toContain('LA PARTE LOCATARIA entrega en este acto $ 350.000,00');
    expect(texto).toContain('Carlos Garante, DNI/CUIT 22.333.444 se constituye en fiador');
    expect(texto).not.toContain('No se constituye garantía personal.');
    expect(texto).not.toContain('{');
  });

  it('sin depósito, la cláusula dice que no se pacta (y no «[sin depósito]»)', () => {
    const c = contratoDePrueba();
    c.depositoImporte = null;
    const texto = textoDeDocx(completarPlantillaWord(ejemplo, datos(c)));
    expect(texto).toContain('Las partes no pactan depósito en garantía.');
    expect(texto).not.toContain('en concepto de depósito en garantía');
  });
});
