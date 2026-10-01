/**
 * One-time script: inserts the "QA Testing" menu item under Work Management
 * and assigns TEST_READ + TEST_MANAGE permissions to it.
 *
 * Run with:
 *   npx ts-node prisma/add-test-management-menu.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Find the Work Management parent menu
  const parent = await prisma.menu.findUnique({ where: { path: '/work' } });
  if (!parent) {
    throw new Error('Work Management menu (/work) not found. Run the main seed first.');
  }

  // 2. Find both permissions
  const permRead = await prisma.permission.findFirst({ where: { name: 'TEST_READ' } });
  const permManage = await prisma.permission.findFirst({ where: { name: 'TEST_MANAGE' } });
  if (!permRead || !permManage) {
    throw new Error('TEST_READ or TEST_MANAGE permission not found. Run the main seed first.');
  }

  // 3. Upsert the menu item (safe to re-run)
  const existing = await prisma.menu.findUnique({ where: { path: '/test-management' } });

  if (existing) {
    console.log('Menu item /test-management already exists — ensuring permissions are assigned.');
    for (const perm of [permRead, permManage]) {
      await prisma.menuPermission.upsert({
        where: { menuId_permissionId: { menuId: existing.id, permissionId: perm.id } },
        update: {},
        create: { menuId: existing.id, permissionId: perm.id },
      });
      // also ensure parent has this permission so the group is visible
      await prisma.menuPermission.upsert({
        where: { menuId_permissionId: { menuId: parent.id, permissionId: perm.id } },
        update: {},
        create: { menuId: parent.id, permissionId: perm.id },
      });
    }
    console.log('✓ Done (already existed, permissions verified).');
    return;
  }

  // 4. Determine order: one after the last child
  const lastChild = await prisma.menu.findFirst({
    where: { parentId: parent.id },
    orderBy: { order: 'desc' },
  });
  const order = (lastChild?.order ?? 0) + 1;

  // 5. Create the menu item
  const menu = await prisma.menu.create({
    data: {
      name: 'QA Testing',
      path: '/test-management',
      icon: null,
      order,
      isActive: true,
      parentId: parent.id,
    },
  });

  // 6. Assign permissions to the new item and its parent
  for (const perm of [permRead, permManage]) {
    await prisma.menuPermission.create({
      data: { menuId: menu.id, permissionId: perm.id },
    });
    await prisma.menuPermission.upsert({
      where: { menuId_permissionId: { menuId: parent.id, permissionId: perm.id } },
      update: {},
      create: { menuId: parent.id, permissionId: perm.id },
    });
  }

  console.log(`✓ Created menu item "QA Testing" (id: ${menu.id}) under Work Management.`);
  console.log('  Path: /test-management');
  console.log('  Visible to roles with: TEST_READ or TEST_MANAGE permission.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
