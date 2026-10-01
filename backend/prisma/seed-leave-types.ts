import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Same list as the "Leave Type Masters" block in seed.ts, kept in sync by hand —
// a standalone, idempotent script so leave types can be (re)seeded on their own
// without running the full seed. Re-running this is safe: it upserts by code
// and leaves everything else untouched on rows that already exist.
const leaveTypeDefs = [
  { code: 'CL',   name: 'Casual Leave',    isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
  { code: 'SL',   name: 'Sick Leave',      isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: false },
  { code: 'EL',   name: 'Earned Leave',    isPaid: true,  allowHalfDay: false, carryForwardMax: 30, requiresApproval: true },
  { code: 'LOP',  name: 'Loss of Pay',     isPaid: false, allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
  { code: 'CO',   name: 'Compensatory Off', isPaid: true, allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
  { code: 'PAID', name: 'Paid Leave',      isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
];

async function main() {
  for (const lt of leaveTypeDefs) {
    await prisma.leaveTypeMaster.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    });
  }
  console.log(`Seeded ${leaveTypeDefs.length} leave types.`);
}

main()
  .catch((error) => {
    console.error('Leave type seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
