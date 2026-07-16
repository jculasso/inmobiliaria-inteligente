import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CORS abierto solo al frontend local por ahora; se endurece por entorno más adelante.
  app.enableCors({ origin: true });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] escuchando en http://localhost:${port}`);
}

void bootstrap();
