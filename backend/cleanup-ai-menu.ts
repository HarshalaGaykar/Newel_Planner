import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Find the old AI Insights menu item
  const oldMenu = await prisma.menu.findFirst({
    where: { path: '/dashboard/ai' }
  });

  if (oldMenu) {
    // Delete permissions linked to it
    await prisma.menuPermission.deleteMany({ where: { menuId: oldMenu.id } });
    // Delete the menu itself
    await prisma.menu.delete({ where: { id: oldMenu.id } });
    console.log('✓ Deleted old AI menu item at /dashboard/ai');
  }

  // 2. Ensure the new one is the only one and has the correct name
  const newMenu = await prisma.menu.findFirst({
    where: { path: '/advanced-analytics' }
  });

  if (newMenu) {
    await prisma.menu.update({
      where: { id: newMenu.id },
      data: { name: 'AI Insights' }
    });
    console.log('✓ Verified new AI menu item at /advanced-analytics');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
