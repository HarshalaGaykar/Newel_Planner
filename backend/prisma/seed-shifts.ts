import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.shift.upsert({
    where: { id: 'shift-general-001' },
    update: {
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      isDefault: true,
      isActive: true,
    },
    create: {
      id: 'shift-general-001',
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      isDefault: true,
      isActive: true,
    },
  });

  console.log('Seeded shifts.');
}

main()
  .catch((error) => {
    console.error('Shift seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
