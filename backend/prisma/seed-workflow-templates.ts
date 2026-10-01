import { ApproverType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    where: { name: { in: ['ADMIN', 'PM', 'HR'] } },
  });
  const roleMap = Object.fromEntries(roles.map((role) => [role.name, role.id]));
  const missingRoles = ['ADMIN', 'PM', 'HR'].filter((roleName) => !roleMap[roleName]);

  if (missingRoles.length > 0) {
    throw new Error(`Missing roles for workflow templates: ${missingRoles.join(', ')}`);
  }

  const workflowTemplates = [
    {
      module: 'LEAVE',
      name: 'Leave Approval Workflow',
      steps: [
        { stepOrder: 1, stepName: 'Reporting Authority Approval', approverType: ApproverType.REPORTING_AUTHORITY, escalateAfterHours: 48 },
        { stepOrder: 2, stepName: 'HR Approval', approverType: ApproverType.ROLE, approverRoleId: roleMap.HR, escalateAfterHours: 48 },
      ],
    },
    {
      module: 'TIMESHEET',
      name: 'Timesheet Approval Workflow',
      steps: [
        { stepOrder: 1, stepName: 'Reporting Authority Approval', approverType: ApproverType.REPORTING_AUTHORITY, escalateAfterHours: 24 },
      ],
    },
    {
      module: 'DEMAND',
      name: 'Resource Demand Approval',
      steps: [
        { stepOrder: 1, stepName: 'PMO Review', approverType: ApproverType.ROLE, approverRoleId: roleMap.ADMIN },
        { stepOrder: 2, stepName: 'Admin Approval', approverType: ApproverType.ROLE, approverRoleId: roleMap.ADMIN },
      ],
    },
    {
      module: 'PROJECT_APPROVAL',
      name: 'Project Approval Workflow',
      steps: [
        { stepOrder: 1, stepName: 'PMO Review', approverType: ApproverType.ROLE, approverRoleId: roleMap.ADMIN },
        { stepOrder: 2, stepName: 'Admin Approval', approverType: ApproverType.ROLE, approverRoleId: roleMap.ADMIN },
      ],
    },
    {
      module: 'CR',
      name: 'Change Request Approval',
      steps: [
        { stepOrder: 1, stepName: 'PM Approval', approverType: ApproverType.ROLE, approverRoleId: roleMap.PM },
        { stepOrder: 2, stepName: 'PMO Approval', approverType: ApproverType.ROLE, approverRoleId: roleMap.ADMIN },
        { stepOrder: 3, stepName: 'Admin Final Approval', approverType: ApproverType.ROLE, approverRoleId: roleMap.ADMIN },
      ],
    },
  ];

  for (const template of workflowTemplates) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.workflowTemplate.findFirst({ where: { module: template.module } });
      const saved = existing
        ? await tx.workflowTemplate.update({
            where: { id: existing.id },
            data: { name: template.name, isActive: true },
          })
        : await tx.workflowTemplate.create({
            data: { module: template.module, name: template.name, isActive: true },
          });

      await tx.workflowStep.deleteMany({ where: { templateId: saved.id } });
      await tx.workflowStep.createMany({
        data: template.steps.map((step) => ({
          templateId: saved.id,
          stepOrder: step.stepOrder,
          stepName: step.stepName,
          approverType: step.approverType,
          approverRoleId: 'approverRoleId' in step ? step.approverRoleId : null,
          escalateAfterHours: 'escalateAfterHours' in step ? step.escalateAfterHours : null,
        })),
      });
    });
  }

  console.log('Seeded workflow templates.');
}

main()
  .catch((error) => {
    console.error('Workflow template seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
