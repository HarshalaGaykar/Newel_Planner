/**
 * One-time script: inserts the "Leave Management" menu item under Administration
 * and assigns the WORKFORCE_LEAVE_APPROVE permission to it.
 *
 * Run with:
 *   npx ts-node prisma/add-leave-menu.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Find the Administration parent menu
  const parent = await prisma.menu.findUnique({ where: { path: '/admin' } });
  if (!parent) {
    throw new Error('Administration menu (/admin) not found. Run the main seed first.');
  }

  // 2. Find the required permission
  const permission = await prisma.permission.findFirst({
    where: { name: 'WORKFORCE_LEAVE_APPROVE' },
  });
  if (!permission) {
    throw new Error('Permission WORKFORCE_LEAVE_APPROVE not found. Run the main seed first.');
  }

  // 3. Upsert the menu item (safe to re-run)
  const existing = await prisma.menu.findUnique({ where: { path: '/admin/leaves' } });

  if (existing) {
    console.log('Menu item /admin/leaves already exists — ensuring permission is assigned.');
    await prisma.menuPermission.upsert({
      where: { menuId_permissionId: { menuId: existing.id, permissionId: permission.id } },
      update: {},
      create: { menuId: existing.id, permissionId: permission.id },
    });
    console.log('✓ Done (already existed, permission verified).');
    return;
  }

  // Determine order: one after the last child of Administration
  const lastChild = await prisma.menu.findFirst({
    where: { parentId: parent.id },
    orderBy: { order: 'desc' },
  });
  const order = (lastChild?.order ?? -1) + 1;

  const menu = await prisma.menu.create({
    data: {
      name: 'Leave Management',
      path: '/admin/leaves',
      icon: null,
      order,
      isActive: true,
      parentId: parent.id,
      permissions: {
        create: { permissionId: permission.id },
      },
    },
  });

  console.log(`✓ Created menu item "Leave Management" (id: ${menu.id}) under Administration.`);
  console.log('  Visible to: ADMIN and HR roles.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
