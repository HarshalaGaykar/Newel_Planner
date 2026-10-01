import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const roleNames = ['ADMIN', 'PM', 'TL', 'USER', 'HR', 'FREELANCER'] as const;

export const permissionsData = [
  { name: 'DASHBOARD_OVERVIEW_VIEW', description: 'View Dashboard Overview' },
  { name: 'DASHBOARD_AI_VIEW', description: 'View AI Insights' },
  { name: 'PROJECT_LIST_VIEW', description: 'View Project List' },
  { name: 'PROJECT_CREATE', description: 'Create Project' },
  { name: 'PROJECT_ALLOCATION_VIEW', description: 'View Resource Allocation' },
  { name: 'PROJECT_FUTURE_VIEW', description: 'View Future Planning' },
  { name: 'WORK_TASK_VIEW', description: 'View Tasks/Tickets' },
  { name: 'WORK_TASK_UPDATE', description: 'Update Tasks/Tickets' },
  { name: 'WORK_TASK_IMPORT', description: 'Import WBS / bulk-create tasks' },
  { name: 'WORK_SPRINT_VIEW', description: 'View Sprint Board' },
  { name: 'WORK_TICKET_VIEW', description: 'View Ticket Queue' },
  { name: 'WORKFORCE_TIMESHEET_VIEW', description: 'View Timesheet' },
  { name: 'WORKFORCE_TIMESHEET_CREATE', description: 'Create Timesheet' },
  { name: 'WORKFORCE_TIMESHEET_BULK_UPLOAD', description: 'Bulk-fill Timesheet from Excel template' },
  { name: 'WORKFORCE_TIMESHEET_APPROVE', description: 'Approve Timesheet' },
  { name: 'WORKFORCE_TEAM_TIMESHEET_VIEW', description: 'View Team Timesheets' },
  { name: 'WORKFORCE_TIMESHEET_MISSING_VIEW', description: 'View Missing Timesheet Entries' },
  { name: 'WORKFORCE_LEAVE_VIEW', description: 'View Leave' },
  { name: 'WORKFORCE_LEAVE_APPLY', description: 'Apply Leave' },
  { name: 'WORKFORCE_LEAVE_APPROVE', description: 'Approve Leave' },
  { name: 'COMPOFF_READ', description: 'View Comp-Off' },
  { name: 'COMPOFF_REQUEST', description: 'Request Comp-Off' },
  { name: 'COMPOFF_APPROVE', description: 'Approve Comp-Off' },
  { name: 'COMPOFF_MANAGE', description: 'Manage Comp-Off' },
  { name: 'WORKFORCE_AVAILABILITY_VIEW', description: 'View Resource Availability' },
  { name: 'FINANCIAL_PO_VIEW', description: 'View Client PO' },
  { name: 'FINANCIAL_PO_CREATE', description: 'Create Client PO' },
  { name: 'FINANCIAL_MILESTONE_VIEW', description: 'View Milestones' },
  { name: 'FINANCIAL_MILESTONE_CREATE', description: 'Create Milestones' },
  { name: 'FINANCIAL_INVOICE_VIEW', description: 'View Invoice' },
  { name: 'FINANCIAL_INVOICE_CREATE', description: 'Create Invoice' },
  { name: 'FINANCIAL_PAYMENT_VIEW', description: 'View Payment Tracking' },
  { name: 'FINANCIAL_DASHBOARD_VIEW', description: 'View Financial Dashboard' },
  { name: 'REPORT_TIMESHEET_VIEW', description: 'View Timesheet Reports' },
  { name: 'REPORT_PROJECT_VIEW', description: 'View Project Reports' },
  { name: 'REPORT_UTILIZATION_VIEW', description: 'View Utilization Reports' },
  { name: 'REPORT_ALL_VIEW', description: 'View All Reports' },
  { name: 'REPORT_LEAVE_VIEW', description: 'View Leave Reports' },
  { name: 'REPORT_ATTENDANCE_VIEW', description: 'View Attendance Reports' },
  { name: 'REPORT_TIMESHEET_DETAILED_VIEW', description: 'View the detailed timesheet-entries report' },
  { name: 'REPORT_TIMESHEET_DETAILED_EXPORT', description: 'Export the detailed timesheet-entries report to Excel' },
  { name: 'REPORT_MONTHLY_EFFORTS_VIEW', description: 'View and export the monthly efforts logged report' },
  { name: 'REPORT_MONTHLY_ATTENDANCE_VIEW', description: 'View and export the monthly attendance register' },
  { name: 'REPORT_NON_COMPLIANCE_VIEW', description: 'View and export the attendance compliance report (no check-in, no leave, no timesheet)' },
  { name: 'ADMIN_USER_VIEW', description: 'Manage Users' },
  { name: 'ADMIN_ROLE_VIEW', description: 'Manage Roles' },
  { name: 'ADMIN_MENU_VIEW', description: 'Manage Menu' },
  { name: 'MENU_READ', description: 'View Menu Configuration' },
  { name: 'MENU_CREATE', description: 'Create Menu Items' },
  { name: 'MENU_UPDATE', description: 'Update Menu Items' },
  { name: 'MENU_DELETE', description: 'Delete Menu Items' },
  { name: 'ADMIN_HOLIDAY_VIEW', description: 'Manage Holiday Master' },
  { name: 'ADMIN_SKILL_VIEW', description: 'Manage Skill Mapping' },
  { name: 'ADMIN_RA_VIEW', description: 'Manage RA Mapping' },
  { name: 'USER_READ', description: 'View Users' },
  { name: 'USER_CREATE', description: 'Create Users' },
  { name: 'USER_UPDATE', description: 'Update Users' },
  { name: 'USER_DELETE', description: 'Delete Users' },
  { name: 'USER_MANAGE', description: 'Manage Users and Roles' },
  { name: 'ATTENDANCE_READ', description: 'View Attendance' },
  { name: 'ATTENDANCE_MARK', description: 'Mark Attendance' },
  { name: 'ATTENDANCE_MANAGE', description: 'Manage Team Attendance' },
  { name: 'ADMIN_CONFIG_VIEW', description: 'View Admin Configuration' },
  { name: 'ADMIN_CONFIG_EDIT', description: 'Edit Admin Configuration' },
  { name: 'DEMAND_VIEW', description: 'View Demands' },
  { name: 'DEMAND_CREATE', description: 'Create Demand' },
  { name: 'DEMAND_APPROVE', description: 'Approve Demand' },
  { name: 'DEMAND_CONVERT', description: 'Convert Demand to Project' },
  { name: 'ATTENDANCE_REGULARIZE', description: 'Request Attendance Regularization' },
  { name: 'ATTENDANCE_REGULARIZE_APPROVE', description: 'Approve Regularization Requests' },
  { name: 'TRAINING_READ', description: 'View Training Programs' },
  { name: 'TRAINING_ENROLL', description: 'Enroll in Training' },
  { name: 'TRAINING_MANAGE', description: 'Manage Training Programs' },
  { name: 'TEST_READ', description: 'Take Tests' },
  { name: 'TEST_MANAGE', description: 'Manage Tests' },
  { name: 'TRACKER_VIEW', description: 'View Delivery Tracker' },
  { name: 'TRACKER_EXPORT', description: 'Export Delivery Tracker' },
  { name: 'ASSET_VIEW', description: 'View Assets' },
  { name: 'ASSET_MANAGE', description: 'Manage Assets' },
  { name: 'CLIENT_VIEW', description: 'View Client Master' },
  { name: 'CLIENT_MANAGE', description: 'Manage Client Master' },
  { name: 'TASK_TYPE_MASTER_VIEW', description: 'View Task Type Master' },
  { name: 'TASK_TYPE_MASTER_MANAGE', description: 'Manage Task Type Master' },
  { name: 'MATURITY_VIEW', description: 'View Employee Maturity' },
  { name: 'MATURITY_MANAGE', description: 'Manage Employee Maturity' },
  { name: 'ACTIVITY_VIEW', description: 'View Todo List activities' },
  { name: 'ACTIVITY_CREATE', description: 'Create Todo List activities' },
  { name: 'ACTIVITY_MANAGE', description: 'Postpone, complete or cancel own activities' },
] as const;

