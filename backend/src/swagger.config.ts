import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Shared Swagger/OpenAPI definition — used by both the live docs UI
 * (main.ts) and the standalone spec export script (scripts/export-openapi.ts).
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Planner Enterprise API')
    .setDescription(
      'The core API for Workforce Management, Resource Planning, and Financial Governance.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
