import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfig } from './config/config';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: config.NODE_ENV === 'production' ? ['log', 'warn', 'error'] : ['debug', 'log', 'warn', 'error'],
    rawBody: true, // Stripe webhook signature verification needs the raw payload
  });

  app.use(helmet());
  app.enableCors({
    origin: config.API_CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  app.enableShutdownHooks();

  await app.listen(config.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`Grillz Studio API listening on :${config.API_PORT}`);
}

void bootstrap();
