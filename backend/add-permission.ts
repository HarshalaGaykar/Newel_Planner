import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding REPORT_NON_COMPLIANCE_VIEW permission...');
  
  // 1. Ensure the permission exists
  const permission = await prisma.permission.upsert({
    where: { name: 'REPORT_NON_COMPLIANCE_VIEW' },
    update: {},
    create: {
      name: 'REPORT_NON_COMPLIANCE_VIEW',
      description: 'View Non-Compliance Report',
    },
  });
  console.log('Permission ID:', permission.id);

  // 2. Assign to ADMIN and HR roles
  const roles = await prisma.role.findMany({
    where: { name: { in: ['ADMIN', 'HR', 'PM'] } },
  });

  for (const role of roles) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
    console.log(`Assigned permission to role: ${role.name}`);
  }

  console.log('Done!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
