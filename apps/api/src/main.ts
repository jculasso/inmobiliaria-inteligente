import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { corsOptions } from './common/cors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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

void bootstrap();
