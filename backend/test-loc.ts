import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const m = await prisma.menu.findFirst({ where: { name: { contains: 'Location' } } });
  console.log(m?.name || 'Not Found');
}
main().finally(()=>prisma.$disconnect());
