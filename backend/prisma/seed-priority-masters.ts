import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const priorities = [
  { name: 'CRITICAL', color: '#DC2626', sortOrder: 1 },
  { name: 'HIGH', color: '#EA580C', sortOrder: 2 },
  { name: 'MEDIUM', color: '#CA8A04', sortOrder: 3 },
  { name: 'LOW', color: '#16A34A', sortOrder: 4 },
];

async function main() {
  for (const priority of priorities) {
    await prisma.priorityMaster.upsert({
      where: { name: priority.name },
      update: priority,
      create: priority,
    });
  }

  console.log('Seeded priority masters.');
}

main()
  .catch((error) => {
    console.error('Priority master seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
