import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { corsOptions } from './common/cors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render pone un proxy delante: sin esto, `req.ip` es la IP del proxy y el
  // límite de pedidos por IP (endpoints públicos) metería a todo el mundo en
  // el mismo balde. Se confía en UN salto —el proxy de Render— y no en todos
  // (`true`): con `true`, cualquiera manda su propio `X-Forwarded-For` y elige
  // con qué IP se lo cuenta. Si delante se suma otra capa (un CDN), subir
  // TRUST_PROXY_SALTOS. También hace que `req.secure` diga la verdad, que es lo
  // que decide la cookie `Secure` del flujo de Google.
  app.set('trust proxy', saltosDeProxy());

  app.enableCors(corsOptions);

  // El tablero de alquileres pesa: comprimido viaja cinco a diez veces menos.
  app.use(compression());
  // Cabeceras básicas: la API devuelve JSON y PDF, nunca se muestra en un iframe.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Formato de error consistente { error: { code, message, details? } }.
  app.useGlobalFilters(new AllExceptionsFilter());

  // OpenAPI / Swagger en /docs (JSON en /docs-json). En producción no se
  // publica: mostraba el mapa entero de rutas a cualquiera (auditoría del
  // 6/10/2026). Se puede prender con DOCS_PUBLICOS=true para revisarlo.
  const conDocs = process.env.NODE_ENV !== 'production' || process.env.DOCS_PUBLICOS === 'true';
  const config = new DocumentBuilder()
    .setTitle('Inmobiliaria Inteligente API')
    .setDescription('Núcleo multi-tenant + Tablero Comercial (Vacker)')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  if (conDocs) SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  // Render (y hosts similares) asignan el puerto dinámicamente vía PORT;
  // en local usamos API_PORT (o 3001 por default).
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] escuchando en http://localhost:${port}  ·  docs en /docs`);
}

/** Cuántos proxies hay delante de la API (`TRUST_PROXY_SALTOS`, 1 por defecto: Render). */
function saltosDeProxy(): number {
  const n = Number(process.env.TRUST_PROXY_SALTOS);
  return Number.isInteger(n) && n >= 0 ? n : 1;
}

void bootstrap();
