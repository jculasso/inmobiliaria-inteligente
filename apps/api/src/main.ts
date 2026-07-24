import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

/** Orígenes extra permitidos por CORS (coma-separados en la env var CORS_ORIGINS). */
const CORS_EXTRA = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Un origen del browser es propio: dominio de producción, cualquier *.vercel.app
 * (fallback + previews de PRs), localhost de desarrollo, o algo listado en CORS_ORIGINS. */
function esOrigenPermitido(origin: string): boolean {
  if (CORS_EXTRA.includes(origin)) return true;
  return (
    origin === 'https://app.inmobiliariainteligente.net' ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CORS acotado a los orígenes propios (dominio + fallback/previews de Vercel +
  // local). Antes era `origin: true` (cualquier origen). La auth es por Bearer
  // token (no cookies), así que esto es defensa en profundidad. `maxAge` cachea
  // el preflight (OPTIONS) 24hs — sin esto cada request cross-origin paga dos
  // viajes de red, y con Render lejos de Supabase eso duele.
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Requests sin Origin (curl, health checks, server-to-server) pasan.
      if (!origin || esOrigenPermitido(origin)) cb(null, true);
      else cb(new Error(`Origen no permitido por CORS: ${origin}`), false);
    },
    maxAge: 86_400,
  });

  // Formato de error consistente { error: { code, message, details? } }.
  app.useGlobalFilters(new AllExceptionsFilter());

  // OpenAPI / Swagger en /docs (JSON en /docs-json).
  const config = new DocumentBuilder()
    .setTitle('Inmobiliaria Inteligente API')
    .setDescription('Núcleo multi-tenant + Tablero Comercial (Vacker)')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Render (y hosts similares) asignan el puerto dinámicamente vía PORT;
  // en local usamos API_PORT (o 3001 por default).
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] escuchando en http://localhost:${port}  ·  docs en /docs`);
}

void bootstrap();
