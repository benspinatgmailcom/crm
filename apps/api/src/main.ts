// Validate env first so bootstrap fails with a readable error if config is invalid
import './config/env';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow frontend origin; must allow Authorization header for Bearer token in production (cross-origin)
  app.enableCors({
    origin: true, // reflect request origin, or set to env.FRONTEND_URL / list of origins in production
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api', app, document);

  const port = env.PORT;
  await app.listen(port);
  console.log(`API running at http://localhost:${port}`);
  console.log(`Swagger at http://localhost:${port}/api`);
}

bootstrap();
