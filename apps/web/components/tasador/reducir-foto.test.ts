import { describe, expect, it } from 'vitest';
import { LADO_MAXIMO, medidasReducidas, mensajeNoSeLee, nombreJpeg } from './reducir-foto';

/**
 * Una foto de iPhone (4032×3024, 3–6 MB) rebotaba contra el límite de 5 MB
 * de la API. Se achica en el teléfono a 2000 px del lado largo antes de subir.
 */
describe('medidasReducidas', () => {
  it('una foto horizontal de iPhone queda en 2000 px de ancho, con su proporción', () => {
    expect(medidasReducidas(4032, 3024)).toEqual({ ancho: 2000, alto: 1500 });
  });

  it('una vertical se mide por el alto', () => {
    expect(medidasReducidas(3024, 4032)).toEqual({ ancho: 1500, alto: 2000 });
  });

  it('una foto que ya entra no se agranda', () => {
    expect(medidasReducidas(1200, 800)).toEqual({ ancho: 1200, alto: 800 });
    expect(medidasReducidas(LADO_MAXIMO, 10)).toEqual({ ancho: LADO_MAXIMO, alto: 10 });
  });

  it('una muy angosta no queda en cero píxeles', () => {
    expect(medidasReducidas(8000, 1)).toEqual({ ancho: 2000, alto: 1 });
  });
});

describe('nombreJpeg', () => {
  it('el archivo que sube es un JPEG y se llama así', () => {
    expect(nombreJpeg('IMG_1234.HEIC')).toBe('IMG_1234.jpg');
    expect(nombreJpeg('frente.png')).toBe('frente.jpg');
    expect(nombreJpeg('sin-extension')).toBe('sin-extension.jpg');
  });
});

describe('mensajeNoSeLee', () => {
  it('dice qué foto y qué hacer, en vez de un error del servidor', () => {
    const m = mensajeNoSeLee('IMG_1234.HEIC');
    expect(m).toContain('IMG_1234.HEIC');
    expect(m).toContain('HEIC');
  });
});