export const permissionNamesByRole: Record<string, string[]> = {
  PM: [
    'DASHBOARD_OVERVIEW_VIEW', 'DASHBOARD_AI_VIEW',
    'PROJECT_LIST_VIEW', 'PROJECT_CREATE', 'PROJECT_ALLOCATION_VIEW', 'PROJECT_FUTURE_VIEW',
    'WORK_TASK_VIEW', 'WORK_TASK_UPDATE', 'WORK_TASK_IMPORT', 'WORK_SPRINT_VIEW', 'WORK_TICKET_VIEW',
    'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_BULK_UPLOAD', 'WORKFORCE_TIMESHEET_APPROVE', 'WORKFORCE_TEAM_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_MISSING_VIEW', 'WORKFORCE_AVAILABILITY_VIEW',
    'WORKFORCE_LEAVE_VIEW',
    'FINANCIAL_PO_VIEW', 'FINANCIAL_PO_CREATE', 'FINANCIAL_MILESTONE_VIEW', 'FINANCIAL_MILESTONE_CREATE',
    'FINANCIAL_INVOICE_VIEW', 'FINANCIAL_INVOICE_CREATE', 'FINANCIAL_PAYMENT_VIEW', 'FINANCIAL_DASHBOARD_VIEW',
    'REPORT_TIMESHEET_VIEW', 'REPORT_PROJECT_VIEW', 'REPORT_UTILIZATION_VIEW', 'REPORT_ALL_VIEW',
    'REPORT_LEAVE_VIEW', 'REPORT_ATTENDANCE_VIEW',
    'REPORT_TIMESHEET_DETAILED_VIEW', 'REPORT_TIMESHEET_DETAILED_EXPORT', 'REPORT_MONTHLY_EFFORTS_VIEW', 'REPORT_MONTHLY_ATTENDANCE_VIEW',
    'REPORT_NON_COMPLIANCE_VIEW',
    'ATTENDANCE_READ', 'ATTENDANCE_MANAGE', 'ATTENDANCE_REGULARIZE_APPROVE',
    'COMPOFF_READ', 'COMPOFF_APPROVE', 'COMPOFF_MANAGE',
    'DEMAND_VIEW', 'DEMAND_CREATE', 'DEMAND_APPROVE', 'DEMAND_CONVERT',
    'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
    'TRACKER_VIEW', 'TRACKER_EXPORT',
    'ASSET_VIEW', 'CLIENT_VIEW',
    'TASK_TYPE_MASTER_VIEW',
    'MATURITY_VIEW',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_MANAGE',
  ],
  TL: [
    'DASHBOARD_OVERVIEW_VIEW', 'DASHBOARD_AI_VIEW',
    'WORK_TASK_VIEW', 'WORK_TASK_UPDATE', 'WORK_TASK_IMPORT', 'WORK_SPRINT_VIEW', 'WORK_TICKET_VIEW',
    'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_BULK_UPLOAD', 'WORKFORCE_TIMESHEET_APPROVE', 'WORKFORCE_TEAM_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_MISSING_VIEW', 'WORKFORCE_AVAILABILITY_VIEW',
    'WORKFORCE_LEAVE_VIEW',
    'PROJECT_FUTURE_VIEW',
    'REPORT_TIMESHEET_VIEW', 'REPORT_PROJECT_VIEW',
    'REPORT_LEAVE_VIEW', 'REPORT_ATTENDANCE_VIEW',
    'REPORT_TIMESHEET_DETAILED_VIEW', 'REPORT_TIMESHEET_DETAILED_EXPORT', 'REPORT_MONTHLY_EFFORTS_VIEW', 'REPORT_MONTHLY_ATTENDANCE_VIEW',
    'REPORT_NON_COMPLIANCE_VIEW',
    'ATTENDANCE_READ', 'ATTENDANCE_MANAGE', 'ATTENDANCE_REGULARIZE_APPROVE',
    'COMPOFF_READ', 'COMPOFF_APPROVE',
    'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
    'TRACKER_VIEW', 'TRACKER_EXPORT',
    'ASSET_VIEW',
    'TASK_TYPE_MASTER_VIEW',
    'MATURITY_VIEW',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_MANAGE',
  ],
  USER: [
    'DASHBOARD_OVERVIEW_VIEW',
    'WORK_TASK_VIEW', 'WORK_TASK_UPDATE',
    'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_BULK_UPLOAD', 'WORKFORCE_TIMESHEET_MISSING_VIEW', 'WORKFORCE_LEAVE_VIEW', 'WORKFORCE_LEAVE_APPLY',
    'COMPOFF_READ', 'COMPOFF_REQUEST',
    'PROJECT_FUTURE_VIEW', 'ATTENDANCE_READ', 'ATTENDANCE_MARK', 'ATTENDANCE_REGULARIZE',
    'DEMAND_VIEW', 'DEMAND_CREATE',
    'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
    'ASSET_VIEW',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_MANAGE',
  ],
  HR: [
    'DASHBOARD_OVERVIEW_VIEW',
    'ADMIN_USER_VIEW', 'ADMIN_HOLIDAY_VIEW',
    'USER_CREATE', 'USER_UPDATE',
    'WORKFORCE_LEAVE_VIEW', 'WORKFORCE_LEAVE_APPROVE', 'WORKFORCE_AVAILABILITY_VIEW', 'WORKFORCE_TIMESHEET_MISSING_VIEW',
    'COMPOFF_READ', 'COMPOFF_APPROVE', 'COMPOFF_MANAGE',
    'REPORT_UTILIZATION_VIEW', 'REPORT_LEAVE_VIEW', 'REPORT_ATTENDANCE_VIEW', 'REPORT_MONTHLY_ATTENDANCE_VIEW', 'REPORT_NON_COMPLIANCE_VIEW', 'ATTENDANCE_MANAGE',
    'TRAINING_READ', 'TRAINING_ENROLL', 'TRAINING_MANAGE', 'TEST_READ', 'TEST_MANAGE',
    'MATURITY_VIEW',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_MANAGE',
  ],
  FREELANCER: [
    'DASHBOARD_OVERVIEW_VIEW',
    'WORK_TASK_VIEW', 'WORK_TASK_UPDATE',
    'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_BULK_UPLOAD',
    'ATTENDANCE_READ', 'ATTENDANCE_MARK',
    'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_MANAGE',
  ],
};

