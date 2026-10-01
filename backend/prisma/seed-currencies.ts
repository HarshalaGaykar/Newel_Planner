import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const currencies = [
  { code: 'INR', name: 'Indian Rupee', symbol: 'INR', exchangeRate: 1.0, isBase: true, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 83.5, isBase: false, isActive: true },
];

async function main() {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    });
  }

  console.log('Seeded currencies.');
}

main()
  .catch((error) => {
    console.error('Currency seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
