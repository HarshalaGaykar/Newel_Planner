import { PrismaClient, TimesheetStatus, TimesheetTaskType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding started...');

  // ─── 1. ROLES ──────────────────────────────────────────────────────────────
  const roleNames = ['ADMIN', 'PM', 'TL', 'USER', 'HR', 'FREELANCER'];
  for (const name of roleNames) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  const allRoles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));
  console.log('  ✓ Roles');

  // ─── 2. PERMISSIONS ────────────────────────────────────────────────────────
  const permissionsData = [
    // Dashboard
    { name: 'DASHBOARD_OVERVIEW_VIEW',   description: 'View Dashboard Overview' },
    { name: 'DASHBOARD_AI_VIEW',         description: 'View AI Insights' },
    // Projects
    { name: 'PROJECT_LIST_VIEW',         description: 'View Project List' },
    { name: 'PROJECT_CREATE',            description: 'Create Project' },
    { name: 'PROJECT_ALLOCATION_VIEW',   description: 'View Resource Allocation' },
    { name: 'PROJECT_FUTURE_VIEW',       description: 'View Future Planning' },
    // Work Management
    { name: 'WORK_TASK_VIEW',            description: 'View Tasks/Tickets' },
    { name: 'WORK_TASK_UPDATE',          description: 'Update Tasks/Tickets' },
    { name: 'WORK_TASK_IMPORT',          description: 'Import WBS / bulk-create tasks' },
    { name: 'WORK_SPRINT_VIEW',          description: 'View Sprint Board' },
    { name: 'WORK_TICKET_VIEW',          description: 'View Ticket Queue' },
    // Workforce
    { name: 'WORKFORCE_TIMESHEET_VIEW',         description: 'View Timesheet' },
    { name: 'WORKFORCE_TIMESHEET_CREATE',       description: 'Create Timesheet' },
    { name: 'WORKFORCE_TIMESHEET_APPROVE',      description: 'Approve Timesheet' },
    { name: 'WORKFORCE_TEAM_TIMESHEET_VIEW',    description: 'View Team Timesheets' },
    { name: 'WORKFORCE_TIMESHEET_MISSING_VIEW', description: 'View Missing Timesheet Entries' },
    { name: 'WORKFORCE_LEAVE_VIEW',      description: 'View Leave' },
    { name: 'WORKFORCE_LEAVE_APPLY',     description: 'Apply Leave' },
    { name: 'WORKFORCE_LEAVE_APPROVE',   description: 'Approve Leave' },
    { name: 'COMPOFF_READ',              description: 'View Comp-Off' },
    { name: 'COMPOFF_REQUEST',           description: 'Request Comp-Off' },
    { name: 'COMPOFF_APPROVE',           description: 'Approve Comp-Off' },
    { name: 'COMPOFF_MANAGE',            description: 'Manage Comp-Off' },
    { name: 'WORKFORCE_AVAILABILITY_VIEW',description: 'View Resource Availability' },
    // Financial
    { name: 'FINANCIAL_PO_VIEW',         description: 'View Client PO' },
    { name: 'FINANCIAL_PO_CREATE',       description: 'Create Client PO' },
    { name: 'FINANCIAL_MILESTONE_VIEW',  description: 'View Milestones' },
    { name: 'FINANCIAL_MILESTONE_CREATE',description: 'Create Milestones' },
    { name: 'FINANCIAL_INVOICE_VIEW',    description: 'View Invoice' },
    { name: 'FINANCIAL_INVOICE_CREATE',  description: 'Create Invoice' },
    { name: 'FINANCIAL_PAYMENT_VIEW',    description: 'View Payment Tracking' },
    { name: 'FINANCIAL_DASHBOARD_VIEW',  description: 'View Financial Dashboard' },
    // Reports
    { name: 'REPORT_TIMESHEET_VIEW',     description: 'View Timesheet Reports' },
    { name: 'REPORT_PROJECT_VIEW',       description: 'View Project Reports' },
    { name: 'REPORT_UTILIZATION_VIEW',   description: 'View Utilization Reports' },
    { name: 'REPORT_ALL_VIEW',           description: 'View All Reports' },
    // Administration
    { name: 'ADMIN_USER_VIEW',           description: 'Manage Users' },
    { name: 'ADMIN_ROLE_VIEW',           description: 'Manage Roles' },
    { name: 'ADMIN_MENU_VIEW',           description: 'Manage Menu' },
    { name: 'MENU_READ',                 description: 'View Menu Configuration' },
    { name: 'MENU_CREATE',               description: 'Create Menu Items' },
    { name: 'MENU_UPDATE',               description: 'Update Menu Items' },
    { name: 'MENU_DELETE',               description: 'Delete Menu Items' },
    { name: 'ADMIN_HOLIDAY_VIEW',        description: 'Manage Holiday Master' },
    { name: 'ADMIN_SKILL_VIEW',          description: 'Manage Skill Mapping' },
    { name: 'ADMIN_RA_VIEW',             description: 'Manage RA Mapping' },
    { name: 'USER_READ',                 description: 'View Users' },
    { name: 'USER_CREATE',               description: 'Create Users' },
    { name: 'USER_UPDATE',               description: 'Update Users' },
    { name: 'USER_DELETE',               description: 'Delete Users' },
    { name: 'USER_MANAGE',               description: 'Manage Users and Roles' },
    { name: 'ATTENDANCE_READ',           description: 'View Attendance' },
    { name: 'ATTENDANCE_MARK',           description: 'Mark Attendance' },
    { name: 'ATTENDANCE_MANAGE',         description: 'Manage Team Attendance' },
    { name: 'ADMIN_CONFIG_VIEW',         description: 'View Admin Configuration' },
    { name: 'ADMIN_CONFIG_EDIT',         description: 'Edit Admin Configuration' },
    // Demands
    { name: 'DEMAND_VIEW',               description: 'View Demands' },
    { name: 'DEMAND_CREATE',             description: 'Create Demand' },
    { name: 'DEMAND_APPROVE',            description: 'Approve Demand' },
    { name: 'DEMAND_CONVERT',            description: 'Convert Demand to Project' },
    // Attendance Regularization
    { name: 'ATTENDANCE_REGULARIZE',     description: 'Request Attendance Regularization' },
    { name: 'ATTENDANCE_REGULARIZE_APPROVE', description: 'Approve Regularization Requests' },
    // Comp-Off
    { name: 'COMPOFF_READ',              description: 'View Comp-Off' },
    { name: 'COMPOFF_REQUEST',           description: 'Request Comp-Off' },
    { name: 'COMPOFF_APPROVE',           description: 'Approve Comp-Off' },
    { name: 'COMPOFF_MANAGE',            description: 'Manage Comp-Off' },
    // Training & Tests
    { name: 'TRAINING_READ',             description: 'View Training Programs' },
    { name: 'TRAINING_ENROLL',           description: 'Enroll in Training' },
    { name: 'TRAINING_MANAGE',           description: 'Manage Training Programs' },
    { name: 'TEST_READ',                 description: 'Take Tests' },
    { name: 'TEST_MANAGE',               description: 'Manage Tests' },
    // Tracker
    { name: 'TRACKER_VIEW',              description: 'View Delivery Tracker' },
    { name: 'TRACKER_EXPORT',            description: 'Export Delivery Tracker' },
    // Asset Management
    { name: 'ASSET_VIEW',                description: 'View Assets' },
    { name: 'ASSET_MANAGE',              description: 'Manage Assets' },
    // Client Master
    { name: 'CLIENT_VIEW',               description: 'View Client Master' },
    { name: 'CLIENT_MANAGE',             description: 'Manage Client Master' },
  ];
  for (const p of permissionsData) {
    await prisma.permission.upsert({ where: { name: p.name }, update: { description: p.description }, create: p });
  }
  const allPermissions = await prisma.permission.findMany();
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.name, p.id]));
  console.log('  ✓ Permissions');

  // ─── 3. ROLE → PERMISSION MAPPING ─────────────────────────────────────────
  await prisma.rolePermission.deleteMany();
  const rolePermissions = [
    // ADMIN (Full Control)
    ...allPermissions.map((p) => ({ roleId: roleMap.ADMIN, permissionId: p.id })),
    // PM
    ...[
      'DASHBOARD_OVERVIEW_VIEW', 'DASHBOARD_AI_VIEW',
      'PROJECT_LIST_VIEW', 'PROJECT_CREATE', 'PROJECT_ALLOCATION_VIEW', 'PROJECT_FUTURE_VIEW',
      'WORK_TASK_VIEW', 'WORK_TASK_UPDATE', 'WORK_TASK_IMPORT', 'WORK_SPRINT_VIEW', 'WORK_TICKET_VIEW',
      'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_APPROVE', 'WORKFORCE_TEAM_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_MISSING_VIEW', 'WORKFORCE_AVAILABILITY_VIEW',
      'WORKFORCE_LEAVE_VIEW',
      'FINANCIAL_PO_VIEW', 'FINANCIAL_PO_CREATE', 'FINANCIAL_MILESTONE_VIEW', 'FINANCIAL_MILESTONE_CREATE',
      'FINANCIAL_INVOICE_VIEW', 'FINANCIAL_INVOICE_CREATE', 'FINANCIAL_PAYMENT_VIEW', 'FINANCIAL_DASHBOARD_VIEW',
      'REPORT_TIMESHEET_VIEW', 'REPORT_PROJECT_VIEW', 'REPORT_UTILIZATION_VIEW', 'REPORT_ALL_VIEW',
      'ATTENDANCE_READ', 'ATTENDANCE_MANAGE', 'ATTENDANCE_REGULARIZE_APPROVE',
      'COMPOFF_READ', 'COMPOFF_APPROVE', 'COMPOFF_MANAGE',
      'DEMAND_VIEW', 'DEMAND_CREATE', 'DEMAND_APPROVE', 'DEMAND_CONVERT',
      'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
      'TRACKER_VIEW', 'TRACKER_EXPORT',
      'ASSET_VIEW', 'CLIENT_VIEW',
    ].map((n) => ({ roleId: roleMap.PM, permissionId: permMap[n] })),
    // TL
    ...[
      'DASHBOARD_OVERVIEW_VIEW', 'DASHBOARD_AI_VIEW',
      'WORK_TASK_VIEW', 'WORK_TASK_UPDATE', 'WORK_TASK_IMPORT', 'WORK_SPRINT_VIEW', 'WORK_TICKET_VIEW',
      'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_APPROVE', 'WORKFORCE_TEAM_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_MISSING_VIEW', 'WORKFORCE_AVAILABILITY_VIEW',
      'WORKFORCE_LEAVE_VIEW',
      'PROJECT_FUTURE_VIEW',
      'REPORT_TIMESHEET_VIEW', 'REPORT_PROJECT_VIEW',
      'ATTENDANCE_READ', 'ATTENDANCE_MANAGE', 'ATTENDANCE_REGULARIZE_APPROVE',
      'COMPOFF_READ', 'COMPOFF_APPROVE',
      'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
      'TRACKER_VIEW', 'TRACKER_EXPORT',
      'ASSET_VIEW',
    ].map((n) => ({ roleId: roleMap.TL, permissionId: permMap[n] })),
    // USER
    ...[
      'DASHBOARD_OVERVIEW_VIEW',
      'WORK_TASK_VIEW', 'WORK_TASK_UPDATE',
      'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE', 'WORKFORCE_TIMESHEET_MISSING_VIEW', 'WORKFORCE_LEAVE_VIEW', 'WORKFORCE_LEAVE_APPLY',
      'COMPOFF_READ', 'COMPOFF_REQUEST',
      'PROJECT_FUTURE_VIEW', 'ATTENDANCE_READ', 'ATTENDANCE_MARK', 'ATTENDANCE_REGULARIZE',
      'DEMAND_VIEW', 'DEMAND_CREATE',
      'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ',
      'ASSET_VIEW',
    ].map((n) => ({ roleId: roleMap.USER, permissionId: permMap[n] })),
    // HR
    ...[
      'DASHBOARD_OVERVIEW_VIEW',
      'ADMIN_USER_VIEW', 'ADMIN_HOLIDAY_VIEW',
      'USER_CREATE', 'USER_UPDATE',
      'WORKFORCE_LEAVE_VIEW', 'WORKFORCE_LEAVE_APPROVE', 'WORKFORCE_AVAILABILITY_VIEW', 'WORKFORCE_TIMESHEET_MISSING_VIEW',
      'COMPOFF_READ', 'COMPOFF_APPROVE', 'COMPOFF_MANAGE',
      'REPORT_UTILIZATION_VIEW', 'ATTENDANCE_MANAGE',
      'TRAINING_READ', 'TRAINING_ENROLL', 'TRAINING_MANAGE', 'TEST_READ', 'TEST_MANAGE'
    ].map((n) => ({ roleId: roleMap.HR, permissionId: permMap[n] })),
    // FREELANCER
    ...[
      'DASHBOARD_OVERVIEW_VIEW',
      'WORK_TASK_VIEW', 'WORK_TASK_UPDATE',
      'WORKFORCE_TIMESHEET_VIEW', 'WORKFORCE_TIMESHEET_CREATE',
      'ATTENDANCE_READ', 'ATTENDANCE_MARK',
      'TRAINING_READ', 'TRAINING_ENROLL', 'TEST_READ'
    ].map((n) => ({ roleId: roleMap.FREELANCER, permissionId: permMap[n] })),
  ].filter(rp => rp.permissionId);
  await prisma.rolePermission.createMany({ data: rolePermissions, skipDuplicates: true });
  console.log('  ✓ Role-Permission mappings');

  // ─── 3b. DATA SCOPE ASSIGNMENTS ───────────────────────────────────────────
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
  ];
  const scopeByRole: Record<string, string> = {
    ADMIN:      'ALL',
    HR:         'ALL',
    PM:         'PROJECT',
    TL:         'TEAM',
    USER:       'OWN',
    FREELANCER: 'OWN',
  };
  for (const permName of scopePermissions) {
    if (!permMap[permName]) continue;
    for (const [roleName, dataScope] of Object.entries(scopeByRole)) {
      if (!roleMap[roleName]) continue;
      await prisma.rolePermission.updateMany({
        where: { roleId: roleMap[roleName], permissionId: permMap[permName] },
        data: { dataScope: dataScope as any },
      });
    }
  }
  console.log('  ✓ Data scope assignments');

  // ─── 4. MENUS ──────────────────────────────────────────────────────────────
  await prisma.menuPermission.deleteMany();
  await prisma.menu.deleteMany();

  const menuDefs = [
    // Level 1: Dashboard
    { name: 'Dashboard', path: '/dashboard-menu', order: 1, icon: '🏠', parentName: null },
    { name: 'Overview', path: '/dashboard', order: 1, icon: null, parentName: 'Dashboard', perm: 'DASHBOARD_OVERVIEW_VIEW' },
    { name: 'AI Insights', path: '/dashboard/ai', order: 2, icon: null, parentName: 'Dashboard', perm: 'DASHBOARD_AI_VIEW' },

    // Level 1: Demands
    { name: 'Demands', path: '/demands', order: 1.5, icon: '📥', parentName: null, perm: 'DEMAND_VIEW' },

    // Level 1: Projects
    { name: 'Projects', path: '/projects-menu', order: 2, icon: '📁', parentName: null },
    { name: 'Project List', path: '/projects', order: 1, icon: null, parentName: 'Projects', perm: 'PROJECT_LIST_VIEW' },
    { name: 'Resource Allocation', path: '/projects/allocations', order: 2, icon: null, parentName: 'Projects', perm: 'PROJECT_ALLOCATION_VIEW' },
    { name: 'Future Planning', path: '/projects/future', order: 3, icon: null, parentName: 'Projects', perm: 'PROJECT_FUTURE_VIEW' },
    { name: 'Delivery Tracker', path: '/projects/tracker', order: 4, icon: null, parentName: 'Projects', perm: 'TRACKER_VIEW' },

    // Level 1: Work Management
    { name: 'Work Management', path: '/work', order: 3, icon: '📋', parentName: null },
    { name: 'Tasks / Tickets', path: '/tasks', order: 1, icon: null, parentName: 'Work Management', perm: 'WORK_TASK_VIEW' },
    { name: 'Sprint Board (Dev)', path: '/sprints', order: 2, icon: null, parentName: 'Work Management', perm: 'WORK_SPRINT_VIEW' },
    { name: 'Ticket Queue (Maintenance)', path: '/tickets', order: 3, icon: null, parentName: 'Work Management', perm: 'WORK_TICKET_VIEW' },

    // Level 1: Workforce
    { name: 'Workforce', path: '/workforce', order: 4, icon: '👥', parentName: null },
    { name: 'Timesheet', path: '/timesheets', order: 1, icon: null, parentName: 'Workforce', perm: 'WORKFORCE_TIMESHEET_VIEW' },
    { name: 'Leave', path: '/leaves', order: 2, icon: null, parentName: 'Workforce', perm: 'WORKFORCE_LEAVE_VIEW' },
    { name: 'Comp-Off', path: '/compoffs', order: 3, icon: null, parentName: 'Workforce', perm: 'COMPOFF_READ' },
    { name: 'Attendance', path: '/attendance', order: 4, icon: null, parentName: 'Workforce', perm: 'ATTENDANCE_READ' },
    { name: 'Resource Availability', path: '/workforce/availability', order: 5, icon: null, parentName: 'Workforce', perm: 'WORKFORCE_AVAILABILITY_VIEW' },

    // Level 1: Financial
    { name: 'Financial', path: '/financial', order: 5, icon: '💰', parentName: null },
    { name: 'Client PO', path: '/financial/po', order: 1, icon: null, parentName: 'Financial', perm: 'FINANCIAL_PO_VIEW' },
    { name: 'Milestones', path: '/financial/milestones', order: 2, icon: null, parentName: 'Financial', perm: 'FINANCIAL_MILESTONE_VIEW' },
    { name: 'Invoice', path: '/financial/invoices', order: 3, icon: null, parentName: 'Financial', perm: 'FINANCIAL_INVOICE_VIEW' },
    { name: 'Payment', path: '/financial/payments', order: 4, icon: null, parentName: 'Financial', perm: 'FINANCIAL_PAYMENT_VIEW' },
    { name: 'Financial Dashboard', path: '/financial/dashboard', order: 5, icon: null, parentName: 'Financial', perm: 'FINANCIAL_DASHBOARD_VIEW' },

    // Level 1: Reports
    { name: 'Reports', path: '/reports', order: 6, icon: '📈', parentName: null },
    { name: 'Timesheet Reports', path: '/reports/timesheet', order: 1, icon: null, parentName: 'Reports', perm: 'REPORT_TIMESHEET_VIEW' },
    { name: 'Project Reports', path: '/reports/projects', order: 2, icon: null, parentName: 'Reports', perm: 'REPORT_PROJECT_VIEW' },
    { name: 'Utilization Reports', path: '/reports/utilization', order: 3, icon: null, parentName: 'Reports', perm: 'REPORT_UTILIZATION_VIEW' },

    // Level 1: Administration
    { name: 'Administration', path: '/admin', order: 7, icon: '⚙️', parentName: null },
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

    // Level 1: Learning & Development
    { name: 'QA Management', path: '/test-management', order: 4, icon: null, parentName: 'Work Management', perm: 'TEST_MANAGE' },
    { name: 'Learning & Development', path: '/learning', order: 8, icon: '📚', parentName: null },
    { name: 'Training Programs', path: '/training', order: 1, icon: null, parentName: 'Learning & Development', perm: 'TRAINING_READ' },
    { name: 'My Assessments', path: '/tests', order: 2, icon: null, parentName: 'Learning & Development', perm: 'TEST_READ' },
    { name: 'Question Banks', path: '/admin/tests/question-banks', order: 3, icon: null, parentName: 'Learning & Development', perm: 'TEST_MANAGE' },
    { name: 'Test Management', path: '/admin/tests', order: 4, icon: null, parentName: 'Learning & Development', perm: 'TEST_MANAGE' },
  ];

  const menuMap: Record<string, string> = {};

  for (const m of menuDefs.filter(m => !m.parentName)) {
    const created = await prisma.menu.create({
      data: { name: m.name, path: m.path, order: m.order, icon: m.icon },
    });
    menuMap[m.name] = created.id;
  }

  for (const m of menuDefs.filter(m => m.parentName)) {
    const created = await prisma.menu.create({
      data: { name: m.name, path: m.path, order: m.order, icon: m.icon, parentId: menuMap[m.parentName!] },
    });
    menuMap[m.name] = created.id;
  }

  const menuPermDefs: { menu: string; perm: string }[] = [];

  for (const m of menuDefs) {
    if (m.perm) {
      menuPermDefs.push({ menu: m.name, perm: m.perm });
      if (m.parentName) {
        menuPermDefs.push({ menu: m.parentName, perm: m.perm });
      }
    }
  }

  await prisma.menuPermission.createMany({
    data: menuPermDefs.filter(m => permMap[m.perm]).map(({ menu, perm }) => ({ menuId: menuMap[menu], permissionId: permMap[perm] })),
    skipDuplicates: true,
  });
  console.log('  ✓ Menus');

  // ─── 5. DEPARTMENTS ────────────────────────────────────────────────────────
  const deptDefs = [
    { name: 'Engineering',     description: 'Software engineering team' },
    { name: 'QA',              description: 'Quality assurance team' },
    { name: 'DevOps',          description: 'Infrastructure and deployment' },
    { name: 'Product',         description: 'Product management and design' },
    { name: 'Finance',         description: 'Finance and billing operations' },
    { name: 'Human Resources', description: 'HR and people operations' },
  ];
  for (const d of deptDefs) {
    await prisma.department.upsert({ where: { name: d.name }, update: {}, create: d });
  }
  const allDepts = await prisma.department.findMany();
  const deptMap = Object.fromEntries(allDepts.map((d) => [d.name, d.id]));
  console.log('  ✓ Departments');

  // ─── 6. SKILLS ─────────────────────────────────────────────────────────────
  const skillDefs = [
    'React', 'Next.js', 'TypeScript', 'Node.js', 'NestJS', 'PostgreSQL',
    'Prisma', 'AWS', 'Docker', 'Kubernetes', 'Python', 'Java',
    'Selenium', 'Cypress', 'Figma', 'GraphQL', 'Redis', 'MongoDB',
  ];
  for (const name of skillDefs) {
    await prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
  }
  const allSkills = await prisma.skill.findMany();
  const skillMap = Object.fromEntries(allSkills.map((s) => [s.name, s.id]));
  console.log('  ✓ Skills');

  // ─── 7. USERS ──────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('Password@123', 10);

  const userDefs = [
    { email: 'admin@enterprise.com',  firstName: 'Arjun',    lastName: 'Sharma',   role: 'ADMIN',      dept: 'Engineering',     cost: 0 },
    { email: 'pm@enterprise.com',     firstName: 'Priya',    lastName: 'Kapoor',   role: 'PM',         dept: 'Product',         cost: 1200 },
    { email: 'tl@enterprise.com',     firstName: 'Rahul',    lastName: 'Verma',    role: 'TL',         dept: 'Engineering',     cost: 1000 },
    { email: 'hr@enterprise.com',     firstName: 'Neha',     lastName: 'Gupta',    role: 'HR',         dept: 'Human Resources', cost: 800 },
    { email: 'dev1@enterprise.com',   firstName: 'Siddharth',lastName: 'Rao',      role: 'USER',       dept: 'Engineering',     cost: 700 },
    { email: 'dev2@enterprise.com',   firstName: 'Ananya',   lastName: 'Mehta',    role: 'USER',       dept: 'Engineering',     cost: 700 },
    { email: 'dev3@enterprise.com',   firstName: 'Vikram',   lastName: 'Kumar',    role: 'USER',       dept: 'Engineering',     cost: 650 },
    { email: 'qa1@enterprise.com',    firstName: 'Pooja',    lastName: 'Singh',    role: 'USER',       dept: 'QA',              cost: 600 },
    { email: 'devops@enterprise.com', firstName: 'Karan',    lastName: 'Joshi',    role: 'USER',       dept: 'DevOps',          cost: 750 },
    { email: 'free1@enterprise.com',  firstName: 'Meera',    lastName: 'Patel',    role: 'FREELANCER', dept: 'Engineering',     cost: 500 },
  ];

  for (const u of userDefs) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { roleId: roleMap[u.role] },
      create: {
        email: u.email, password: pw,
        firstName: u.firstName, lastName: u.lastName,
        roleId: roleMap[u.role],
        departmentId: deptMap[u.dept],
        baseCostPerHour: u.cost,
        employmentStatus: 'ACTIVE',
      },
    });
  }

  const allUsers = await prisma.user.findMany({ include: { role: true } });
  const userMap = Object.fromEntries(allUsers.map((u) => [u.email, u]));

  const userSkills: Record<string, string[]> = {
    'dev1@enterprise.com':   ['React', 'Next.js', 'TypeScript', 'Node.js'],
    'dev2@enterprise.com':   ['NestJS', 'PostgreSQL', 'Prisma', 'TypeScript'],
    'dev3@enterprise.com':   ['Python', 'Docker', 'AWS', 'Redis'],
    'qa1@enterprise.com':    ['Selenium', 'Cypress', 'TypeScript'],
    'devops@enterprise.com': ['Docker', 'Kubernetes', 'AWS', 'Python'],
    'tl@enterprise.com':     ['React', 'NestJS', 'TypeScript', 'AWS'],
    'pm@enterprise.com':     ['Figma'],
  };
  for (const [email, skills] of Object.entries(userSkills)) {
    const user = userMap[email];
    if (!user) continue;
    for (const skillName of skills) {
      if (!skillMap[skillName]) continue;
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: user.id, skillId: skillMap[skillName] } },
        update: {},
        create: { userId: user.id, skillId: skillMap[skillName], level: 4 },
      });
    }
  }
  console.log('  ✓ Users + Skills');

  // ─── 8. LEAVE BALANCES ─────────────────────────────────────────────────────
  // Codes must match LeaveTypeMaster codes seeded below (CL, SL, EL)
  const defaultBalances: Record<string, number> = { CL: 12, SL: 10, EL: 21 };
  for (const user of allUsers) {
    for (const [code, amount] of Object.entries(defaultBalances)) {
      await prisma.leaveBalance.upsert({
        where: { userId_leaveTypeCode: { userId: user.id, leaveTypeCode: code } },
        update: {},
        create: { userId: user.id, leaveTypeCode: code, earnedBalance: amount },
      });
    }
  }
  console.log('  ✓ Leave Balances');

  // ─── 9. PUBLIC HOLIDAYS (2025) ─────────────────────────────────────────────
  // Global holidays have no locationId; clear and recreate to stay idempotent
  await prisma.publicHoliday.deleteMany({ where: { locationId: null } });
  const holidays = [
    { name: "New Year's Day",   date: '2025-01-01' },
    { name: 'Republic Day',     date: '2025-01-26' },
    { name: 'Holi',             date: '2025-03-14' },
    { name: 'Ambedkar Jayanti', date: '2025-04-14' },
    { name: 'Good Friday',      date: '2025-04-18' },
    { name: 'Labour Day',       date: '2025-05-01' },
    { name: 'Independence Day', date: '2025-08-15' },
    { name: 'Gandhi Jayanti',   date: '2025-10-02' },
    { name: 'Diwali',           date: '2025-10-20' },
    { name: 'Christmas',        date: '2025-12-25' },
  ];
  await prisma.publicHoliday.createMany({
    data: holidays.map(h => ({ name: h.name, date: new Date(h.date), isGlobal: true })),
  });
  console.log('  ✓ Public Holidays');

  // ─── 10. TIMESHEET ACTIVITY MASTER ─────────────────────────────────────────
  const activityMasterData = [
    { taskType: 'OBSERVATION', activity: 'Incident Management', subActivity: 'Ticket Triage', meaning: 'Understand issue, set priority, assign owner' },
    { taskType: 'OBSERVATION', activity: 'Incident Management', subActivity: 'Issue Resolution', meaning: 'Find root cause, apply fix, validate' },
    { taskType: 'OBSERVATION', activity: 'Incident Management', subActivity: 'RCA Documentation', meaning: 'Prepare RCA and closure notes' },
    { taskType: 'OBSERVATION', activity: 'Fix Development',     subActivity: 'Fix / Patch Development', meaning: 'Develop fix or hot patch' },
    { taskType: 'OBSERVATION', activity: 'Fix Development',     subActivity: 'Code Review', meaning: 'Peer review of fix' },
    { taskType: 'OBSERVATION', activity: 'Testing',             subActivity: 'Fix Testing', meaning: 'Test fix in lower environment' },
    { taskType: 'OBSERVATION', activity: 'Deployment',          subActivity: 'Deploy to Production', meaning: 'Deploy fix to production' },
    { taskType: 'OBSERVATION', activity: 'Monitoring & Alerts', subActivity: 'Monitoring Review', meaning: 'Daily monitoring and alert checks' },
    { taskType: 'CHANGE_REQUEST', activity: 'Requirement Gathering', subActivity: 'Stakeholder Discussion', meaning: 'Requirement meetings and discussions' },
    { taskType: 'CHANGE_REQUEST', activity: 'Requirement Gathering', subActivity: 'Requirement Documentation', meaning: 'BRD, FRS, use cases' },
    { taskType: 'CHANGE_REQUEST', activity: 'Development',       subActivity: 'Feature Development', meaning: 'Feature implementation' },
    { taskType: 'CHANGE_REQUEST', activity: 'Development',       subActivity: 'Code Review', meaning: 'Review of new feature code' },
    { taskType: 'CHANGE_REQUEST', activity: 'Testing',           subActivity: 'Unit Testing', meaning: 'Developer unit tests' },
    { taskType: 'CHANGE_REQUEST', activity: 'Testing',           subActivity: 'UAT Support', meaning: 'Support user acceptance testing' },
    { taskType: 'CHANGE_REQUEST', activity: 'Deployment',        subActivity: 'Release Preparation', meaning: 'Prepare release notes and deploy artifacts' },
  ] as const;

  for (const a of activityMasterData) {
    await prisma.timesheetActivityMaster.upsert({
      where: { taskType_activity_subActivity: { taskType: a.taskType as TimesheetTaskType, activity: a.activity, subActivity: a.subActivity } },
      update: {},
      create: { taskType: a.taskType as TimesheetTaskType, activity: a.activity, subActivity: a.subActivity, meaning: a.meaning },
    });
  }
  console.log('  ✓ Timesheet Activity Master');

  // ─── 11. ORG MASTERS ───────────────────────────────────────────────────────

  // Currencies
  const inrCurrency = await prisma.currency.upsert({
    where: { code: 'INR' },
    update: {},
    create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 1.0, isBase: true, isActive: true },
  });
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 83.5, isBase: false, isActive: true },
  });
  console.log('  ✓ Currencies');

  // Company
  const company = await prisma.company.upsert({
    where: { name: 'Newel Technologies' },
    update: {},
    create: {
      name: 'Newel Technologies',
      gstin: null,
      currencyId: inrCurrency.id,
      isActive: true,
    },
  });
  console.log('  ✓ Company');

  // Leave Type Masters
  const leaveTypeDefs = [
    { code: 'CL',  name: 'Casual Leave',       isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
    { code: 'SL',  name: 'Sick Leave',          isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: false },
    { code: 'EL',  name: 'Earned Leave',        isPaid: true,  allowHalfDay: false, carryForwardMax: 30, requiresApproval: true },
    { code: 'LOP', name: 'Loss of Pay',         isPaid: false, allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
    { code: 'CO',  name: 'Compensatory Off',    isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
    { code: 'PAID', name: 'Paid Leave',         isPaid: true,  allowHalfDay: true,  carryForwardMax: 0,  requiresApproval: true },
  ];
  for (const lt of leaveTypeDefs) {
    await prisma.leaveTypeMaster.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    });
  }
  console.log('  ✓ Leave Type Masters');

  // Priority Masters
  const priorityDefs = [
    { name: 'CRITICAL', color: '#DC2626', sortOrder: 1 },
    { name: 'HIGH',     color: '#EA580C', sortOrder: 2 },
    { name: 'MEDIUM',   color: '#CA8A04', sortOrder: 3 },
    { name: 'LOW',      color: '#16A34A', sortOrder: 4 },
  ];
  for (const p of priorityDefs) {
    await prisma.priorityMaster.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }
  console.log('  ✓ Priority Masters');

  // Shift
  await prisma.shift.upsert({
    where: { id: 'shift-general-001' },
    update: {},
    create: {
      id: 'shift-general-001',
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      isDefault: true,
      isActive: true,
    },
  });
  console.log('  ✓ Shifts');

  // ─── 12. PROJECTS ──────────────────────────────────────────────────────────
  const devProject = await prisma.project.upsert({
    where: { id: 'proj-dev-001' },
    update: {},
    create: {
      id: 'proj-dev-001',
      name: 'Customer Portal v2',
      description: 'Next-generation customer self-service portal with React + NestJS stack.',
      type: 'DEVELOPMENT',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-09-30'),
      status: 'ACTIVE',
    },
  });

  const maintProject = await prisma.project.upsert({
    where: { id: 'proj-mnt-001' },
    update: {},
    create: {
      id: 'proj-mnt-001',
      name: 'Legacy ERP Support',
      description: 'Ongoing maintenance and L2/L3 support for legacy ERP system.',
      type: 'MAINTENANCE',
      startDate: new Date('2024-10-01'),
      endDate: new Date('2025-12-31'),
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Projects');

  // ─── 13. CLIENT POs ────────────────────────────────────────────────────────
  const clientPO = await prisma.clientPO.upsert({
    where: { poNumber: 'PO-2025-001' },
    update: {},
    create: {
      poNumber: 'PO-2025-001',
      projectId: devProject.id,
      amount: 5000000,
      placeOfSupply: 'Maharashtra',
      status: 'ACTIVE',
    },
  });

  const maintPO = await prisma.clientPO.upsert({
    where: { poNumber: 'PO-2024-MAINT-01' },
    update: {},
    create: {
      poNumber: 'PO-2024-MAINT-01',
      projectId: maintProject.id,
      amount: 1800000,
      placeOfSupply: 'Karnataka',
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Client POs');

  // ─── 14. MILESTONES ────────────────────────────────────────────────────────
  const ms1 = await prisma.milestone.upsert({
    where: { id: 'ms-001' },
    update: {},
    create: {
      id: 'ms-001', name: 'Phase 1 — Discovery & Design', amount: 1000000,
      completion: 100, status: 'FULLY_INVOICED', projectId: devProject.id,
      clientPoId: clientPO.id, dueDate: new Date('2025-03-31'), achievedAt: new Date('2025-03-28'),
    },
  });

  const ms2 = await prisma.milestone.upsert({
    where: { id: 'ms-002' },
    update: {},
    create: {
      id: 'ms-002', name: 'Phase 2 — Core Development', amount: 2000000,
      completion: 60, status: 'PARTIAL', projectId: devProject.id,
      clientPoId: clientPO.id, dueDate: new Date('2025-06-30'),
    },
  });

  const ms3 = await prisma.milestone.upsert({
    where: { id: 'ms-003' },
    update: {},
    create: {
      id: 'ms-003', name: 'Phase 3 — UAT & Go-Live', amount: 2000000,
      completion: 0, status: 'PENDING', projectId: devProject.id,
      clientPoId: clientPO.id, dueDate: new Date('2025-09-30'),
    },
  });

  await prisma.milestone.upsert({
    where: { id: 'ms-maint-q1' },
    update: {},
    create: {
      id: 'ms-maint-q1', name: 'Q1 2025 Support', amount: 450000,
      completion: 100, status: 'FULLY_INVOICED', projectId: maintProject.id,
      clientPoId: maintPO.id, dueDate: new Date('2025-03-31'), achievedAt: new Date('2025-03-31'),
    },
  });
  console.log('  ✓ Milestones');

  // ─── 15. INVOICES ──────────────────────────────────────────────────────────
  await prisma.invoice.upsert({
    where: { invoiceNo: 'INV-2025-0001' },
    update: {},
    create: {
      invoiceNo: 'INV-2025-0001', clientPoId: clientPO.id, milestoneId: ms1.id,
      subTotal: 1000000, cgst: 90000, sgst: 90000, igst: 0, tax: 180000, total: 1180000,
      status: 'PAID', financeApproved: true, cfoApproved: true,
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNo: 'INV-2025-0002' },
    update: {},
    create: {
      invoiceNo: 'INV-2025-0002', clientPoId: clientPO.id, milestoneId: ms2.id,
      subTotal: 1200000, cgst: 108000, sgst: 108000, igst: 0, tax: 216000, total: 1416000,
      status: 'SENT', financeApproved: true, cfoApproved: true,
    },
  });
  console.log('  ✓ Invoices');

  // ─── 16. TASKS ─────────────────────────────────────────────────────────────
  const pm = userMap['pm@enterprise.com'];
  const dev1 = userMap['dev1@enterprise.com'];
  const dev2 = userMap['dev2@enterprise.com'];
  const dev3 = userMap['dev3@enterprise.com'];
  const qa1 = userMap['qa1@enterprise.com'];
  const tl = userMap['tl@enterprise.com'];

  const taskDefs = [
    { id: 'task-001', title: 'Design authentication module', status: 'COMPLETED', priority: 'HIGH', milestoneId: ms1.id, assigneeId: dev1.id, estimatedEffort: 16, actualEffort: 14 },
    { id: 'task-002', title: 'Implement JWT auth flow',       status: 'COMPLETED', priority: 'HIGH', milestoneId: ms1.id, assigneeId: dev2.id, estimatedEffort: 24, actualEffort: 26 },
    { id: 'task-003', title: 'Build project dashboard UI',    status: 'WIP',       priority: 'HIGH', milestoneId: ms2.id, assigneeId: dev1.id, estimatedEffort: 40, actualEffort: 18 },
    { id: 'task-004', title: 'API integration layer',         status: 'WIP',       priority: 'MEDIUM', milestoneId: ms2.id, assigneeId: dev2.id, estimatedEffort: 32, actualEffort: 12 },
    { id: 'task-005', title: 'Resource planning module',      status: 'TODO',      priority: 'MEDIUM', milestoneId: ms2.id, assigneeId: dev3.id, estimatedEffort: 48 },
    { id: 'task-006', title: 'E2E test suite setup',          status: 'TODO',      priority: 'MEDIUM', milestoneId: ms2.id, assigneeId: qa1.id,  estimatedEffort: 24 },
    { id: 'task-007', title: 'Performance optimisation',      status: 'BACKLOG',   priority: 'LOW',    milestoneId: ms3.id, assigneeId: dev1.id, estimatedEffort: 16 },
    { id: 'task-008', title: 'UAT coordination',             status: 'BACKLOG',   priority: 'HIGH',   milestoneId: ms3.id, assigneeId: pm?.id },
  ];

  for (const t of taskDefs) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        projectId: devProject.id, milestoneId: t.milestoneId,
        assigneeId: t.assigneeId,
        estimatedEffort: t.estimatedEffort,
        actualEffort: t.actualEffort ?? 0,
        complexity: 3,
      },
    });
  }
  console.log('  ✓ Tasks');

  // ─── 17. TICKETS ───────────────────────────────────────────────────────────
  const ticketDefs = [
    { id: 'tkt-001', title: 'Login page crash on IE11',         status: 'RESOLVED',     priority: 'P1', type: 'BUG',             assigneeId: dev2.id },
    { id: 'tkt-002', title: 'User export functionality broken',  status: 'IN_PROGRESS',  priority: 'P2', type: 'BUG',             assigneeId: dev1.id },
    { id: 'tkt-003', title: 'Add CSV download for reports',      status: 'OPEN',         priority: 'P3', type: 'SERVICE_REQUEST',  assigneeId: dev3.id },
    { id: 'tkt-004', title: 'Update tax rates for FY2026',       status: 'OPEN',         priority: 'P2', type: 'CR',              assigneeId: dev2.id },
    { id: 'tkt-005', title: 'Password reset email delay',        status: 'ON_HOLD',      priority: 'P2', type: 'BUG',             assigneeId: tl.id  },
  ];

  for (const t of ticketDefs) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        type: t.type, projectId: maintProject.id, assigneeId: t.assigneeId,
        isSlaBreached: false, actualEffort: 0, complexity: 'MEDIUM',
      },
    });
  }
  console.log('  ✓ Tickets');

  // ─── 18. ALLOCATIONS ───────────────────────────────────────────────────────
  // Dates kept non-overlapping per user — allocations no longer carry a
  // percentage, so a resource can only be booked on one at a time.
  const allocations = [
    { userId: dev1.id, projectId: devProject.id,   startDate: '2025-01-15', endDate: '2025-09-30' },
    { userId: dev2.id, projectId: devProject.id,   startDate: '2025-01-15', endDate: '2025-09-30' },
    { userId: dev3.id, projectId: devProject.id,   startDate: '2025-03-01', endDate: '2025-09-30' },
    { userId: qa1.id,  projectId: devProject.id,   startDate: '2025-04-01', endDate: '2025-09-30' },
    { userId: dev2.id, projectId: maintProject.id, startDate: '2025-10-01', endDate: '2025-12-31' },
    { userId: dev3.id, projectId: maintProject.id, startDate: '2024-10-01', endDate: '2025-02-28' },
    { userId: tl.id,   projectId: devProject.id,   startDate: '2025-01-15', endDate: '2025-09-30' },
  ];

  for (const a of allocations) {
    await prisma.allocation.upsert({
      where: { userId_projectId_startDate: { userId: a.userId, projectId: a.projectId, startDate: new Date(a.startDate) } },
      update: {},
      create: { userId: a.userId, projectId: a.projectId, startDate: new Date(a.startDate), endDate: new Date(a.endDate) },
    });
  }
  console.log('  ✓ Allocations');

  // ─── 19. TIMESHEETS ────────────────────────────────────────────────────────
  const weekStart = new Date('2025-04-14');
  const weekEnd   = new Date('2025-04-20');

  const activityMaster = await prisma.timesheetActivityMaster.findFirst({
    where: { taskType: 'CHANGE_REQUEST', activity: 'Development', subActivity: 'Feature Development' },
  });

  if (activityMaster) {
    const tsDevs = [dev1, dev2];
    for (const dev of tsDevs) {
      const ts = await prisma.timesheet.upsert({
        where: { user_week: { userId: dev.id, startDate: weekStart } },
        update: {},
        create: { userId: dev.id, startDate: weekStart, endDate: weekEnd, status: TimesheetStatus.SUBMITTED },
      });

      for (let i = 0; i < 5; i++) {
        const entryDate = new Date(weekStart);
        entryDate.setDate(weekStart.getDate() + i);
        const task = taskDefs[i % 3];
        const existing = await prisma.timesheetEntry.findFirst({ where: { timesheetId: ts.id, date: entryDate } });
        if (!existing) {
          await prisma.timesheetEntry.create({
            data: {
              timesheetId: ts.id, date: entryDate, hours: 8,
              projectId: devProject.id,
              description: `Feature development work - Day ${i + 1}`,
              taskType: TimesheetTaskType.CHANGE_REQUEST,
              activityMasterId: activityMaster.id,
              taskId: task.id,
            },
          });
        }
      }
    }
  }
  console.log('  ✓ Timesheets');

  // ─── 20. LEAVES ────────────────────────────────────────────────────────────
  await prisma.leave.upsert({
    where: { id: 'leave-001' },
    update: {},
    create: {
      id: 'leave-001', userId: dev1.id,
      startDate: new Date('2025-05-12'), endDate: new Date('2025-05-14'),
      leaveTypeCode: 'CASUAL', reason: 'Family function', pmStatus: 'APPROVED', hrStatus: 'APPROVED', status: 'APPROVED',
    },
  });

  await prisma.leave.upsert({
    where: { id: 'leave-002' },
    update: {},
    create: {
      id: 'leave-002', userId: dev3.id,
      startDate: new Date('2025-05-20'), endDate: new Date('2025-05-20'),
      leaveTypeCode: 'SICK', reason: 'Fever', pmStatus: 'PENDING', hrStatus: 'PENDING', status: 'PENDING',
    },
  });
  console.log('  ✓ Leaves');

  // ─── 21. WORKFLOW TEMPLATES ────────────────────────────────────────────────
  console.log('  🌱 Seeding Workflow Templates...');
  const hrRole = await prisma.role.findUnique({ where: { name: 'HR' } });
  const pmoRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } }); // PMO as ADMIN for now
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const pmRole = await prisma.role.findUnique({ where: { name: 'PM' } });

  const workflowTemplates = [
    {
      module: 'LEAVE',
      name: 'Leave Approval Workflow',
      steps: [
        { stepOrder: 1, stepName: 'Reporting Authority Approval', approverType: 'REPORTING_AUTHORITY', escalateAfterHours: 48 },
        { stepOrder: 2, stepName: 'HR Approval', approverType: 'ROLE', approverRoleId: hrRole?.id, escalateAfterHours: 48 },
      ],
    },
    {
      module: 'TIMESHEET',
      name: 'Timesheet Approval Workflow',
      steps: [
        { stepOrder: 1, stepName: 'Reporting Authority Approval', approverType: 'REPORTING_AUTHORITY', escalateAfterHours: 24 },
      ],
    },
    {
      module: 'DEMAND',
      name: 'Resource Demand Approval',
      steps: [
        { stepOrder: 1, stepName: 'PMO Review', approverType: 'ROLE', approverRoleId: pmoRole?.id },
        { stepOrder: 2, stepName: 'Admin Approval', approverType: 'ROLE', approverRoleId: adminRole?.id },
      ],
    },
    {
      module: 'PROJECT_APPROVAL',
      name: 'Project Approval Workflow',
      steps: [
        { stepOrder: 1, stepName: 'PMO Review', approverType: 'ROLE', approverRoleId: pmoRole?.id },
        { stepOrder: 2, stepName: 'Admin Approval', approverType: 'ROLE', approverRoleId: adminRole?.id },
      ],
    },
    {
      module: 'CR',
      name: 'Change Request Approval',
      steps: [
        { stepOrder: 1, stepName: 'PM Approval', approverType: 'ROLE', approverRoleId: pmRole?.id },
        { stepOrder: 2, stepName: 'PMO Approval', approverType: 'ROLE', approverRoleId: pmoRole?.id },
        { stepOrder: 3, stepName: 'Admin Final Approval', approverType: 'ROLE', approverRoleId: adminRole?.id },
      ],
    },
  ];

  for (const t of workflowTemplates) {
    const existing = await prisma.workflowTemplate.findFirst({ where: { module: t.module } });
    if (!existing) {
      await prisma.workflowTemplate.create({
        data: {
          module: t.module,
          name: t.name,
          isActive: true,
          steps: {
            create: t.steps.map(s => ({
              stepOrder: s.stepOrder,
              stepName: s.stepName,
              approverType: s.approverType as any,
              approverRoleId: s.approverRoleId,
              escalateAfterHours: s.escalateAfterHours,
            })),
          },
        },
      });
    }
  }
  console.log('  ✓ Workflow Templates');
  
  // ─── 22. ADMIN CONFIGURATION ──────────────────────────────────────────────
  console.log('  🌱 Seeding Admin Configuration...');
  const configs = [
    { key: 'timesheet.max_daily_hours', value: '24', label: 'Max Daily Hours', group: 'TIMESHEET' },
    { key: 'timesheet.backdated_days_limit', value: '7', label: 'Backdated Days Limit', group: 'TIMESHEET' },
    { key: 'allocation.max_percentage', value: '100', label: 'Max Allocation %', group: 'ALLOCATION' },
    { key: 'leave.advance_days_required', value: '1', label: 'Advance Days Required', group: 'LEAVE' },
    { key: 'notification.approval_overdue_hours', value: '48', label: 'Approval Overdue Hours', group: 'NOTIFICATION' },
    { key: 'budget.alert_threshold_pct', value: '90', label: 'Budget Alert Threshold %', group: 'BUDGET' },
  ];

  for (const c of configs) {
    await prisma.adminConfig.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    });
  }

  const series = [
    { module: 'PROJECT', prefix: 'PRJ', padding: 4, separator: '-' },
    { module: 'EMPLOYEE', prefix: 'EMP', padding: 4, separator: '-' },
    { module: 'FREELANCER', prefix: 'FRL', padding: 4, separator: '-' },
    { module: 'VENDOR', prefix: 'VND', padding: 4, separator: '-' },
    { module: 'CLIENT', prefix: 'CLT', padding: 4, separator: '-' },
    { module: 'INVOICE', prefix: 'INV', padding: 6, separator: '-' },
    { module: 'DEMAND', prefix: 'DEM', padding: 4, separator: '-' },
    { module: 'CR', prefix: 'CR', padding: 4, separator: '-' },
  ];

  for (const s of series) {
    await prisma.numberSeries.upsert({
      where: { module: s.module },
      update: {},
      create: s,
    });
  }

  await prisma.financialYear.upsert({
    where: { id: 'fy-2025-26' },
    update: {},
    create: {
      id: 'fy-2025-26',
      label: 'FY 2025-26',
      startMonth: 4,
      startYear: 2025,
      endMonth: 3,
      endYear: 2026,
      isCurrent: true,
    },
  });
  console.log('  ✓ Admin Configuration');

  console.log('\n✅ Seeding completed successfully!');
  console.log('\nDefault credentials:');
  console.log('  Admin:      admin@enterprise.com / Password@123');
  console.log('  PM:         pm@enterprise.com / Password@123');
  console.log('  TL:         tl@enterprise.com / Password@123');
  console.log('  Dev:        dev1@enterprise.com / Password@123');
  console.log('  HR:         hr@enterprise.com / Password@123');
  console.log('  Freelancer: free1@enterprise.com / Password@123');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
