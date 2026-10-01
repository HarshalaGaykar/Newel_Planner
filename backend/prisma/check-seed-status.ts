// Read-only audit: diffs the seed source-of-truth against the connected DB and
// reports what `npm run prisma:seed:*` would still need to write. No writes are
// performed here — safe to run against production/UAT.
import { PrismaClient } from '@prisma/client';
import { permissionsData, permissionNamesByRole, roleNames } from './seed-role-permissions-only';
import { configs, numberSeries } from './seed-admin-configuration';

const prisma = new PrismaClient();

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  let gaps = 0;

  // ── Roles ──────────────────────────────────────────────────────────────
  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const missingRoles = roleNames.filter((name) => !roleMap[name]);
  section('Roles');
  if (missingRoles.length) {
    gaps += missingRoles.length;
    console.log(`MISSING: ${missingRoles.join(', ')}`);
  } else {
    console.log('OK — all expected roles exist.');
  }

  // ── Permissions ────────────────────────────────────────────────────────
  const dbPermissions = await prisma.permission.findMany();
  const dbPermissionNames = new Set(dbPermissions.map((p) => p.name));
  const missingPermissions = permissionsData
    .map((p) => p.name)
    .filter((name) => !dbPermissionNames.has(name));
  section('Permissions (Permission table)');
  if (missingPermissions.length) {
    gaps += missingPermissions.length;
    console.log(`MISSING (${missingPermissions.length}): ${missingPermissions.join(', ')}`);
  } else {
    console.log('OK — every permission in code exists in the DB.');
  }

  // ── Role → Permission mappings ────────────────────────────────────────
  const permissionMap = Object.fromEntries(dbPermissions.map((p) => [p.name, p.id]));
  const rolePermissions = await prisma.rolePermission.findMany();
  const grantedKey = (roleId: string, permissionId: string) => `${roleId}:${permissionId}`;
  const grantedSet = new Set(rolePermissions.map((rp) => grantedKey(rp.roleId, rp.permissionId)));

  section('Role → Permission mappings');
  let roleGapFound = false;
  // ADMIN is expected to have every known permission.
  if (roleMap.ADMIN) {
    const missingForAdmin = dbPermissions
      .filter((p) => !grantedSet.has(grantedKey(roleMap.ADMIN, p.id)))
      .map((p) => p.name);
    if (missingForAdmin.length) {
      roleGapFound = true;
      gaps += missingForAdmin.length;
      console.log(`ADMIN missing (${missingForAdmin.length}): ${missingForAdmin.join(', ')}`);
    }
  }
  for (const [roleName, permissionNames] of Object.entries(permissionNamesByRole)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue; // already reported under Roles
    const missing = permissionNames.filter((name) => {
      const permissionId = permissionMap[name];
      return permissionId && !grantedSet.has(grantedKey(roleId, permissionId));
    });
    if (missing.length) {
      roleGapFound = true;
      gaps += missing.length;
      console.log(`${roleName} missing (${missing.length}): ${missing.join(', ')}`);
    }
  }
  if (!roleGapFound) console.log('OK — every role has its expected permissions.');

  // ── Admin Config ───────────────────────────────────────────────────────
  const dbConfigs = await prisma.adminConfig.findMany();
  const dbConfigKeys = new Set(dbConfigs.map((c) => c.key));
  const missingConfigs = configs.map((c) => c.key).filter((key) => !dbConfigKeys.has(key));
  section('Admin Config keys');
  if (missingConfigs.length) {
    gaps += missingConfigs.length;
    console.log(`MISSING: ${missingConfigs.join(', ')}`);
  } else {
    console.log('OK — every admin config key exists.');
  }

  // ── Number Series ──────────────────────────────────────────────────────
  const dbSeries = await prisma.numberSeries.findMany();
  const dbSeriesModules = new Set(dbSeries.map((s) => s.module));
  const missingSeries = numberSeries.map((s) => s.module).filter((m) => !dbSeriesModules.has(m));
  section('Number Series modules');
  if (missingSeries.length) {
    gaps += missingSeries.length;
    console.log(`MISSING: ${missingSeries.join(', ')}`);
  } else {
    console.log('OK — every number series module exists.');
  }

  section('Summary');
  if (gaps === 0) {
    console.log('Nothing to seed — DB is in sync with code.');
  } else {
    console.log(`${gaps} gap(s) found. Run the corresponding "npm run prisma:seed:*:prod" script(s) to fix.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Seed status check failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
