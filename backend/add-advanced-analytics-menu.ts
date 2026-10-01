import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Ensure permissions exist
  const permAnalytics = await prisma.permission.upsert({
    where: { name: 'view:analytics' },
    update: {},
    create: { name: 'view:analytics', description: 'Access advanced AI analytics and health scores' },
  });

  // 2. Grant to ADMIN, PM, and HR roles
  const targetRoles = ['ADMIN', 'PROJECT_MANAGER', 'HR_MANAGER', 'MANAGER'];
  const roles = await prisma.role.findMany({
    where: { name: { in: targetRoles } }
  });

  for (const role of roles) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permAnalytics.id } },
      update: {},
      create: { roleId: role.id, permissionId: permAnalytics.id },
    });
  }

  // 3. Find the "Analytics" or "Portfolio" parent menu
  let parent = await prisma.menu.findFirst({ where: { name: 'Governance' } });
  if (!parent) parent = await prisma.menu.findFirst({ where: { name: 'Portfolio' } });
  
  // 4. Create the menu item
  const existing = await prisma.menu.findFirst({ where: { path: '/advanced-analytics' } });
  if (existing) {
    console.log('Advanced Analytics menu already exists, skipping.');
    return;
  }

  const menu = await prisma.menu.create({
    data: {
      name: 'AI Insights',
      path: '/advanced-analytics',
      icon: '🪄',
      order: 10,
      parentId: parent?.id || null,
    },
  });

  // 5. Wire menu to permission
  await prisma.menuPermission.create({
    data: { menuId: menu.id, permissionId: permAnalytics.id },
  });

  console.log('✓ Advanced Analytics menu created and permissions wired.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
