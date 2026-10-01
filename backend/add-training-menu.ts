import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Ensure permissions exist
  const permRead = await prisma.permission.upsert({
    where: { name: 'TRAINING_READ' },
    update: {},
    create: { name: 'TRAINING_READ', description: 'View training programs and sessions' },
  });
  const permManage = await prisma.permission.upsert({
    where: { name: 'TRAINING_MANAGE' },
    update: {},
    create: { name: 'TRAINING_MANAGE', description: 'Create and manage training programs, sessions, enrollments' },
  });
  const permEnroll = await prisma.permission.upsert({
    where: { name: 'TRAINING_ENROLL' },
    update: {},
    create: { name: 'TRAINING_ENROLL', description: 'Enroll in training sessions' },
  });

  // 2. Grant TRAINING_READ + TRAINING_ENROLL to all active roles, TRAINING_MANAGE to admin/HR
  const allRoles = await prisma.role.findMany();
  const managerRoleNames = ['ADMIN', 'HR', 'HR_MANAGER', 'MANAGER'];

  for (const role of allRoles) {
    for (const perm of [permRead, permEnroll]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    if (managerRoleNames.some((n) => role.name.toUpperCase().includes(n))) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permManage.id } },
        update: {},
        create: { roleId: role.id, permissionId: permManage.id },
      });
    }
  }

  // 3. Find the "Workforce" parent menu
  const parent = await prisma.menu.findFirst({ where: { name: 'Workforce' } });
  if (!parent) {
    console.error('Parent menu "Workforce" not found — cannot add Training menu item.');
    return;
  }

  // 4. Create the menu item (idempotent)
  const existing = await prisma.menu.findFirst({ where: { path: '/training' } });
  if (existing) {
    console.log('Training menu already exists, skipping.');
    return;
  }

  const menu = await prisma.menu.create({
    data: {
      name: 'Training',
      path: '/training',
      icon: '🎓',
      order: 99,
      parentId: parent.id,
    },
  });

  // 5. Wire menu to TRAINING_READ permission (least-privilege gate)
  await prisma.menuPermission.create({
    data: { menuId: menu.id, permissionId: permRead.id },
  });

  console.log('✓ Training menu created and permissions wired.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
