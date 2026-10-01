-- Delivery Tracker: replace the free-text DeliveryItem.currentStage with a FK to a
-- canonical stage master. The existing data had already drifted into casing
-- variants ("UAT" vs "uat"), which is exactly what a free-text column produces.

-- CreateTable
CREATE TABLE "DeliveryStageMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryStageMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStageMaster_name_key" ON "DeliveryStageMaster"("name");
CREATE INDEX "DeliveryStageMaster_isActive_idx" ON "DeliveryStageMaster"("isActive");

-- Seed the canonical stage list. Ids are fixed literals rather than
-- gen_random_uuid() so every environment ends up with the same ids, and so the
-- migration does not depend on the pgcrypto extension being installed.
INSERT INTO "DeliveryStageMaster" ("id", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('b6edd632-f449-4350-a297-485fe4037428', 'Requirement Discussion', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('67341082-5137-4ab7-be6b-6cedb3dee053', 'Requirement Clarification', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c3172532-3377-4abb-a3e3-6f7dace00864', 'Requirement Analysis', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d4a0cc14-73a9-4a7b-81da-0a44d7194454', 'Feasibility/Impact Analysis', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a978164b-a86f-420c-beb3-7d20bfbe2d82', 'Effort Estimation', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('31d16065-003b-48d0-b1ca-71ea479a9d76', 'Efforts Approval', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('86009e7b-a0f0-4a35-9b7c-6761f59a95f7', 'BRD Preparation', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eaf57721-05ce-4844-b908-4aa2e02ca766', 'BRD Review', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('774d6dc4-5295-42ff-9f40-ed36eba1998a', 'BRD Approval', 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f0a909f6-ab59-468b-b904-566aaa16413e', 'Development', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('15158e1a-ad93-441b-94c1-340fff0808a4', 'Code Review', 11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('aeb5c1ee-a4f6-4886-83ed-e6b19dc50acb', 'Internal Testing', 12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00d917f8-3da3-4d6c-96aa-5038238f95ac', 'Defect Fixing / Re-testing', 13, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('2ce9e3a5-7bfd-47b0-938a-c945c68f5a8c', 'UAT Preparation', 14, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('4a9a76e5-c9c4-4d24-8d0c-93f3a277411f', 'UAT', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('9c079220-b356-4387-b4c3-4e20f4ea519b', 'UAT Defect Fixing', 16, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('9a29f0ea-3ef7-4db0-ab68-f9aedc770d04', 'UAT Sign-off', 17, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('0c41a549-44c0-4e4a-8ed2-1955d5e71f4c', 'Pre-Live Preparation', 18, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('92b6abc2-b2b5-46af-b568-531adf9d3c2e', 'Production Readiness', 19, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d2800b0a-dd23-4835-8022-ef81e766116e', 'Production Deployment', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bcd17346-ce9e-4c75-908a-8f489bd62053', 'Prod', 21, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- AlterTable
ALTER TABLE "DeliveryItem" ADD COLUMN "stageId" TEXT;

-- Backfill: match existing free text to a canonical stage, case- and
-- whitespace-insensitively.
UPDATE "DeliveryItem" di
SET "stageId" = sm."id"
FROM "DeliveryStageMaster" sm
WHERE di."currentStage" IS NOT NULL
  AND LOWER(TRIM(di."currentStage")) = LOWER(sm."name");

-- Any stage text that is NOT in the canonical list becomes its own stage row
-- rather than being silently dropped. sortOrder 900 parks it after the canonical
-- list so it is obvious in the admin screen and can be merged by hand.
INSERT INTO "DeliveryStageMaster" ("id", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text)::uuid::text,
    d."stageName",
    900,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT TRIM("currentStage") AS "stageName"
    FROM "DeliveryItem"
    WHERE "stageId" IS NULL
      AND "currentStage" IS NOT NULL
      AND TRIM("currentStage") <> ''
) d
ON CONFLICT ("name") DO NOTHING;

-- Map anything the first pass missed.
UPDATE "DeliveryItem" di
SET "stageId" = sm."id"
FROM "DeliveryStageMaster" sm
WHERE di."stageId" IS NULL
  AND di."currentStage" IS NOT NULL
  AND LOWER(TRIM(di."currentStage")) = LOWER(sm."name");

-- DropColumn
ALTER TABLE "DeliveryItem" DROP COLUMN "currentStage";

-- CreateIndex
CREATE INDEX "DeliveryItem_stageId_idx" ON "DeliveryItem"("stageId");

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "DeliveryStageMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
