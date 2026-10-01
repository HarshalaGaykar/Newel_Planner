import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Administration parent menu
  let adminMenu = await prisma.menu.findFirst({ where: { name: 'Administration' } });
  if (!adminMenu) {
    adminMenu = await prisma.menu.findFirst({ where: { path: '/admin' } });
  }

  const parentId = adminMenu?.id || null;

  // Find ADMIN_CONFIG_VIEW permission to re-use for locations
  let perm = await prisma.permission.findUnique({ where: { name: 'ADMIN_CONFIG_VIEW' } });
  if (!perm) {
    perm = await prisma.permission.create({ data: { name: 'ADMIN_CONFIG_VIEW', description: 'View Admin Configuration' } });
  }

  // Upsert Location Menu
  const locationMenuData = {
    name: 'Location Master',
    path: '/locations',
    icon: '📍',
    order: 101,
    isActive: true,
    parentId,
  };

  let locMenu = await prisma.menu.findUnique({ where: { path: '/locations' } });
  if (!locMenu) {
    locMenu = await prisma.menu.create({ data: locationMenuData });
  }

  // Assign permission
  await prisma.menuPermission.upsert({
    where: { menuId_permissionId: { menuId: locMenu.id, permissionId: perm.id } },
    update: {},
    create: { menuId: locMenu.id, permissionId: perm.id },
  });

  console.log(`✓ Added /locations to the menu system.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
