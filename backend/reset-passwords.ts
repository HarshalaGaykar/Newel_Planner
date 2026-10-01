import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('Password@123', 10);
  const result = await prisma.user.updateMany({
    data: { password: hashed, failedAttempts: 0 }
  });
  console.log(`Reset ${result.count} users' passwords to Password@123 and cleared failed attempts.`);
}
main().finally(() => prisma.$disconnect());
