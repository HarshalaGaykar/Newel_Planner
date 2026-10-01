import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const departments = [
  { name: 'Engineering', description: 'Software engineering team' },
  { name: 'QA', description: 'Quality assurance team' },
  { name: 'DevOps', description: 'Infrastructure and deployment' },
  { name: 'Product', description: 'Product management and design' },
  { name: 'Finance', description: 'Finance and billing operations' },
  { name: 'Human Resources', description: 'HR and people operations' },
];

async function main() {
  for (const department of departments) {
    await prisma.department.upsert({
      where: { name: department.name },
      update: { description: department.description },
      create: department,
    });
  }

  console.log('Seeded departments.');
}

main()
  .catch((error) => {
    console.error('Department seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
