import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Canonical delivery lifecycle stages. Ids are fixed so every environment ends
// up with the same rows — the same list is inlined in the
// 20260824123000_add_delivery_stage_master migration, which needs them present
// to backfill the old free-text DeliveryItem.currentStage values.
//
// Re-running this is safe: it upserts by name and leaves isActive alone on rows
// that already exist, so a stage deactivated in the admin screen stays that way.
const stages = [
  { id: "b6edd632-f449-4350-a297-485fe4037428", name: "Requirement Discussion", sortOrder: 1 },
  { id: "67341082-5137-4ab7-be6b-6cedb3dee053", name: "Requirement Clarification", sortOrder: 2 },
  { id: "c3172532-3377-4abb-a3e3-6f7dace00864", name: "Requirement Analysis", sortOrder: 3 },
  { id: "d4a0cc14-73a9-4a7b-81da-0a44d7194454", name: "Feasibility/Impact Analysis", sortOrder: 4 },
  { id: "a978164b-a86f-420c-beb3-7d20bfbe2d82", name: "Effort Estimation", sortOrder: 5 },
  { id: "31d16065-003b-48d0-b1ca-71ea479a9d76", name: "Efforts Approval", sortOrder: 6 },
  { id: "86009e7b-a0f0-4a35-9b7c-6761f59a95f7", name: "BRD Preparation", sortOrder: 7 },
  { id: "eaf57721-05ce-4844-b908-4aa2e02ca766", name: "BRD Review", sortOrder: 8 },
  { id: "774d6dc4-5295-42ff-9f40-ed36eba1998a", name: "BRD Approval", sortOrder: 9 },
  { id: "f0a909f6-ab59-468b-b904-566aaa16413e", name: "Development", sortOrder: 10 },
  { id: "15158e1a-ad93-441b-94c1-340fff0808a4", name: "Code Review", sortOrder: 11 },
  { id: "aeb5c1ee-a4f6-4886-83ed-e6b19dc50acb", name: "Internal Testing", sortOrder: 12 },
  { id: "00d917f8-3da3-4d6c-96aa-5038238f95ac", name: "Defect Fixing / Re-testing", sortOrder: 13 },
  { id: "2ce9e3a5-7bfd-47b0-938a-c945c68f5a8c", name: "UAT Preparation", sortOrder: 14 },
  { id: "4a9a76e5-c9c4-4d24-8d0c-93f3a277411f", name: "UAT", sortOrder: 15 },
  { id: "9c079220-b356-4387-b4c3-4e20f4ea519b", name: "UAT Defect Fixing", sortOrder: 16 },
  { id: "9a29f0ea-3ef7-4db0-ab68-f9aedc770d04", name: "UAT Sign-off", sortOrder: 17 },
  { id: "0c41a549-44c0-4e4a-8ed2-1955d5e71f4c", name: "Pre-Live Preparation", sortOrder: 18 },
  { id: "92b6abc2-b2b5-46af-b568-531adf9d3c2e", name: "Production Readiness", sortOrder: 19 },
  { id: "d2800b0a-dd23-4835-8022-ef81e766116e", name: "Production Deployment", sortOrder: 20 },
  { id: "bcd17346-ce9e-4c75-908a-8f489bd62053", name: "Prod", sortOrder: 21 },
];

async function main() {
  for (const stage of stages) {
    await prisma.deliveryStageMaster.upsert({
      where: { name: stage.name },
      update: { sortOrder: stage.sortOrder },
      create: stage,
    });
  }

  console.log(`Seeded ${stages.length} delivery stages.`);
}

main()
  .catch((error) => {
    console.error('Delivery stage seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
