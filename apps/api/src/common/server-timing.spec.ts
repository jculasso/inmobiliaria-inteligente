import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller, Get, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { cabeceraServerTiming, medirDb, serverTiming } from './server-timing';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `db;dur=812.4;desc="base", total;dur=905.1` → { db: 812.4, total: 905.1 } */
function leer(cabecera: string | undefined) {
  const dur = (nombre: string) =>
    Number(new RegExp(`${nombre};dur=([0-9.]+)`).exec(cabecera ?? '')?.[1] ?? NaN);
  return { db: dur('db'), total: dur('total') };
}

@Controller('prueba')
class PruebaController {
  /** Dos «transacciones» a la vez y un rato de cálculo después. */
  @Get()
  async get() {
    await Promise.all([medirDb(() => esperar(60)), medirDb(() => esperar(40))]);
    await esperar(30);
    return { ok: true };
  }

  @Get('sin-base')
  sinBase() {
    return { ok: true };
  }
}

@Module({ controllers: [PruebaController] })
class PruebaModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(serverTiming).forRoutes('*');
  }
}

describe('Server-Timing', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('la API entera lo registra para todas las rutas', async () => {
    // AppModule valida el entorno al importarse: lo mínimo, inventado (no
    // conecta a nada; solo se lee `configure`).
    for (const [k, v] of Object.entries({
      DATABASE_URL: 'postgresql://x:x@127.0.0.1:9/x',
      DIRECT_URL: 'postgresql://x:x@127.0.0.1:9/x',
      SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_ANON_KEY: 'x',
      SUPABASE_SERVICE_ROLE_KEY: 'x',
    }))
      if (!process.env[k]) vi.stubEnv(k, v);
    const { AppModule } = await import('../app.module');
    const aplicados: unknown[] = [];
    const rutas: unknown[] = [];
    const consumer = {
      apply: (...m: unknown[]) => {
        aplicados.push(...m);
        return {
          forRoutes: (...r: unknown[]) => {
            rutas.push(...r);
            return consumer;
          },
        };
      },
    } as unknown as MiddlewareConsumer;
    new AppModule().configure(consumer);
    expect(aplicados).toEqual([serverTiming]);
    expect(rutas).toEqual(['*']);
  });

  it('cada respuesta lleva el total y el tiempo de base; dos transacciones a la vez cuentan su lapso', async () => {
    const modulo = await Test.createTestingModule({ imports: [PruebaModule] }).compile();
    const app = modulo.createNestApplication({ logger: false });
    await app.init();
    try {
      const res = await request(app.getHttpServer()).get('/prueba').expect(200);
      const { db, total } = leer(res.headers['server-timing']);
      // El lapso de las dos (≈60 ms), no la suma (≈100 ms).
      expect(db).toBeGreaterThanOrEqual(55);
      expect(db).toBeLessThan(95);
      // Y el total incluye los 30 ms de después.
      expect(total).toBeGreaterThanOrEqual(db + 25);

      const sinBase = await request(app.getHttpServer()).get('/prueba/sin-base').expect(200);
      expect(leer(sinBase.headers['server-timing']).db).toBe(0);
      // Un 404 también la lleva: la escribe el middleware, no el controller.
      const noExiste = await request(app.getHttpServer()).get('/no-existe').expect(404);
      expect(noExiste.headers['server-timing']).toMatch(/^db;dur=0\.0;desc="base", total;dur=/);
    } finally {
      await app.close();
    }
  });

  it('fuera de un pedido, medirDb solo corre la función', async () => {
    await expect(medirDb(async () => 7)).resolves.toBe(7);
  });

  it('una transacción que todavía no terminó cuenta hasta el momento de la cabecera', () => {
    const m = { inicio: 0, db: 10, abiertas: 1, desde: 50 };
    expect(cabeceraServerTiming(m, 80)).toBe('db;dur=40.0;desc="base", total;dur=80.0');
  });
});
