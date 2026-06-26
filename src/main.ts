import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Book Library API')
    .setDescription('Staff-facing API for book borrowing workflows')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  registerFrontendStaticAssets(app);

  await app.listen(Number(process.env.PORT ?? 3000));
}

function registerFrontendStaticAssets(app: NestExpressApplication) {
  const staticRoot = resolveFrontendStaticRoot();

  if (!staticRoot) {
    return;
  }

  app.useStaticAssets(staticRoot);

  const httpAdapter = app.getHttpAdapter();
  const express = httpAdapter.getInstance();
  const indexPath = join(staticRoot, 'index.html');

  express.get(frontendRoutePattern, (_request, response) => {
    response.sendFile(indexPath);
  });
}

function resolveFrontendStaticRoot(): string | undefined {
  const candidates = [
    process.env.FRONTEND_STATIC_DIR,
    join(process.cwd(), 'public'),
    join(process.cwd(), 'frontend', 'dist'),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(join(candidate, 'index.html')));
}

const frontendRoutePattern =
  /^\/(?:$|login$|unauthorized$|staff(?:\/.*)?$|member(?:\/.*)?$)/;

bootstrap();
