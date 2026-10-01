import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst();
  console.log(u?.email);
  if (u) {
    const match = await bcrypt.compare('Password@123', u.password);
    console.log('Match:', match, 'Failed:', u.failedAttempts, 'Active:', u.isActive);
  }
}
main().finally(() => prisma.$disconnect());
