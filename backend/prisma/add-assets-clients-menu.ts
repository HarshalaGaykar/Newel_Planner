import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Create Permissions
  const permissionsData = [
    { name: 'ASSET_READ', description: 'Can view assets' },
    { name: 'ASSET_MANAGE', description: 'Can manage assets' },
    { name: 'CLIENT_READ', description: 'Can view clients' },
    { name: 'CLIENT_MANAGE', description: 'Can manage clients' },
  ];

  const permissions: any[] = [];
  for (const permData of permissionsData) {
    let perm = await prisma.permission.findUnique({ where: { name: permData.name } });
    if (!perm) {
      perm = await prisma.permission.create({ data: permData });
    }
    permissions.push(perm);
  }

  // Assign to Admin role if it exists
  const adminRole = await prisma.role.findFirst({ where: { name: { contains: 'Admin' } } });
  if (adminRole) {
    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
  }

  // 2. Find Organization / Administration parent menu
  // Planner usually has 'Administration' or 'Org Masters'
  let adminMenu = await prisma.menu.findFirst({ where: { name: 'Administration' } });
  if (!adminMenu) {
    adminMenu = await prisma.menu.findFirst({ where: { path: '/admin' } });
  }

  if (!adminMenu) {
    console.log("No Administration menu found. Adding to root.");
  }

  const parentId = adminMenu?.id || null;

  // 3. Upsert Asset Menu
  const assetMenuData = {
    name: 'Asset Management',
    path: '/assets',
    icon: '💻', // or any emoji/icon identifier Planner uses
    order: 99,
    isActive: true,
    parentId,
  };

  let assetMenu = await prisma.menu.findUnique({ where: { path: '/assets' } });
  if (!assetMenu) {
    assetMenu = await prisma.menu.create({ data: assetMenuData });
  }

  // Assign permissions to Asset Menu
  for (const permName of ['ASSET_READ', 'ASSET_MANAGE']) {
    const perm = permissions.find(p => p.name === permName)!;
    await prisma.menuPermission.upsert({
      where: { menuId_permissionId: { menuId: assetMenu.id, permissionId: perm.id } },
      update: {},
      create: { menuId: assetMenu.id, permissionId: perm.id },
    });
  }

  // 4. Upsert Client Menu
  const clientMenuData = {
    name: 'Client Master',
    path: '/clients',
    icon: '🏢',
    order: 100,
    isActive: true,
    parentId,
  };

  let clientMenu = await prisma.menu.findUnique({ where: { path: '/clients' } });
  if (!clientMenu) {
    clientMenu = await prisma.menu.create({ data: clientMenuData });
  }

  // Assign permissions to Client Menu
  for (const permName of ['CLIENT_READ', 'CLIENT_MANAGE']) {
    const perm = permissions.find(p => p.name === permName)!;
    await prisma.menuPermission.upsert({
      where: { menuId_permissionId: { menuId: clientMenu.id, permissionId: perm.id } },
      update: {},
      create: { menuId: clientMenu.id, permissionId: perm.id },
    });
  }

  console.log(`✓ Added /assets and /clients to the menu system.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
