import {
  ClassSerializerInterceptor,
  ConsoleLogger,
  Logger,
  LogLevel,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import { join } from 'path';

import { AppModule } from './app.module';

config();

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = [
    'error',
    'warn',
    'log',
    ...(isProduction ? [] : (['debug'] as LogLevel[])),
  ];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger('NestApplication', {
      json: isProduction,
      colors: !isProduction,
      logLevels,
    }),
  });
  app.set('query parser', 'extended');

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const mode = configService.get<string>('NODE_ENV');
  const url = configService.get<string>('APP_URL');
  const port = configService.get<number>('PORT') || 3000;

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const clientOrigins = (configService.get<string>('CLIENT_URL') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: clientOrigins.length > 0 ? clientOrigins : ['http://localhost:8000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Frame-Options',
    ],
    credentials: true,
  });

  app.useStaticAssets(join(__dirname, '..', 'node_modules', 'swagger-ui-dist'));

  const docConfig = new DocumentBuilder()
    .setTitle('Tasker API')
    .setDescription(`Tasker API - base URL: `)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-internal-key',
        in: 'header',
        description: 'INTERNAL_API_KEY for cron and debug assessment routes',
      },
      'internal-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, docConfig);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customJsStr: `
      (function () {
        document.documentElement.classList.remove('dark-mode');
        var observer = new MutationObserver(function () {
          if (document.documentElement.classList.contains('dark-mode')) {
            document.documentElement.classList.remove('dark-mode');
            observer.disconnect();
          }
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class'],
        });
      })();
    `,
  });

  await app.listen(port);
  const path = mode === 'production' ? url : `http://localhost:${port}`;
  logger.log(`Application is running on: ${path}`);
  logger.log(`Swagger docs available at: ${path}/docs`);
}

bootstrap();
