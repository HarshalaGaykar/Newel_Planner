import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { join } from 'path';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './swagger.config';
import { SensitiveDataInterceptor } from './common/interceptors/sensitive-data.interceptor';
import { requestContext } from './common/request-context';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Swagger Configuration
  const config = buildSwaggerConfig();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
  app.use(cookieParser());

  // Establish per-request AsyncLocalStorage context for userId propagation to Prisma middleware
  app.use((req: any, _res: any, next: () => void) => {
    requestContext.run({ userId: null, ip: req.ip ?? null }, next);
  });

  // Static Assets for Uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  // Global Prefix
  app.setGlobalPrefix('api');

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const dbUrl = process.env.DATABASE_URL ?? '(not set)';

  // Global Interceptors
  app.useGlobalInterceptors(new SensitiveDataInterceptor());

  // Enable CORS
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
  });

  const port = process.env.PORT || 4001;
  await app.listen(port, '0.0.0.0');
  console.log('[BOOT] DB host/name:', dbUrl.replace(/:\/\/[^@]*@/, '://***@'));
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log(`Application is running on port ${port}`);
}
bootstrap();
