
import { PrismaClient } from '@prisma/client';

async function check() {
  const prisma = new PrismaClient();
  const perms = await prisma.permission.findMany({ select: { name: true } });
  console.log('Available Permissions:', perms.map(p => p.name).join(', '));
  
  const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' }, include: { permissions: { include: { permission: true } } } });
  if (adminRole) {
    console.log('ADMIN Permissions:', adminRole.permissions.map(p => p.permission.name).join(', '));
  }
  
  await prisma.$disconnect();
}

check();