const scopePermissions = [
  'USER_READ',
  'USER_MANAGE',
  'WORKFORCE_LEAVE_VIEW',
  'WORKFORCE_TIMESHEET_VIEW',
  'WORKFORCE_TIMESHEET_APPROVE',
  'WORKFORCE_TIMESHEET_MISSING_VIEW',
  'PROJECT_ALLOCATION_VIEW',
  'ATTENDANCE_READ',
  'TRACKER_VIEW',
] as const;

const scopeByRole: Record<string, 'ALL' | 'PROJECT' | 'TEAM' | 'OWN'> = {
  ADMIN: 'ALL',
  HR: 'ALL',
  PM: 'PROJECT',
  TL: 'TEAM',
  USER: 'OWN',
  FREELANCER: 'OWN',
};

async function main() {
  for (const permission of permissionsData) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  const allRoles = await prisma.role.findMany();
  const allPermissions = await prisma.permission.findMany();
  const roleMap = Object.fromEntries(allRoles.map((role) => [role.name, role.id]));
  const permissionMap = Object.fromEntries(allPermissions.map((permission) => [permission.name, permission.id]));
  const missingRoles = roleNames.filter((roleName) => !roleMap[roleName]);

  if (missingRoles.length > 0) {
    throw new Error(`Missing required roles: ${missingRoles.join(', ')}`);
  }

  const rolePermissions = [
    ...allPermissions.map((permission) => ({ roleId: roleMap.ADMIN, permissionId: permission.id })),
    ...Object.entries(permissionNamesByRole).flatMap(([roleName, permissionNames]) =>
      permissionNames
        .map((permissionName) => ({
          roleId: roleMap[roleName],
          permissionId: permissionMap[permissionName],
        }))
        .filter((mapping) => mapping.roleId && mapping.permissionId),
    ),
  ].filter((mapping) => mapping.roleId && mapping.permissionId);

  await prisma.rolePermission.createMany({
    data: rolePermissions,
    skipDuplicates: true,
  });

  for (const permissionName of scopePermissions) {
    const permissionId = permissionMap[permissionName];
    if (!permissionId) continue;

    for (const [roleName, dataScope] of Object.entries(scopeByRole)) {
      const roleId = roleMap[roleName];
      if (!roleId) continue;

      await prisma.rolePermission.updateMany({
        where: { roleId, permissionId },
        data: { dataScope },
      });
    }
  }

  console.log('Seeded permissions, role-permission mappings, and data scopes.');
}

main()
  .catch((error) => {
    console.error('Role permission seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
