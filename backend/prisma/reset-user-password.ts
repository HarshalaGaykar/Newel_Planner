/**
 * One-off script: reset a user's password and clear failedAttempts in the prod DB.
 *
 * Usage (prod):
 *   dotenv -e .env.production -- ts-node prisma/reset-user-password.ts
 *
 * Usage (dev):
 *   dotenv -e .env.development -- ts-node prisma/reset-user-password.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// ── CONFIGURE THESE TWO VALUES ──────────────────────────────────────────────
const TARGET_EMAIL = 'admin@enterprise.com'; // change if needed
const NEW_PASSWORD = 'Password@123'; // set to your desired password
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      select: { id: true, email: true, failedAttempts: true, isActive: true },
    });

    if (!user) {
      console.error(`No user found with email: ${TARGET_EMAIL}`);
      process.exit(1);
    }

    console.log('Current state:', user);

    const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        failedAttempts: 0,
        isActive: true,
      },
    });

    console.log(`✓ Password reset for ${TARGET_EMAIL}`);
    console.log(`✓ failedAttempts cleared, isActive set to true`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
