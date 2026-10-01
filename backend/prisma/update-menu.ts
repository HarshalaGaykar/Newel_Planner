import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating Menu...');

  const reportsMenu = await prisma.menu.findFirst({
    where: { name: 'Reports' },
  });

  if (!reportsMenu) {
    console.error('❌ "Reports" menu not found. Please run full seed first.');
    return;
  }

  const availabilityMenu = await prisma.menu.upsert({
    where: { path: '/reports/resource-availability' },
    update: {
      name: 'Resource Availability',
      order: 4,
      parentId: reportsMenu.id,
    },
    create: {
      name: 'Resource Availability',
      path: '/reports/resource-availability',
      order: 4,
      parentId: reportsMenu.id,
    },
  });

  // Assign permission
  const perm = await prisma.permission.findFirst({
    where: { name: 'REPORT_UTILIZATION_VIEW' },
  });

  if (perm) {
    await prisma.menuPermission.upsert({
      where: {
        menuId_permissionId: {
          menuId: availabilityMenu.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        menuId: availabilityMenu.id,
        permissionId: perm.id,
      },
    });
  }

  console.log('✅ Resource Availability menu added under Reports.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
