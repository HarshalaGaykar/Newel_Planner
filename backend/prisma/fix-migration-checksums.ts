/**
 * One-time script: recomputes SHA-256 checksums for migration files that were
 * edited after being applied, and writes them back to _prisma_migrations so
 * that `prisma migrate dev` stops detecting a drift / prompting for a reset.
 *
 * Run with:
 *   npx dotenv-cli -e .env.development -- ts-node prisma/fix-migration-checksums.ts
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const migrations = [
  '20260515074829_add_skill_category',
  '20260515080202_add_skill_category_is_active',
  '20260608000000_add_task_type_master',
];

async function main() {
  for (const migration of migrations) {
    const filePath = join(__dirname, 'migrations', migration, 'migration.sql');
    const content = readFileSync(filePath, 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');

    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = $2`,
      checksum,
      migration,
    );

    if (updated) {
      console.log(`✔ Updated checksum for ${migration}`);
    } else {
      console.warn(`⚠ No row found for ${migration} — skipping`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
