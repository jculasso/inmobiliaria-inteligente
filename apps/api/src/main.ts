import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CORS abierto al frontend local por ahora; se endurece por entorno más adelante.
  app.enableCors({ origin: true });

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

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] escuchando en http://localhost:${port}  ·  docs en /docs`);
}

void bootstrap();
