import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './swagger.config';

/**
 * Generates the OpenAPI spec as a static file WITHOUT starting the HTTP server.
 * Output: backend/openapi.json  — share this file with the AI engineer.
 *
 * Must run against the compiled build (dist/) so the @nestjs/swagger CLI plugin
 * has enriched the DTO metadata. The npm script handles this: `npm run openapi:export`.
 */
async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });

  // Mirror the runtime routing so paths in the spec match the live API
  // (e.g. /api/v1/projects). Keep in sync with main.ts.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  const outPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');

  await app.close();
  console.log(`OpenAPI spec written to ${outPath}`);
}

exportOpenApi().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
