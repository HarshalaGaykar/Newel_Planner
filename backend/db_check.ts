
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const crs = await prisma.changeRequest.findMany({
    where: { crCode: { in: ['CR-0008', 'CR-0009'] } },
    include: { 
      project: { select: { name: true } },
      requester: { include: { role: true } }
    }
  });

  const workflows = await prisma.workflowInstance.findMany({
    where: { entityType: 'CR', entityId: { in: crs.map(c => c.id) } },
    include: { requester: { select: { email: true } } }
  });

  console.log('Target Change Requests:', JSON.stringify(crs.map(c => ({
    id: c.id,
    code: c.crCode,
    status: c.status,
    title: c.title,
    requester: c.requester.email,
    requesterRole: c.requester.role?.name,
    createdAt: c.createdAt
  })), null, 2));

  console.log('Workflows for these CRs:', JSON.stringify(workflows.map(w => ({
    id: w.id,
    crId: w.entityId,
    status: w.status,
    requester: w.requester.email,
    createdAt: w.createdAt
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
