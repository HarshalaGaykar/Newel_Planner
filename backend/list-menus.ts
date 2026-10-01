import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const menus = await prisma.menu.findMany();
  console.log(JSON.stringify(menus, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
