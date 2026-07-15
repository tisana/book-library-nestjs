import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ConfigService } from '@nestjs/config';
// proxy-addr publishes a TypeScript `export =` declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import proxyaddr = require('proxy-addr');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const trustedProxyCidrs =
    configService.get<string[]>('auth.trustedProxyCidrs') ?? [];
  const trustedBrowserOrigins = new Set(
    configService.get<string[]>('auth.trustedBrowserOrigins') ?? [],
  );

  app.set(
    'trust proxy',
    trustedProxyCidrs.length > 0
      ? proxyaddr.compile(trustedProxyCidrs)
      : () => false,
  );
  app.enableCors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, trustedBrowserOrigins.has(origin));
    },
    credentials: true,
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

  return candidates.find((candidate) =>
    existsSync(join(candidate, 'index.html')),
  );
}

const frontendRoutePattern =
  /^\/(?:$|login$|unauthorized$|staff(?:\/.*)?$|member(?:\/.*)?$)/;

bootstrap();
