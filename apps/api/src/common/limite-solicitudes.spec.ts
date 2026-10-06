import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Costoso, limiteGlobal, opcionesDeLimite, quienPide } from './limite-solicitudes';
import { ExportacionController } from '../modules/exportacion/exportacion.controller';
import { PasswordController } from '../me/password.controller';
import { InformesController } from '../modules/tasador/informes/informes.controller';
import { ReporteController } from '../modules/tasador/reporte/reporte.controller';
import { InformeProtocoloController } from '../modules/protocolo/informe/informe-protocolo.controller';
import { PublicacionController } from '../modules/publicacion/publicacion.controller';
import { TodoController } from '../modules/todo/todo.controller';
import { CobrosController } from '../modules/alquileres/cobros.controller';
import { LiquidacionesController } from '../modules/alquileres/liquidaciones.controller';

@Controller('prueba')
class PruebaController {
  @Get('barata')
  barata() {
    return { ok: true };
  }

  @Get('cara')
  @Costoso(2)
  cara() {
    return { ok: true };
  }
}

describe('Límite de pedidos · por quién se cuenta', () => {
  it('con sesión, por usuario (no por IP: la oficina comparte wifi)', () => {
    expect(quienPide({ principal: { userId: 'u1' }, ip: '1.2.3.4' })).toBe('u:u1');
  });

  it('sin sesión, por IP', () => {
    expect(quienPide({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('el límite global sale de la variable, con un valor por defecto sensato', () => {
    expect(limiteGlobal(undefined)).toBe(120);
    expect(limiteGlobal('abc')).toBe(120);
    expect(limiteGlobal('300')).toBe(300);
  });
});

describe('Límite de pedidos · rutas costosas marcadas', () => {
  const COSTOSAS: [string, object, string][] = [
    ['exportación', ExportacionController.prototype, 'exportar'],
    ['cambiar la clave', PasswordController.prototype, 'cambiar'],
    ['informe de tasación', InformesController.prototype, 'generar'],
    ['reporte del Tasador', ReporteController.prototype, 'generar'],
    ['informe del Protocolo', InformeProtocoloController.prototype, 'generar'],
    ['reporte semanal PDF', InformeProtocoloController.prototype, 'generarReporteSemanal'],
    ['reporte semanal mail', InformeProtocoloController.prototype, 'enviarReporteSemanal'],
    ['importar de Tokko', PublicacionController.prototype, 'importar'],
    ['eventos de Google', TodoController.prototype, 'eventos'],
    ['recibo PDF', CobrosController.prototype, 'recibo'],
    ['liquidación PDF', LiquidacionesController.prototype, 'pdf'],
  ];

  it.each(COSTOSAS)('%s lleva @Costoso', (_n, proto, metodo) => {
    const handler = (proto as Record<string, unknown>)[metodo];
    expect(Reflect.getMetadata('limite:costoso', handler as object)).toBe(true);
  });
});

describe('Límite de pedidos · de punta a punta', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(opcionesDeLimite())],
      controllers: [PruebaController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('una ruta costosa corta con 429 y un mensaje en castellano', async () => {
    const srv = app.getHttpServer();
    await request(srv).get('/prueba/cara').expect(200);
    await request(srv).get('/prueba/cara').expect(200);
    const r = await request(srv).get('/prueba/cara').expect(429);
    expect(r.body.error.code).toBe('too_many_requests');
    expect(r.body.error.message).toMatch(/Esperá un minuto/);
  });

  it('el límite bajo NO alcanza a las rutas que no están marcadas', async () => {
    const srv = app.getHttpServer();
    for (let i = 0; i < 5; i++) await request(srv).get('/prueba/barata').expect(200);
  });
});
