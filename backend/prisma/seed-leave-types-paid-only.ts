import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Restricts which leave types are selectable — used for the production
// environment, where only Paid Leave should be offered. This does NOT delete
// anything: existing leave requests and balances under the other codes are
// left untouched, they simply stop being offered for new applications.
// Enforced two ways already in the app, both driven off `isActive`:
//   - the "Apply Leave" dropdown filters to active types only
//     (frontend/app/(dashboard)/leaves/page.tsx)
//   - leaves.service.ts rejects an inactive code server-side even if someone
//     bypasses the dropdown
// Re-running this is safe/idempotent: it only writes rows whose isActive
// doesn't already match the desired state.
const KEEP_ACTIVE = 'PAID';

async function main() {
  const types = await prisma.leaveTypeMaster.findMany();

  if (!types.some((t) => t.code === KEEP_ACTIVE)) {
    throw new Error(`Leave type "${KEEP_ACTIVE}" does not exist yet — run the leave-types seed first.`);
  }

  let changed = 0;
  for (const t of types) {
    const shouldBeActive = t.code === KEEP_ACTIVE;
    if (t.isActive !== shouldBeActive) {
      await prisma.leaveTypeMaster.update({
        where: { id: t.id },
        data: { isActive: shouldBeActive },
      });
      changed++;
    }
  }

  console.log(`Leave types restricted to "${KEEP_ACTIVE}" only (${changed} row(s) updated, ${types.length} checked).`);
}

main()
  .catch((error) => {
    console.error('Leave type restriction seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
