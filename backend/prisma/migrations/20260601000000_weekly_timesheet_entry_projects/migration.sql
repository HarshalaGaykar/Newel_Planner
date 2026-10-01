-- Move project ownership from the weekly sheet to each logged entry.
ALTER TABLE "TimesheetEntry" ADD COLUMN "projectId" TEXT;

UPDATE "TimesheetEntry" AS entry
SET "projectId" = timesheet."projectId"
FROM "Timesheet" AS timesheet
WHERE entry."timesheetId" = timesheet."id";

-- Older data can contain one sheet per project for the same employee and week.
-- Keep the least advanced sheet and move all related records onto it so
-- unapproved entries are never silently promoted during consolidation.
WITH ranked_timesheets AS (
    SELECT
        "id",
        FIRST_VALUE("id") OVER (
            PARTITION BY "userId", "startDate"
            ORDER BY
                CASE "status"
                    WHEN 'REJECTED' THEN 1
                    WHEN 'DRAFT' THEN 2
                    WHEN 'SUBMITTED' THEN 3
                    WHEN 'RA_APPROVED' THEN 4
                    ELSE 5
                END,
                "updatedAt" DESC,
                "id"
        ) AS "keepId"
    FROM "Timesheet"
    WHERE "userId" IS NOT NULL
),
duplicate_timesheets AS (
    SELECT "id", "keepId"
    FROM ranked_timesheets
    WHERE "id" <> "keepId"
)
UPDATE "TimesheetEntry" AS entry
SET "timesheetId" = duplicate."keepId"
FROM duplicate_timesheets AS duplicate
WHERE entry."timesheetId" = duplicate."id";

WITH ranked_timesheets AS (
    SELECT
        "id",
        FIRST_VALUE("id") OVER (
            PARTITION BY "userId", "startDate"
            ORDER BY
                CASE "status"
                    WHEN 'REJECTED' THEN 1
                    WHEN 'DRAFT' THEN 2
                    WHEN 'SUBMITTED' THEN 3
                    WHEN 'RA_APPROVED' THEN 4
                    ELSE 5
                END,
                "updatedAt" DESC,
                "id"
        ) AS "keepId"
    FROM "Timesheet"
    WHERE "userId" IS NOT NULL
),
duplicate_timesheets AS (
    SELECT "id", "keepId"
    FROM ranked_timesheets
    WHERE "id" <> "keepId"
)
UPDATE "BackdatedTimesheetRequest" AS request
SET "timesheetId" = duplicate."keepId"
FROM duplicate_timesheets AS duplicate
WHERE request."timesheetId" = duplicate."id";

WITH ranked_timesheets AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "startDate"
            ORDER BY
                CASE "status"
                    WHEN 'REJECTED' THEN 1
                    WHEN 'DRAFT' THEN 2
                    WHEN 'SUBMITTED' THEN 3
                    WHEN 'RA_APPROVED' THEN 4
                    ELSE 5
                END,
                "updatedAt" DESC,
                "id"
        ) AS "rowNumber"
    FROM "Timesheet"
    WHERE "userId" IS NOT NULL
)
DELETE FROM "Timesheet" AS timesheet
USING ranked_timesheets AS ranked
WHERE timesheet."id" = ranked."id"
  AND ranked."rowNumber" > 1;

ALTER TABLE "Timesheet" ALTER COLUMN "projectId" DROP NOT NULL;
UPDATE "Timesheet" SET "projectId" = NULL WHERE "userId" IS NOT NULL;

DROP INDEX "Timesheet_userId_projectId_startDate_key";
CREATE UNIQUE INDEX "Timesheet_userId_startDate_key" ON "Timesheet"("userId", "startDate");

ALTER TABLE "TimesheetEntry" ALTER COLUMN "projectId" SET NOT NULL;
CREATE INDEX "TimesheetEntry_projectId_idx" ON "TimesheetEntry"("projectId");
ALTER TABLE "TimesheetEntry"
    ADD CONSTRAINT "TimesheetEntry_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
