import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const skills = [
  'React',
  'Next.js',
  'TypeScript',
  'Node.js',
  'NestJS',
  'PostgreSQL',
  'Prisma',
  'AWS',
  'Docker',
  'Kubernetes',
  'Python',
  'Java',
  'Selenium',
  'Cypress',
  'Figma',
  'GraphQL',
  'Redis',
  'MongoDB',
];

async function main() {
  for (const name of skills) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeded skills.');
}

main()
  .catch((error) => {
    console.error('Skill seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
