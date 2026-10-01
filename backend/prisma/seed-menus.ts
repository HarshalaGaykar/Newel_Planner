import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type MenuDef = {
  name: string;
  path: string;
  order: number;
  icon: string | null;
  parentName: string | null;
  perm?: string;
};

const menuDefs: MenuDef[] = [
  { name: 'Dashboard', path: '/dashboard-menu', order: 1, icon: 'LayoutDashboard', parentName: null },
  { name: 'Overview', path: '/dashboard', order: 1, icon: null, parentName: 'Dashboard', perm: 'DASHBOARD_OVERVIEW_VIEW' },
  { name: 'AI Insights', path: '/dashboard/ai', order: 2, icon: null, parentName: 'Dashboard', perm: 'DASHBOARD_AI_VIEW' },
  { name: 'Demands', path: '/demands', order: 2, icon: 'Inbox', parentName: null, perm: 'DEMAND_VIEW' },
  { name: 'Projects', path: '/projects-menu', order: 3, icon: 'FolderKanban', parentName: null },
  { name: 'Project List', path: '/projects', order: 1, icon: null, parentName: 'Projects', perm: 'PROJECT_LIST_VIEW' },
  { name: 'Resource Allocation', path: '/projects/allocations', order: 2, icon: null, parentName: 'Projects', perm: 'PROJECT_ALLOCATION_VIEW' },
  { name: 'Future Planning', path: '/projects/future', order: 3, icon: null, parentName: 'Projects', perm: 'PROJECT_FUTURE_VIEW' },
  { name: 'Delivery Tracker', path: '/projects/tracker', order: 4, icon: null, parentName: 'Projects', perm: 'TRACKER_VIEW' },
  { name: 'Work Management', path: '/work', order: 4, icon: 'ClipboardList', parentName: null },
  { name: 'Tasks / Tickets', path: '/tasks', order: 1, icon: null, parentName: 'Work Management', perm: 'WORK_TASK_VIEW' },
  { name: 'Sprint Board (Dev)', path: '/sprints', order: 2, icon: null, parentName: 'Work Management', perm: 'WORK_SPRINT_VIEW' },
  { name: 'Ticket Queue (Maintenance)', path: '/tickets', order: 3, icon: null, parentName: 'Work Management', perm: 'WORK_TICKET_VIEW' },
  { name: 'QA Management', path: '/test-management', order: 4, icon: null, parentName: 'Work Management', perm: 'TEST_MANAGE' },
  { name: 'Workforce', path: '/workforce', order: 5, icon: 'Users', parentName: null },
  { name: 'Timesheet', path: '/timesheets', order: 1, icon: null, parentName: 'Workforce', perm: 'WORKFORCE_TIMESHEET_VIEW' },
  { name: 'Leave', path: '/leaves', order: 2, icon: null, parentName: 'Workforce', perm: 'WORKFORCE_LEAVE_VIEW' },
  { name: 'Comp-Off', path: '/compoffs', order: 3, icon: null, parentName: 'Workforce', perm: 'COMPOFF_READ' },
  { name: 'Attendance', path: '/attendance', order: 4, icon: null, parentName: 'Workforce', perm: 'ATTENDANCE_READ' },
  { name: 'Resource Availability', path: '/workforce/availability', order: 5, icon: null, parentName: 'Workforce', perm: 'WORKFORCE_AVAILABILITY_VIEW' },
  { name: 'Financial', path: '/financial', order: 6, icon: 'Wallet', parentName: null },
  { name: 'Client PO', path: '/financial/po', order: 1, icon: null, parentName: 'Financial', perm: 'FINANCIAL_PO_VIEW' },
  { name: 'Milestones', path: '/financial/milestones', order: 2, icon: null, parentName: 'Financial', perm: 'FINANCIAL_MILESTONE_VIEW' },
  { name: 'Invoice', path: '/financial/invoices', order: 3, icon: null, parentName: 'Financial', perm: 'FINANCIAL_INVOICE_VIEW' },
  { name: 'Payment', path: '/financial/payments', order: 4, icon: null, parentName: 'Financial', perm: 'FINANCIAL_PAYMENT_VIEW' },
  { name: 'Financial Dashboard', path: '/financial/dashboard', order: 5, icon: null, parentName: 'Financial', perm: 'FINANCIAL_DASHBOARD_VIEW' },
  { name: 'Reports', path: '/reports', order: 7, icon: 'ChartNoAxesCombined', parentName: null },
  { name: 'Timesheet Reports', path: '/reports/timesheet', order: 1, icon: null, parentName: 'Reports', perm: 'REPORT_TIMESHEET_VIEW' },
  { name: 'Project Reports', path: '/reports/projects', order: 2, icon: null, parentName: 'Reports', perm: 'REPORT_PROJECT_VIEW' },
  { name: 'Utilization Reports', path: '/reports/utilization', order: 3, icon: null, parentName: 'Reports', perm: 'REPORT_UTILIZATION_VIEW' },
  { name: 'Attendance Report', path: '/reports/attendance', order: 4, icon: null, parentName: 'Reports', perm: 'REPORT_ATTENDANCE_VIEW' },
  { name: 'Leave Report', path: '/reports/leave', order: 5, icon: null, parentName: 'Reports', perm: 'REPORT_LEAVE_VIEW' },
  // Reuses the same permission as the Workforce > Resource Availability screen —
  // this is the reporting view over the same underlying capability, not a
  // separate feature that needs its own permission.
  { name: 'Resource Availability Report', path: '/reports/resource-availability', order: 6, icon: null, parentName: 'Reports', perm: 'WORKFORCE_AVAILABILITY_VIEW' },
  { name: 'Employee Maturity Report', path: '/reports/employee-maturity', order: 7, icon: null, parentName: 'Reports', perm: 'MATURITY_VIEW' },
  // Gated on the view permission only — Excel export is an in-page action on
  // this same screen, not a separate nav entry, so REPORT_TIMESHEET_DETAILED_EXPORT
  // isn't referenced here.
  { name: 'Monthly Timesheet Report', path: '/reports/timesheet-entries', order: 8, icon: null, parentName: 'Reports', perm: 'REPORT_TIMESHEET_DETAILED_VIEW' },
  // Gated on the view permission only — Excel export is an in-page action on
  // this same screen, not a separate nav entry, same convention as the
  // Monthly Timesheet Report entry above.
  { name: 'Monthly Attendance Report', path: '/reports/monthly-attendance', order: 9, icon: null, parentName: 'Reports', perm: 'REPORT_MONTHLY_ATTENDANCE_VIEW' },
  // Exception report (no check-in / no leave / no timesheet). Gated on the view
  // permission only — Excel export is an in-page action on this same screen.
  { name: 'Compliance Report', path: '/reports/non-compliance', order: 10, icon: null, parentName: 'Reports', perm: 'REPORT_NON_COMPLIANCE_VIEW' },
  { name: 'Administration', path: '/admin', order: 8, icon: 'Settings', parentName: null },
  { name: 'User Management', path: '/users', order: 1, icon: null, parentName: 'Administration', perm: 'ADMIN_USER_VIEW' },
  { name: 'Roles & Permissions', path: '/admin/roles', order: 2, icon: null, parentName: 'Administration', perm: 'ADMIN_ROLE_VIEW' },
  { name: 'Menu Management', path: '/admin/menus', order: 3, icon: null, parentName: 'Administration', perm: 'ADMIN_MENU_VIEW' },
  { name: 'Holiday Master', path: '/admin/holidays', order: 4, icon: null, parentName: 'Administration', perm: 'ADMIN_HOLIDAY_VIEW' },
  { name: 'Skill Mapping', path: '/admin/skills', order: 5, icon: null, parentName: 'Administration', perm: 'ADMIN_SKILL_VIEW' },
  { name: 'RA Mapping', path: '/admin/ra', order: 6, icon: null, parentName: 'Administration', perm: 'ADMIN_RA_VIEW' },
  { name: 'System Configuration', path: '/admin/config', order: 7, icon: null, parentName: 'Administration', perm: 'ADMIN_CONFIG_VIEW' },
  { name: 'Leave Management', path: '/admin/leaves', order: 8, icon: null, parentName: 'Administration', perm: 'WORKFORCE_LEAVE_APPROVE' },
  { name: 'Client Master', path: '/admin/clients', order: 9, icon: null, parentName: 'Administration', perm: 'CLIENT_MANAGE' },
  { name: 'Asset Management', path: '/assets', order: 10, icon: null, parentName: 'Administration', perm: 'ASSET_VIEW' },
  { name: 'Task Type Master', path: '/task-type-master', order: 11, icon: null, parentName: 'Administration', perm: 'TASK_TYPE_MASTER_VIEW' },
  // Reading the stage list is gated on TRACKER_VIEW — the same permission that
  // opens the Delivery Tracker, which is the only consumer of these stages.
  { name: 'Stage Master', path: '/admin/stage-master', order: 12, icon: null, parentName: 'Administration', perm: 'TRACKER_VIEW' },
  { name: 'Learning & Development', path: '/learning', order: 9, icon: 'GraduationCap', parentName: null },
  { name: 'Training Programs', path: '/training', order: 1, icon: null, parentName: 'Learning & Development', perm: 'TRAINING_READ' },
  { name: 'My Assessments', path: '/tests', order: 2, icon: null, parentName: 'Learning & Development', perm: 'TEST_READ' },
  { name: 'Question Banks', path: '/admin/tests/question-banks', order: 3, icon: null, parentName: 'Learning & Development', perm: 'TEST_MANAGE' },
  { name: 'Test Management', path: '/admin/tests', order: 4, icon: null, parentName: 'Learning & Development', perm: 'TEST_MANAGE' },
  { name: 'Todo List', path: '/todo', order: 10, icon: 'ListChecks', parentName: null, perm: 'ACTIVITY_VIEW' },
];

