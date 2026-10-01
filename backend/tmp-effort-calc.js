/* READ-ONLY effort-% calculator. No writes.
 * Usage: node tmp-effort-calc.js <effortHrs> <startYYYY-MM-DD> <endYYYY-MM-DD> [dailyHours] [assigneeCount]
 * Replicates the allocation-dashboard time-phasing exactly (holiday-aware). */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EFFORT = Number(process.argv[2] ?? 100);
const START = new Date(process.argv[3] ?? '2026-06-01');
const END = new Date(process.argv[4] ?? '2026-08-31');
const DAILY = Number(process.argv[5] ?? 8);
const ASSIGNEES = Number(process.argv[6] ?? 1);
const round = (n) => Math.round(n * 10) / 10;

function countWorkingDays(start, end, holidaySet) {
  let c = 0;
  const d = new Date(start); d.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(23, 59, 59, 999);
  while (d <= e) {
    const g = d.getDay();
    if (g !== 0 && g !== 6 && !holidaySet.has(d.toISOString().slice(0, 10))) c++;
    d.setDate(d.getDate() + 1);
  }
  return c;
}

async function main() {
  const spanStart = new Date(START.getFullYear(), START.getMonth(), 1);
  const spanEnd = new Date(END.getFullYear(), END.getMonth() + 1, 0, 23, 59, 59, 999);

  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: spanStart, lte: spanEnd }, isOptional: false, isGlobal: true },
    select: { date: true, name: true },
  });
  const holidaySet = new Set(holidays.map(h => h.date.toISOString().slice(0, 10)));

  const taskWD = countWorkingDays(START, END, holidaySet);
  const perDay = EFFORT / taskWD;                 // hours per working day for the whole task
  const perDayPerAssignee = perDay / ASSIGNEES;

  console.log(`\nTask: ${EFFORT}h  from ${process.argv[3] ?? '2026-06-01'} to ${process.argv[4] ?? '2026-08-31'}  |  dailyHours=${DAILY}  assignees=${ASSIGNEES}`);
  if (holidays.length) console.log('holidays in span:', holidays.map(h => `${h.date.toISOString().slice(0,10)} (${h.name})`).join(', '));
  console.log(`task working days = ${taskWD}  ->  per working day = ${round(perDay)}h${ASSIGNEES > 1 ? ` (÷${ASSIGNEES} = ${round(perDayPerAssignee)}h each)` : ''}\n`);
  console.log('month     | monthWD | task days in month | hours (each assignee) | capacity | %');
  console.log('----------|---------|--------------------|-----------------------|----------|----');

  let sum = 0;
  const cur = new Date(spanStart);
  while (cur <= spanEnd) {
    const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthFullWD = countWorkingDays(mStart, mEnd, holidaySet);
    const capacity = monthFullWD * DAILY;

    const os = START > mStart ? START : mStart;
    const oe = END < mEnd ? END : mEnd;
    let hrs = 0, taskDaysInMonth = 0;
    if (os <= oe) {
      taskDaysInMonth = countWorkingDays(os, oe, holidaySet);
      hrs = perDayPerAssignee * taskDaysInMonth;
    }
    sum += hrs;
    const pct = capacity > 0 ? Math.round((hrs / capacity) * 100) : 0;
    const label = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    console.log(`${label}   |   ${String(monthFullWD).padStart(2)}    |         ${String(taskDaysInMonth).padStart(2)}         |        ${String(round(hrs)).padStart(6)}h        |  ${String(capacity).padStart(4)}h   | ${pct}%`);

    cur.setMonth(cur.getMonth() + 1);
  }
  console.log(`\nsum of hours across months = ${round(sum * ASSIGNEES)}h (total task, all assignees) — should equal ${EFFORT}h ✓`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
