/**
 * Backfill Task.dailyEffort / workingDays for tasks that predate the column
 * (migrated legacy rows). Idempotent — safe to re-run, including after the
 * holiday master changes and stored values go stale.
 *
 *   npm run prisma:backfill:daily-effort:dev
 *   npm run prisma:backfill:daily-effort:prod
 */
import { PrismaClient } from '@prisma/client';
import { deriveDailyEffort } from '../src/tasks/daily-effort.util';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
  // Same holiday rule as the importers: global, non-optional only.
  const holidays = await prisma.publicHoliday.findMany({
    where: { isOptional: false, isGlobal: true },
    select: { date: true },
  });
  const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  const total = await prisma.task.count();
  console.log(`Tasks: ${total} · holidays: ${holidayDates.size}`);

  let processed = 0;
  let changed = 0;
  let cursor: string | undefined;

  for (;;) {
    const tasks = await prisma.task.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        estimatedEffort: true,
        plannedHours: true,
        startDate: true,
        endDate: true,
        plannedStart: true,
        plannedEnd: true,
        dailyEffort: true,
        workingDays: true,
      },
    });
    if (tasks.length === 0) break;
    cursor = tasks[tasks.length - 1].id;

    const updates: ReturnType<typeof prisma.task.update>[] = [];
    for (const task of tasks) {
      const effort =
        task.estimatedEffort && task.estimatedEffort > 0 ? task.estimatedEffort : task.plannedHours;
      const derived = deriveDailyEffort(
        effort,
        task.startDate ?? task.plannedStart,
        task.endDate ?? task.plannedEnd,
        holidayDates,
      );
      const dailyEffort = derived?.dailyEffort ?? null;
      const workingDays = derived?.workingDays ?? null;
      if (dailyEffort === task.dailyEffort && workingDays === task.workingDays) continue;
      updates.push(
        prisma.task.update({
          where: { id: task.id },
          data: { dailyEffort, workingDays },
        }),
      );
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
      changed += updates.length;
    }
    processed += tasks.length;
    console.log(`Processed ${processed}/${total} (changed ${changed})`);
  }

  console.log(`Done. Updated ${changed} task(s).`);
}

main()
  .catch((error) => {
    console.error('Daily-effort backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
