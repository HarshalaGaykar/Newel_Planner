import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const menus = await prisma.menu.findMany({
    where: {
      OR: [
        { name: { contains: 'AI' } },
        { name: { contains: 'Insights' } },
        { path: { contains: 'analytics' } },
        { path: { contains: 'anomalies' } },
        { path: { contains: 'portfolio' } }
      ]
    }
  });
  console.log(JSON.stringify(menus, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