async function main() {
  const permissionNames = Array.from(new Set(menuDefs.map((menu) => menu.perm).filter(Boolean))) as string[];
  const permissions = await prisma.permission.findMany({ where: { name: { in: permissionNames as string[] } } });
  const permissionMap = Object.fromEntries(permissions.map((permission) => [permission.name, permission.id]));
  const missingPermissions = permissionNames.filter((name) => !permissionMap[name as string]);

  if (missingPermissions.length > 0) {
    throw new Error(`Missing permissions for menus: ${missingPermissions.join(', ')}. Run the permissions seed first.`);
  }

  const menuMap: Record<string, string> = {};

  for (const menu of menuDefs.filter((item) => !item.parentName)) {
    const saved = await prisma.menu.upsert({
      where: { path: menu.path },
      update: { name: menu.name, order: menu.order, icon: menu.icon, parentId: null, isActive: true },
      create: { name: menu.name, path: menu.path, order: menu.order, icon: menu.icon, isActive: true },
    });
    menuMap[menu.name] = saved.id;
  }

  for (const menu of menuDefs.filter((item) => item.parentName)) {
    const parentId = menuMap[menu.parentName!];
    if (!parentId) throw new Error(`Parent menu missing: ${menu.parentName}`);

    const saved = await prisma.menu.upsert({
      where: { path: menu.path },
      update: { name: menu.name, order: menu.order, icon: menu.icon, parentId, isActive: true },
      create: { name: menu.name, path: menu.path, order: menu.order, icon: menu.icon, parentId, isActive: true },
    });
    menuMap[menu.name] = saved.id;
  }

  const seededMenuIds = Object.values(menuMap);
  await prisma.menuPermission.deleteMany({ where: { menuId: { in: seededMenuIds } } });

  const menuPermissionDefs: { menuName: string; permissionName: string }[] = [];
  for (const menu of menuDefs) {
    if (!menu.perm) continue;
    menuPermissionDefs.push({ menuName: menu.name, permissionName: menu.perm });
    if (menu.parentName) {
      menuPermissionDefs.push({ menuName: menu.parentName, permissionName: menu.perm });
    }
  }

  await prisma.menuPermission.createMany({
    data: menuPermissionDefs.map(({ menuName, permissionName }) => ({
      menuId: menuMap[menuName],
      permissionId: permissionMap[permissionName],
    })),
    skipDuplicates: true,
  });

  console.log('Seeded menus and menu permissions.');
}

main()
  .catch((error) => {
    console.error('Menu seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
