import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const inrCurrency = await prisma.currency.findUnique({ where: { code: 'INR' } });
  if (!inrCurrency) {
    throw new Error('Currency INR is missing. Run the currencies seed first.');
  }

  await prisma.company.upsert({
    where: { name: 'Newel Technologies' },
    update: {
      currencyId: inrCurrency.id,
      isActive: true,
    },
    create: {
      name: 'Newel Technologies',
      gstin: null,
      currencyId: inrCurrency.id,
      isActive: true,
    },
  });

  console.log('Seeded company.');
}

main()
  .catch((error) => {
    console.error('Company seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
