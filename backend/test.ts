import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    console.log("ADMIN role not found!");
    return;
  }

  const perms = await prisma.permission.findMany({
    where: { name: { in: ['ASSET_READ', 'ASSET_MANAGE', 'CLIENT_READ', 'CLIENT_MANAGE'] } }
  });

  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id }
    });
  }

  console.log("Assigned permissions to ADMIN role:", perms.map(p => p.name));
}

main().finally(()=>prisma.$disconnect());
