import { PrismaClient, DataScope } from '@prisma/client';

async function fixScopes() {
  const p = new PrismaClient();
  
  // Update TL scopes to TEAM
  const tlPermissionsToTeam = [
    'ATTENDANCE_MANAGE',
    'ATTENDANCE_REGULARIZE_APPROVE',
    'COMPOFF_APPROVE',
    'WORKFORCE_TIMESHEET_APPROVE',
  ];

  for (const perm of tlPermissionsToTeam) {
    await p.rolePermission.updateMany({
      where: { role: { name: 'TL' }, permission: { name: perm } },
      data: { dataScope: DataScope.TEAM }
    });
  }

  // Update PM scopes to PROJECT
  const pmPermissionsToProject = [
    'ATTENDANCE_MANAGE',
    'ATTENDANCE_REGULARIZE_APPROVE',
    'COMPOFF_APPROVE',
    'COMPOFF_MANAGE',
    'WORKFORCE_TIMESHEET_APPROVE',
  ];

  for (const perm of pmPermissionsToProject) {
    await p.rolePermission.updateMany({
      where: { role: { name: 'PM' }, permission: { name: perm } },
      data: { dataScope: DataScope.PROJECT }
    });
  }

  console.log('Scopes updated successfully.');
}

fixScopes().catch(console.error).finally(() => process.exit(0));
