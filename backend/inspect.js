const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ts = await prisma.timesheet.findUnique({ where: { id: 'f7479ce2-e43e-48db-81f2-7e07172d72b0' } });
  console.log("Timesheet:", ts);
  
  if (ts && ts.userId) {
    const todayStart = new Date();
    todayStart.setUTCHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23,59,59,999);
    
    // get recent attendance
    const attendance = await prisma.attendance.findMany({
      where: { userId: ts.userId },
      orderBy: { date: 'desc' },
      take: 5
    });
    console.log("Recent Attendance:", attendance);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
