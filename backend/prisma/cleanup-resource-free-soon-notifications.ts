import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// One-off data cleanup ahead of removing NotificationType.RESOURCE_FREE_SOON
// from the schema. Postgres can't narrow an enum type while rows still
// reference the value being dropped, so these rows have to go first — raw SQL
// on purpose, so this still runs correctly even after the enum value has
// already been removed from schema.prisma (before `prisma generate`/`migrate
// dev` has actually re-synced the generated client).
//
// Run this once, THEN run:
//   npx prisma migrate dev --name remove_resource_free_soon_notification_type
async function main() {
  const prefsDeleted = await prisma.$executeRaw`
    DELETE FROM "NotificationPreference" WHERE "type" = 'RESOURCE_FREE_SOON'
  `;
  const notificationsDeleted = await prisma.$executeRaw`
    DELETE FROM "Notification" WHERE "type" = 'RESOURCE_FREE_SOON'
  `;
  console.log(
    `Deleted ${notificationsDeleted} notification(s) and ${prefsDeleted} preference row(s) with type RESOURCE_FREE_SOON.`,
  );
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
