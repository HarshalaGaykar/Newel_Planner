-- Adds the WORKFORCE_TIMESHEET_BULK_UPLOAD permission and grants it to the roles
-- that previously relied on WORKFORCE_TIMESHEET_CREATE for the timesheet bulk-fill
-- feature (see timesheets.controller.ts — bulk-template / bulk-upload /
-- bulk-uploads / bulk-upload/:batchId/rollback).
--
-- This is a DATA migration only — no schema change. It mirrors what
-- prisma/seed-role-permissions-only.ts would do, so environments can be brought
-- up to date with `prisma migrate deploy` instead of running the TS seed.
--
-- Grants preserve existing behaviour: every role that holds
-- WORKFORCE_TIMESHEET_CREATE today also gets BULK_UPLOAD, so nobody loses the
-- feature on deploy. Revoke per role afterwards via /admin/roles.
--
-- Idempotent — safe to re-run.

-- 0) Ensure gen_random_uuid() is available (needed on fresh/shadow databases).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create the permission (or refresh its description if it already exists).
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'WORKFORCE_TIMESHEET_BULK_UPLOAD',
  'Bulk-fill Timesheet from Excel template',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
  SET "description" = EXCLUDED."description",
      "updatedAt"   = CURRENT_TIMESTAMP;

-- 2) Grant it to ADMIN, PM, TL, USER and FREELANCER.
--    "dataScope" is intentionally omitted so the column default ('OWN') applies —
--    this permission is not in the seed's scopePermissions list.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."name" = 'WORKFORCE_TIMESHEET_BULK_UPLOAD'
  AND r."name" IN ('ADMIN', 'PM', 'TL', 'USER', 'FREELANCER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
