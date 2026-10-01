import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const perm = await prisma.permission.upsert({
    where: { name: 'CR_VIEW' },
    update: {},
    create: { name: 'CR_VIEW', description: 'View Change Requests' }
  });
  
  const role = await prisma.role.findFirst({ where: { name: 'PM' }});
  if (role) {
    const existingRolePerm = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: perm.id }
    });
    if (!existingRolePerm) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id }
      });
    }
  }

  const parent = await prisma.menu.findFirst({ where: { name: 'Work Management' }});
  if (parent) {
    const menu = await prisma.menu.findFirst({ where: { name: 'Change Requests' }});
    if (!menu) {
      const newMenu = await prisma.menu.create({
        data: { name: 'Change Requests', path: '/change-requests', order: 6, parentId: parent.id }
      });
      await prisma.menuPermission.create({
        data: { menuId: newMenu.id, permissionId: perm.id }
      });
      console.log('Created Menu Change Requests');
    } else {
      console.log('Menu Change Requests already exists');
    }
  } else {
    console.log('Parent menu not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
