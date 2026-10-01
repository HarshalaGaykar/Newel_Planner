import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Ensure permissions exist
  const permRead = await prisma.permission.upsert({
    where: { name: 'TEST_READ' },
    update: {},
    create: { name: 'TEST_READ', description: 'View and take assigned tests' },
  });
  const permManage = await prisma.permission.upsert({
    where: { name: 'TEST_MANAGE' },
    update: {},
    create: { name: 'TEST_MANAGE', description: 'Create and manage tests, question banks, view results' },
  });

  console.log('✓ Permissions upserted.');

  // 2. Grant TEST_READ to all roles; TEST_MANAGE only to admin/HR
  const allRoles = await prisma.role.findMany();
  const managerRoleNames = ['ADMIN', 'HR', 'HR_MANAGER', 'MANAGER'];

  for (const role of allRoles) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permRead.id } },
      update: {},
      create: { roleId: role.id, permissionId: permRead.id },
    });

    if (managerRoleNames.some((n) => role.name.toUpperCase().includes(n))) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permManage.id } },
        update: {},
        create: { roleId: role.id, permissionId: permManage.id },
      });
    }
  }

  console.log('✓ Role-permission mappings upserted.');

  // 3. Employee menu — under "Workforce"
  const workforceParent = await prisma.menu.findFirst({ where: { name: 'Workforce' } });
  if (!workforceParent) {
    console.error('Parent menu "Workforce" not found — skipping employee Tests menu.');
  } else {
    const existingEmployee = await prisma.menu.findFirst({ where: { path: '/tests' } });
    if (existingEmployee) {
      console.log('Employee Tests menu already exists, skipping.');
    } else {
      const employeeMenu = await prisma.menu.create({
        data: {
          name: 'Assessments',
          path: '/tests',
          icon: '📝',
          order: 100,
          parentId: workforceParent.id,
        },
      });
      await prisma.menuPermission.create({
        data: { menuId: employeeMenu.id, permissionId: permRead.id },
      });
      console.log('✓ Employee Assessments menu created under Workforce.');
    }
  }

  // 4. Admin menu — under "Administration"
  const adminParent = await prisma.menu.findFirst({ where: { name: 'Administration' } });
  if (!adminParent) {
    console.error('Parent menu "Administration" not found — skipping admin Tests menu.');
  } else {
    const existingAdmin = await prisma.menu.findFirst({ where: { path: '/admin/tests' } });
    if (existingAdmin) {
      console.log('Admin Tests menu already exists, skipping.');
    } else {
      const adminMenu = await prisma.menu.create({
        data: {
          name: 'Test Management',
          path: '/admin/tests',
          icon: '🗂️',
          order: 100,
          parentId: adminParent.id,
        },
      });
      await prisma.menuPermission.create({
        data: { menuId: adminMenu.id, permissionId: permManage.id },
      });
      console.log('✓ Admin Test Management menu created under Administration.');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
