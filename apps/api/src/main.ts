import { config } from 'dotenv';
import * as path from 'path';

// Load env from packages/db for DATABASE_URL (dev)
if (process.env.NODE_ENV !== 'production') {
  config({ path: path.resolve(process.cwd(), '../../packages/db/.env') });
  config(); // Override with apps/api/.env if present
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('CRM API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running at http://localhost:${port}`);
  console.log(`Swagger at http://localhost:${port}/api`);
}

bootstrap();
