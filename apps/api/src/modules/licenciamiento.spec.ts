import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';
import { MODULO_KEYS } from '@vacker/types';
import { MODULO_KEY } from '../auth/decorators';

/**
 * Todo controller de `src/modules/**` declara `@Modulo(...)` con el módulo de
 * su carpeta, salvo los de la lista de abajo.
 *
 * Hasta el 6/10/2026 el Tasador, el Tablero y el To Do no lo declaraban: una
 * inmobiliaria sin esos módulos contratados no los veía en la Home, pero con
 * el token en la mano los usaba igual llamando la API. Ocultar la tarjeta no
 * es licenciar.
 *
 * Los controllers se descubren recorriendo las carpetas, no de una lista: un
 * controller nuevo que se olvide el decorador hace fallar esto en vez de
 * quedar abierto.
 */
const SIN_MODULO: Record<string, string> = {
  TareasController:
    'Cron de GitHub Actions, sin usuario: lo protege un secreto compartido y recorre todas las inmobiliarias.',
  ExportacionController:
    'Los datos son de la inmobiliaria, no de un módulo: poder llevárselos no depende de qué tenga contratado.',
  FirmaAvisosController:
    'Webhook del proveedor de firma, sin sesión: la autenticidad la valida cada adaptador.',
};

/** Carpeta de `src/modules` → clave de módulo que deben declarar sus controllers. */
const MODULO_DE_CARPETA: Record<string, string> = {
  tablero: 'tablero',
  tasador: 'tasador',
  todo: 'todo',
  protocolo: 'protocolo',
  publicacion: 'publicacion',
  alquileres: 'alquileres',
};

const RAIZ = __dirname;

function archivosDeController(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return archivosDeController(p);
    return e.name.endsWith('.controller.ts') ? [p] : [];
  });
}

async function controllers(): Promise<{ archivo: string; nombre: string; clase: object }[]> {
  const out: { archivo: string; nombre: string; clase: object }[] = [];
  for (const archivo of archivosDeController(RAIZ)) {
    const mod = (await import(archivo)) as Record<string, unknown>;
    for (const [nombre, valor] of Object.entries(mod)) {
      if (typeof valor === 'function' && Reflect.hasMetadata(PATH_METADATA, valor)) {
        out.push({ archivo: relative(RAIZ, archivo), nombre, clase: valor });
      }
    }
  }
  return out;
}

describe('Licenciamiento · @Modulo en cada controller', () => {
  it('encuentra los controllers (si no, el test no estaría probando nada)', async () => {
    expect((await controllers()).length).toBeGreaterThan(25);
  });

  it('cada controller declara el módulo de su carpeta', async () => {
    const faltan: string[] = [];
    for (const { archivo, nombre, clase } of await controllers()) {
      if (SIN_MODULO[nombre]) continue;
      const carpeta = archivo.split('/')[0]!;
      const esperado = MODULO_DE_CARPETA[carpeta];
      const declarado = Reflect.getMetadata(MODULO_KEY, clase) as string | undefined;
      if (!esperado || declarado !== esperado) {
        faltan.push(`${archivo} · ${nombre}: declara ${declarado ?? 'nada'}, espera ${esperado}`);
      }
    }
    expect(
      faltan,
      'Sumá @Modulo(...) al controller. Si de verdad no corresponde a un módulo ' +
        'contratado, agregalo a SIN_MODULO en este archivo con el motivo.',
    ).toEqual([]);
  });

  it('las claves usadas existen en MODULO_KEYS', () => {
    for (const k of Object.values(MODULO_DE_CARPETA)) {
      expect(MODULO_KEYS).toContain(k);
    }
  });

  it('ninguna excepción quedó huérfana', async () => {
    const nombres = new Set((await controllers()).map((c) => c.nombre));
    for (const n of Object.keys(SIN_MODULO)) expect(nombres).toContain(n);
  });
});
