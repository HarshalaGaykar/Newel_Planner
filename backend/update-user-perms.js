const { PrismaClient } = require('@prisma/client');

async function update() {
  const prisma = new PrismaClient();
  try {
    const allRoles = await prisma.role.findMany();
    const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

    const allPerms = await prisma.permission.findMany();
    const permMap = Object.fromEntries(allPerms.map((p) => [p.name, p.id]));

    // ── Gap fixes ──────────────────────────────────────────────────────────────
    // PM: was missing WORKFORCE_TIMESHEET_CREATE, WORKFORCE_LEAVE_VIEW, ATTENDANCE_READ
    // TL: was missing WORKFORCE_TIMESHEET_CREATE, WORKFORCE_LEAVE_VIEW, ATTENDANCE_READ
    const additions = [
      // PM gaps
      { role: 'PM', perm: 'WORKFORCE_TIMESHEET_CREATE' },
      { role: 'PM', perm: 'WORKFORCE_LEAVE_VIEW' },
      { role: 'PM', perm: 'ATTENDANCE_READ' },
      // TL gaps
      { role: 'TL', perm: 'WORKFORCE_TIMESHEET_CREATE' },
      { role: 'TL', perm: 'WORKFORCE_LEAVE_VIEW' },
      { role: 'TL', perm: 'ATTENDANCE_READ' },
      // HR gap — onboarding capability
      { role: 'HR', perm: 'USER_CREATE' },
      { role: 'HR', perm: 'USER_UPDATE' },
      // FREELANCER gap — on-site attendance
      { role: 'FREELANCER', perm: 'ATTENDANCE_READ' },
      { role: 'FREELANCER', perm: 'ATTENDANCE_MARK' },
    ];

    for (const { role, perm } of additions) {
      const roleId = roleMap[role];
      const permissionId = permMap[perm];
      if (!roleId || !permissionId) {
        console.warn(`  SKIP ${role}.${perm} — not found in DB`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
      console.log(`  ✓ Granted ${perm} → ${role}`);
    }

    // ── Data scope assignments ──────────────────────────────────────────────────
    // WORKFORCE_LEAVE_VIEW: PM → PROJECT, TL → TEAM  (mirrors leave-view scoping)
    // ATTENDANCE_READ:      PM → PROJECT, TL → TEAM  (mirrors attendance scoping)
    const scopeUpdates = [
      { role: 'PM', perm: 'WORKFORCE_LEAVE_VIEW', scope: 'PROJECT' },
      { role: 'TL', perm: 'WORKFORCE_LEAVE_VIEW', scope: 'TEAM'    },
      { role: 'PM',         perm: 'ATTENDANCE_READ', scope: 'PROJECT' },
      { role: 'TL',         perm: 'ATTENDANCE_READ', scope: 'TEAM'    },
      { role: 'FREELANCER', perm: 'ATTENDANCE_READ', scope: 'OWN'     },
    ];

    for (const { role, perm, scope } of scopeUpdates) {
      const roleId = roleMap[role];
      const permissionId = permMap[perm];
      if (!roleId || !permissionId) continue;
      await prisma.rolePermission.updateMany({
        where: { roleId, permissionId },
        data: { dataScope: scope },
      });
      console.log(`  ✓ Scoped ${role}.${perm} → ${scope}`);
    }

    console.log('\n✅ Permission gap fixes applied successfully.');
    console.log('   Users must re-login to receive updated permissions in their JWT.');
  } catch (e) {
    console.error('❌ Update failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

update();
